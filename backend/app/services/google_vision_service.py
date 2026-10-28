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
    def parse_vision_response(
        cls,
        response_json: Dict[str, Any],
        image_width: Optional[int] = None,
        image_height: Optional[int] = None,
        return_hierarchy: bool = False
    ) -> Any:
        """
        Parses Google Cloud Vision API response.
        Extracts word-level bounding polygons directly from
        fullTextAnnotation.pages[].blocks[].paragraphs[].words[].boundingBox.
        Preserves each word's exact text, quadrilateral vertices (including rotation),
        and confidence score. When return_hierarchy=True, returns rich dictionaries
        with block_idx, paragraph_idx, and break_type for natural line & field grouping.
        """
        items: List[Tuple[List[List[float]], str, float]] = []
        hierarchy_items: List[Dict[str, Any]] = []

        responses = response_json.get("responses", [])
        if not responses:
            return hierarchy_items if return_hierarchy else items

        first_resp = responses[0]
        full_text_annotation = first_resp.get("fullTextAnnotation")

        if full_text_annotation:
            for page in full_text_annotation.get("pages", []):
                page_w = float(page.get("width") or image_width or 1)
                page_h = float(page.get("height") or image_height or 1)

                for b_idx, block in enumerate(page.get("blocks", [])):
                    for p_idx, para in enumerate(block.get("paragraphs", [])):
                        for word in para.get("words", []):
                            word_text = "".join([s.get("text", "") for s in word.get("symbols", [])]).strip()
                            if not word_text:
                                continue

                            box = word.get("boundingBox") or word.get("boundingPoly") or {}
                            vertices = box.get("vertices", [])
                            norm_vertices = box.get("normalizedVertices", [])

                            poly: Optional[List[List[float]]] = None

                            if vertices and len(vertices) >= 4:
                                # In proto3 JSON, missing x or y implies coordinate 0
                                poly = [[float(v.get("x", 0)), float(v.get("y", 0))] for v in vertices[:4]]
                            elif norm_vertices and len(norm_vertices) >= 4:
                                poly = [
                                    [round(float(v.get("x", 0)) * page_w, 1), round(float(v.get("y", 0)) * page_h, 1)]
                                    for v in norm_vertices[:4]
                                ]

                            # Check symbol bounds to ensure glyphs (e.g. final 't' in 'account') are never clipped
                            symbols = word.get("symbols", [])
                            break_type = None
                            if symbols and poly is not None:
                                sym_xs: List[float] = []
                                sym_ys: List[float] = []
                                for s in symbols:
                                    s_box = s.get("boundingBox") or s.get("boundingPoly") or {}
                                    s_verts = s_box.get("vertices", [])
                                    s_norm = s_box.get("normalizedVertices", [])
                                    if s_verts and len(s_verts) >= 4:
                                        for sv in s_verts:
                                            sym_xs.append(float(sv.get("x", 0)))
                                            sym_ys.append(float(sv.get("y", 0)))
                                    elif s_norm and len(s_norm) >= 4:
                                        for sv in s_norm:
                                            sym_xs.append(float(sv.get("x", 0)) * page_w)
                                            sym_ys.append(float(sv.get("y", 0)) * page_h)

                                if sym_xs and sym_ys:
                                    s_min_x, s_max_x = min(sym_xs), max(sym_xs)
                                    s_min_y, s_max_y = min(sym_ys), max(sym_ys)

                                    p_xs = [pt[0] for pt in poly]
                                    p_ys = [pt[1] for pt in poly]
                                    # If symbol boundaries extend beyond word box, expand to enclose all glyphs
                                    if s_min_x < min(p_xs) or s_max_x > max(p_xs) or s_min_y < min(p_ys) or s_max_y > max(p_ys):
                                        new_min_x = min(min(p_xs), s_min_x)
                                        new_max_x = max(max(p_xs), s_max_x)
                                        new_min_y = min(min(p_ys), s_min_y)
                                        new_max_y = max(max(p_ys), s_max_y)
                                        poly = [
                                            [new_min_x, new_min_y],
                                            [new_max_x, new_min_y],
                                            [new_max_x, new_max_y],
                                            [new_min_x, new_max_y]
                                        ]

                                # Extract detected break type from final symbol or word property
                                last_sym = symbols[-1]
                                break_prop = last_sym.get("property", {}).get("detectedBreak", {})
                                break_type = break_prop.get("type")

                            if not break_type:
                                word_prop = word.get("property", {}).get("detectedBreak", {})
                                break_type = word_prop.get("type")

                            if poly and len(poly) == 4:
                                conf = float(word.get("confidence", 0.98))
                                items.append((poly, word_text, round(conf, 3)))
                                hierarchy_items.append({
                                    "polygon": poly,
                                    "text": word_text,
                                    "confidence": round(conf, 3),
                                    "block_idx": b_idx,
                                    "paragraph_idx": p_idx,
                                    "break_type": break_type,
                                })

        # Fallback to textAnnotations if fullTextAnnotation didn't yield items
        if not items and "textAnnotations" in first_resp:
            text_annotations = first_resp.get("textAnnotations", [])
            eff_w = float(image_width or 1)
            eff_h = float(image_height or 1)
            for ann in text_annotations[1:]:
                text = ann.get("description", "").strip()
                box = ann.get("boundingPoly") or ann.get("boundingBox") or {}
                vertices = box.get("vertices", [])
                norm_vertices = box.get("normalizedVertices", [])
                if not text:
                    continue
                poly = None
                if vertices and len(vertices) >= 4:
                    poly = [[float(v.get("x", 0)), float(v.get("y", 0))] for v in vertices[:4]]
                elif norm_vertices and len(norm_vertices) >= 4:
                    poly = [[round(float(v.get("x", 0)) * eff_w, 1), round(float(v.get("y", 0)) * eff_h, 1)] for v in norm_vertices[:4]]

                if poly and len(poly) == 4:
                    conf = float(ann.get("confidence", 0.95))
                    items.append((poly, text, conf))
                    hierarchy_items.append({
                        "polygon": poly,
                        "text": text,
                        "confidence": conf,
                        "block_idx": 0,
                        "paragraph_idx": 0,
                        "break_type": None,
                    })

        return hierarchy_items if return_hierarchy else items

    @classmethod
    def analyze_image_sync(
        cls,
        image: Image.Image,
        return_hierarchy: bool = False
    ) -> Optional[Any]:
        """
        Synchronous call to Google Cloud Vision API with strict ZERO-RETRY policy (max_retries=0)
        and SHA-256 deduplication. Preserves native image resolution for 1:1 coordinate accuracy.
        When return_hierarchy=True, returns rich word dictionaries with layout hierarchy metadata.
        """
        api_key = cls.get_api_key()
        if not api_key:
            return None

        # 1. Compress image to JPEG bytes at full native resolution
        buffer = io.BytesIO()
        w, h = image.width, image.height
        image.convert("RGB").save(buffer, format="JPEG", quality=95)
        image_bytes = buffer.getvalue()

        # 2. SHA-256 Deduplication check (prevents double API calls if triggered in rapid succession)
        img_hash = hashlib.sha256(image_bytes).hexdigest()
        now = time.time()
        cache_key = f"{img_hash}-{'h' if return_hierarchy else 'w'}"
        if cache_key in cls._dedup_cache:
            cached_time, cached_result = cls._dedup_cache[cache_key]
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
            items = cls.parse_vision_response(data, image_width=w, image_height=h, return_hierarchy=return_hierarchy)

            # Store in short-lived dedup cache
            cls._dedup_cache[cache_key] = (now, items)
            return items

        except (httpx.RequestError, httpx.TimeoutException) as err:
            # Immediate fail-fast: NEVER retry on network drop or timeout
            print(f"[GoogleVision] Request failed immediately (zero-retry policy): {err}")
            return None
        except Exception as e:
            print(f"[GoogleVision] Unexpected error: {e}")
            return None

