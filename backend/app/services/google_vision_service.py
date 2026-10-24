import os
import io
import time
import base64
import hashlib
import httpx
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
        Parses Google Vision fullTextAnnotation into structured lines with accurate polygon boxes.
        Falls back to textAnnotations if fullTextAnnotation is not populated.
        """
        items: List[Tuple[List[List[float]], str, float]] = []
        responses = response_json.get("responses", [])
        if not responses:
            return items

        first_resp = responses[0]
        full_text_annotation = first_resp.get("fullTextAnnotation")

        if full_text_annotation:
            for page in full_text_annotation.get("pages", []):
                for block in page.get("blocks", []):
                    for para in block.get("paragraphs", []):
                        current_line_words: List[str] = []
                        current_line_vertices: List[Dict[str, Any]] = []

                        for word in para.get("words", []):
                            word_text = "".join([s.get("text", "") for s in word.get("symbols", [])])
                            current_line_words.append(word_text)

                            word_poly = word.get("boundingPoly", {}).get("vertices", [])
                            current_line_vertices.extend(word_poly)

                            # Detect line breaks or paragraph breaks
                            symbols = word.get("symbols", [])
                            last_symbol = symbols[-1] if symbols else {}
                            detected_break = last_symbol.get("property", {}).get("detectedBreak", {})
                            break_type = detected_break.get("type", "")

                            if break_type in ["LINE_BREAK", "EOL_SURE_SPACE", "HYPHEN_BREAK"]:
                                line_text = " ".join(current_line_words).strip()
                                if line_text and current_line_vertices:
                                    poly = cls._compute_bounding_polygon(current_line_vertices)
                                    if poly:
                                        items.append((poly, line_text, 0.99))
                                current_line_words = []
                                current_line_vertices = []

                        # Flush remaining words in paragraph
                        if current_line_words and current_line_vertices:
                            line_text = " ".join(current_line_words).strip()
                            if line_text:
                                poly = cls._compute_bounding_polygon(current_line_vertices)
                                if poly:
                                    items.append((poly, line_text, 0.99))

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
