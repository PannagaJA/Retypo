import os
import io
import time
import base64
import hashlib
import httpx
import numpy as np
from typing import List, Tuple, Optional, Any, Dict
from PIL import Image

class GoogleVisionService:
    """
    High-accuracy, ultra-fast OCR engine powered by Google Cloud Vision API.
    Configured with a strict ZERO-RETRY policy (max_retries=0) and SHA-256
    deduplication cache to guarantee zero duplicate requests and zero quota wastage.
    """
    VISION_URL = "https://vision.googleapis.com/v1/images:annotate"

    # In-memory deduplication cache: {sha256_hash: (timestamp, parsed_items)}
    _dedup_cache: Dict[str, Tuple[float, List[Tuple[List[List[float]], str, float]]]] = {}
    CACHE_TTL_SECONDS = 60.0

    @classmethod
    def get_api_key(cls) -> str:
        key = os.getenv("GOOGLE_VISION_API_KEY")
        if not key:
            try:
                from dotenv import load_dotenv
                load_dotenv()
                key = os.getenv("GOOGLE_VISION_API_KEY")
            except Exception:
                pass
        return (key or "").strip()

    @classmethod
    def is_available(cls) -> bool:
        return bool(cls.get_api_key())

    @classmethod
    def parse_vision_response(cls, response_json: Dict[str, Any]) -> List[Tuple[List[List[float]], str, float]]:
        """
        Parses Google Vision fullTextAnnotation into structured lines with accurate polygon boxes
        using spatial reading-order line clustering. Prevents grouping distant buttons or columns into huge boxes.
        Falls back to textAnnotations if fullTextAnnotation is not populated.
        """
        items: List[Tuple[List[List[float]], str, float]] = []
        responses = response_json.get("responses", [])
        if not responses:
            return items

        first_resp = responses[0]
        full_text_annotation = first_resp.get("fullTextAnnotation")

        if full_text_annotation:
            extracted_words: List[Dict[str, Any]] = []
            for page in full_text_annotation.get("pages", []):
                for block in page.get("blocks", []):
                    for para in block.get("paragraphs", []):
                        for word in para.get("words", []):
                            word_text = "".join([s.get("text", "") for s in word.get("symbols", [])]).strip()
                            if not word_text:
                                continue
                            vertices = word.get("boundingPoly", {}).get("vertices", [])
                            if len(vertices) < 4:
                                continue
                            xs = [float(v.get("x", 0)) for v in vertices if "x" in v]
                            ys = [float(v.get("y", 0)) for v in vertices if "y" in v]
                            if not xs or not ys:
                                continue
                            wx1, wx2 = min(xs), max(xs)
                            wy1, wy2 = min(ys), max(ys)
                            conf = float(word.get("confidence", 0.98))
                            extracted_words.append({
                                "text": word_text,
                                "x1": wx1,
                                "y1": wy1,
                                "x2": wx2,
                                "y2": wy2,
                                "conf": conf,
                                "vertices": vertices,
                            })

            # Spatial reading-order line clustering:
            # Group words that share vertical baseline overlap and are horizontally adjacent
            extracted_words.sort(key=lambda w: (w["y1"], w["x1"]))
            lines: List[Dict[str, Any]] = []

            for w in extracted_words:
                wx1, wy1, wx2, wy2 = w["x1"], w["y1"], w["x2"], w["y2"]
                wh = max(1.0, wy2 - wy1)
                placed = False

                for line in lines:
                    ly1, ly2 = line["y1"], line["y2"]
                    lh = max(1.0, ly2 - ly1)
                    # Vertical baseline overlap test
                    overlap = max(0.0, min(wy2, ly2) - max(wy1, ly1))
                    if overlap >= 0.50 * min(wh, lh):
                        # Horizontal proximity test: ensure words are not across distant columns
                        last_w = line["words"][-1]
                        gap = wx1 - last_w["x2"]
                        if 0 <= gap <= 3.2 * max(wh, lh):
                            line["words"].append(w)
                            line["y1"] = min(line["y1"], wy1)
                            line["y2"] = max(line["y2"], wy2)
                            line["x2"] = max(line["x2"], wx2)
                            line["vertices"].extend(w["vertices"])
                            placed = True
                            break

                if not placed:
                    lines.append({
                        "words": [w],
                        "x1": wx1,
                        "y1": wy1,
                        "x2": wx2,
                        "y2": wy2,
                        "vertices": list(w["vertices"]),
                    })

            for line in lines:
                line_text = " ".join([w["text"] for w in line["words"]]).strip()
                if line_text and line["vertices"]:
                    poly = cls._compute_bounding_polygon(line["vertices"])
                    if poly:
                        avg_conf = float(np.mean([w["conf"] for w in line["words"]]))
                        items.append((poly, line_text, round(avg_conf, 3)))

        # Fallback to textAnnotations if fullTextAnnotation didn't yield items
        if not items and "textAnnotations" in first_resp:
            text_annotations = first_resp.get("textAnnotations", [])
            for ann in text_annotations[1:]:
                text = ann.get("description", "").strip()
                vertices = ann.get("boundingPoly", {}).get("vertices", [])
                if not text or len(vertices) < 4:
                    continue
                poly = [[float(v.get("x", 0)), float(v.get("y", 0))] for v in vertices]
                confidence = float(ann.get("confidence", 0.95))
                items.append((poly, text, confidence))

        return items

    @staticmethod
    def _compute_bounding_polygon(vertices: List[Dict[str, Any]]) -> Optional[List[List[float]]]:
        xs = [float(v.get("x", 0)) for v in vertices if "x" in v]
        ys = [float(v.get("y", 0)) for v in vertices if "y" in v]
        if not xs or not ys:
            return None

        min_x, max_x = min(xs), max(xs)
        min_y, max_y = min(ys), max(ys)
        if max_x <= min_x or max_y <= min_y:
            return None

        return [
            [round(min_x, 1), round(min_y, 1)],
            [round(max_x, 1), round(min_y, 1)],
            [round(max_x, 1), round(max_y, 1)],
            [round(min_x, 1), round(max_y, 1)]
        ]

    @classmethod
    def analyze_image_sync(cls, image: Image.Image) -> Optional[List[Tuple[List[List[float]], str, float]]]:
        """
        Synchronous call to Google Cloud Vision API with strict ZERO-RETRY policy (max_retries=0)
        and SHA-256 deduplication. Drops out instantly on any error without quota burning.
        """
        api_key = cls.get_api_key()
        if not api_key:
            return None

        # 1. Compress image to JPEG bytes
        buffer = io.BytesIO()
        w, h = image.width, image.height
        if max(w, h) > 1600:
            scale = 1600.0 / float(max(w, h))
            scaled_img = image.resize((int(round(w * scale)), int(round(h * scale))), Image.Resampling.BILINEAR)
            scaled_img.convert("RGB").save(buffer, format="JPEG", quality=88)
            img_scale = scale
        else:
            image.convert("RGB").save(buffer, format="JPEG", quality=90)
            img_scale = 1.0

        image_bytes = buffer.getvalue()

        # 2. SHA-256 Deduplication check (prevents double API calls if triggered in rapid succession)
        img_hash = hashlib.sha256(image_bytes).hexdigest()
        now = time.time()
        if img_hash in cls._dedup_cache:
            cached_time, cached_result = cls._dedup_cache[img_hash]
            if now - cached_time < cls.CACHE_TTL_SECONDS:
                print(f"[GoogleVision] Serving cached OCR result for hash {img_hash[:8]} (saved 1 API call).")
                return cached_result

        content_b64 = base64.b64encode(image_bytes).decode("utf-8")

        payload = {
            "requests": [
                {
                    "image": {"content": content_b64},
                    "features": [{"type": "DOCUMENT_TEXT_DETECTION"}]
                }
            ]
        }

        # 3. Strict Zero-Retry Policy: retries=0 transport guarantees immediate dropout
        transport = httpx.HTTPTransport(retries=0)
        try:
            with httpx.Client(transport=transport, timeout=10.0) as client:
                resp = client.post(f"{cls.VISION_URL}?key={api_key}", json=payload)

            if resp.status_code != 200:
                print(f"[GoogleVision] API returned HTTP {resp.status_code}: {resp.text}")
                return None

            data = resp.json()
            raw_items = cls.parse_vision_response(data)

            # Rescale coordinates back to full resolution if image was downscaled
            if img_scale != 1.0:
                inv_scale = 1.0 / img_scale
                items = []
                for poly, text, conf in raw_items:
                    rescaled_poly = [[round(pt[0] * inv_scale, 1), round(pt[1] * inv_scale, 1)] for pt in poly]
                    items.append((rescaled_poly, text, conf))
            else:
                items = raw_items

            # Store in short-lived dedup cache
            cls._dedup_cache[img_hash] = (now, items)
            return items

        except (httpx.RequestError, httpx.TimeoutException) as err:
            # Immediate fail-fast: NEVER retry on network drop or timeout
            print(f"[GoogleVision] Request failed immediately (zero-retry policy): {err}")
            return None
        except Exception as e:
            print(f"[GoogleVision] Unexpected error: {e}")
            return None
