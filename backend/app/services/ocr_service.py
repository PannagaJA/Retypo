import os
import re
import time
import uuid
import difflib
import gc
import threading
import numpy as np
from PIL import Image
from typing import List, Optional, Tuple, Any, Dict

# Concurrency lock to strictly serialize OCR execution on low-memory environments (Render 512MB)
OCR_LOCK = threading.Lock()

# Configure Paddle allocator flags before runtime initializes (disable MKLDNN to prevent oneDNN PIR conversion crashes)
os.environ["FLAGS_use_mkldnn"] = "0"
os.environ["PADDLE_PDX_ENABLE_MKLDNN_BYDEFAULT"] = "0"
os.environ.setdefault("FLAGS_fraction_of_cpu_memory_to_use", "0.1")
os.environ.setdefault("FLAGS_allocator_strategy", "naive_best_fit")
os.environ.setdefault("FLAGS_eager_delete_scope", "True")
os.environ.setdefault("FLAGS_fast_eager_deletion_mode", "True")
os.environ.setdefault("CPU_NUM", "1")
os.environ.setdefault("OMP_NUM_THREADS", "1")
os.environ.setdefault("MKL_NUM_THREADS", "1")
os.environ.setdefault("PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK", "True")

def clear_system_memory_caches():
    """
    Forces Python garbage collection and instructs Linux glibc (used in Render Docker)
    to release all freed heap memory pages back to the operating system kernel immediately.
    """
    gc.collect()
    try:
        import ctypes
        libc = ctypes.CDLL("libc.so.6")
        libc.malloc_trim(0)
    except Exception:
        pass

import cv2
import math
from app.core.models import DetectedTextRegion
from app.services.typography_service import TypographyService
from app.services.geometry_service import (
    calculate_polygon_angle,
    calculate_font_size,
    calculate_bounding_box,
    calculate_geometry_confidence,
    estimate_text_color,
    estimate_text_weight,
    estimate_text_blur,
)

class OCRService:
    _instance: Optional["OCRService"] = None

    def __init__(self):
        self._engines: Dict[str, Any] = {}

    @classmethod
    def get_instance(cls) -> "OCRService":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def _get_paddle_engine(self, lang: str = "en"):
        clean_lang = lang.lower().strip()
        if clean_lang not in ["en", "ka", "hi", "te", "ta", "ch"]:
            clean_lang = "en"

        if clean_lang in self._engines:
            return self._engines[clean_lang]

        # In low-memory / Render environments, evict previously loaded engines to prevent multi-model RAM bloat
        is_low_mem = os.getenv("RENDER") is not None or os.getenv("LOW_MEMORY_MODE", "true").lower() == "true"
        if is_low_mem and self._engines:
            self._engines.clear()
            clear_system_memory_caches()

        det_limit = 736 if is_low_mem else 960

        try:
            from paddleocr import PaddleOCR
            engine = PaddleOCR(
                text_detection_model_name="PP-OCRv6_small_det",
                text_recognition_model_name="PP-OCRv6_small_rec",
                use_doc_orientation_classify=False,
                use_doc_unwarping=False,
                use_textline_orientation=False,
                text_det_limit_side_len=det_limit,
                text_det_limit_type="max",
                text_det_unclip_ratio=1.9,
                text_det_box_thresh=0.45,
                text_det_thresh=0.20,
                device="cpu",
            )
            self._engines[clean_lang] = engine
            print(f"PaddleOCR small mobile engine initialized (lang='{clean_lang}', low_mem={is_low_mem}, det_limit={det_limit}).")
            return engine
        except Exception as e:
            print(f"Warning: PaddleOCR failed for lang='{clean_lang}': {e}")
            if "en" in self._engines:
                return self._engines["en"]
            try:
                from paddleocr import PaddleOCR
                engine = PaddleOCR(
                    text_detection_model_name="PP-OCRv6_small_det",
                    text_recognition_model_name="PP-OCRv6_small_rec",
                    use_doc_orientation_classify=False,
                    use_doc_unwarping=False,
                    use_textline_orientation=False,
                    text_det_limit_side_len=det_limit,
                    text_det_limit_type="max",
                    text_det_unclip_ratio=1.9,
                    text_det_box_thresh=0.45,
                    text_det_thresh=0.20,
                    device="cpu",
                )
                self._engines["en"] = engine
                return engine
            except Exception:
                return None

    def _extract_ocr_items(self, ocr_out: Any, scale: float = 1.0) -> List[Tuple[List[List[float]], str, float]]:
        items: List[Tuple[List[List[float]], str, float]] = []
        if not ocr_out or len(ocr_out) == 0:
            return items

        first = ocr_out[0]

        # Format 1: PaddleOCR 3.7+ / PaddleX Dictionary Output
        if isinstance(first, dict):
            texts = first.get("rec_texts", [])
            scores = first.get("rec_scores", [])
            polys = first.get("rec_polys") or first.get("dt_polys", [])
            for i in range(len(texts)):
                text = str(texts[i]).strip()
                score = float(scores[i]) if i < len(scores) else 1.0
                if not text:
                    continue
                p = polys[i]
                poly_list = p.tolist() if hasattr(p, "tolist") else list(p)
                clean_poly = [[round(float(pt[0]) / scale, 1), round(float(pt[1]) / scale, 1)] for pt in poly_list]
                items.append((clean_poly, text, score))

        # Format 2: Standard/Legacy PaddleOCR List Output: [[poly, (text, score)], ...]
        elif isinstance(first, list):
            for entry in first:
                if isinstance(entry, (list, tuple)) and len(entry) >= 2:
                    poly_raw = entry[0]
                    text_info = entry[1]
                    if isinstance(text_info, (list, tuple)) and len(text_info) >= 2:
                        text = str(text_info[0]).strip()
                        score = float(text_info[1])
                        if not text:
                            continue
                        clean_poly = [[round(float(pt[0]) / scale, 1), round(float(pt[1]) / scale, 1)] for pt in poly_raw]
                        items.append((clean_poly, text, score))

        return items

    @staticmethod
    def _is_icon_or_noise(
        text: str,
        bbox: List[float],
        confidence: float,
        crop_bgr: Optional[np.ndarray] = None,
        image_dims: Optional[Tuple[int, int]] = None
    ) -> bool:
        clean = text.strip()
        if not clean:
            return True

        w, h = float(bbox[2]), float(bbox[3])
        if w < 5.0 or h < 5.0:
            return True

        # 1. Reject pure punctuation, symbols, separators, or geometric marks
        # Text must contain at least one alphanumeric character
        if not re.search(r'[a-zA-Z0-9\u00C0-\u024F\u0400-\u04FF\u4E00-\u9FFF\u3040-\u30FF\uAC00-\uD7AF]', clean):
            return True

        aspect = w / max(1.0, h)
        compact = re.sub(r'[\s\.\:\-_/\\#@!,\'"\(\)\[\]\{\}]', '', clean)

        # 2. Rejection of common SVG UI icon misclassifications:
        # chevrons, arrows, sliders, bullets, lines, hamburger bars
        icon_chars = {
            ">", "<", "v", "^", "∧", "∨", "»", "«", "›", "‹", "→", "←", "↑", "↓",
            "↗", "↘", "↙", "↖", "=", "三", "-", "一", "—", "•", "·", "口", "匚",
            "○", "●", "★", "☆", "♥", "♡", "✓", "✗", "✕", "✖", "▲", "▼", "◀", "▶",
            "◆", "◇", "车", "三", "二"
        }
        if clean in icon_chars:
            return True

        # 3. Small square glyphs: UI icons misread as a single character (e.g. search magnifying glass as 'Q' or 'O', user avatar as '0' or 'o', arrow badge as '7' or 'K' or '1')
        if len(compact) <= 1:
            # Low confidence standalone character
            if confidence < 0.80:
                return True
            # Square icon bounding box (avatars, search lenses, radio buttons, navigation arrows)
            if 0.75 <= aspect <= 1.35 and max(w, h) <= 80.0:
                return True

        # 4. Two-glyph UI badges / icon noise
        if len(compact) <= 2:
            if confidence < 0.88 and max(w, h) <= 50.0 and 0.60 <= aspect <= 1.50:
                return True
            if confidence < 0.70:
                return True

        # 5. Non-text images / large photo textures / decorative elements
        if image_dims:
            img_w, img_h = image_dims
            # Misdetected huge photographic block or texture
            if (w * h) > 0.35 * (img_w * img_h) and confidence < 0.75:
                return True

        # 6. Repetitive noise sequences (e.g. "||||||", "xxxxxx", "------")
        if len(compact) >= 5 and len(set(compact)) == 1 and confidence < 0.85:
            return True

        # 7. Computer Vision check on crop: Detect circular avatars, button badges, and solid icons
        if crop_bgr is not None and crop_bgr.size > 0 and len(compact) <= 2:
            try:
                gray = cv2.cvtColor(crop_bgr, cv2.COLOR_BGR2GRAY)
                _, otsu = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
                cnts, _ = cv2.findContours(otsu, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
                if cnts:
                    c = max(cnts, key=cv2.contourArea)
                    area = cv2.contourArea(c)
                    peri = cv2.arcLength(c, True)
                    if peri > 0:
                        circ = 4.0 * math.pi * area / (peri * peri)
                        # Circular profile badges, search icons, notification dots have high circularity
                        if circ > 0.65:
                            return True
            except Exception:
                pass

        return False

    @staticmethod
    def _normalize_detected_text(text: str, all_raw_texts: Optional[List[str]] = None) -> str:
        s = text.strip()
        if not s:
            return s

        # 1. Normalize excessive internal whitespace and linebreaks
        s = re.sub(r'[\r\n\t]+', ' ', s)
        s = re.sub(r' {2,}', ' ', s)

        # 2. Strip leading bullet/arrow symbols at start of lines (e.g. '> Continue Reading' -> 'Continue Reading')
        s = re.sub(r'^[>»›«‹→←^v\-\—\•\·~\|\+]\s*', '', s)

        # 3. Fix currency symbols attached to numbers or spaces universally:
        # e.g. "$ 120" -> "$120", "€ 49.99" -> "€49.99", "£ 10" -> "£10", "₹ 250" -> "₹250"
        s = re.sub(r'([$€£¥₹])\s+(\d)', r'\1\2', s)

        # 4. Standard punctuation spacing: remove space before comma/period/colon
        s = re.sub(r'\s+([,\.:;!\?])', r'\1', s)

        # 5. Remove stray leading or trailing decorative quotes or backticks if unbalanced
        if (s.startswith("`") or s.startswith("'") or s.startswith('"')) and not (s.endswith("`") or s.endswith("'") or s.endswith('"')):
            s = s[1:].strip()
        elif (s.endswith("`") or s.endswith("'") or s.endswith('"')) and not (s.startswith("`") or s.startswith("'") or s.startswith('"')):
            s = s[:-1].strip()

        return s

    def analyze_image(self, image: Image.Image, lang: str = "en") -> List[DetectedTextRegion]:
        """
        Runs text detection & recognition on PIL image, extracts geometry,
        estimates typography parameters, and returns structured DetectedTextRegion list.
        Applies adaptive resolution scaling, noise filtering, and smart text normalization.
        """
        engine = self._get_paddle_engine(lang)

        is_low_mem = os.getenv("RENDER") is not None or os.getenv("LOW_MEMORY_MODE", "true").lower() == "true"
        w, h = image.width, image.height
        scale = 1.0

        if is_low_mem:
            # On 512MB RAM, cap maximum resolution to 1200px to prevent DBNet tensor memory spikes
            if max(w, h) > 1200:
                scale = 1200.0 / float(max(w, h))
                scaled_w = int(round(w * scale))
                scaled_h = int(round(h * scale))
                scaled_img = image.resize((scaled_w, scaled_h), Image.Resampling.BILINEAR)
                img_np = np.array(scaled_img.convert("RGB"))
            else:
                img_np = np.array(image.convert("RGB"))
        else:
            # Adaptive resolution scaling for small/mobile screenshot images on non-constrained environments
            if min(w, h) < 1400 and max(w, h) < 2600:
                scale = min(2.0, 2400.0 / max(w, h))
                if scale < 1.15:
                    scale = 1.0

            if scale > 1.0:
                new_w = int(round(w * scale))
                new_h = int(round(h * scale))
                scaled_img = image.resize((new_w, new_h), Image.Resampling.LANCZOS)
                img_np = np.array(scaled_img.convert("RGB"))
            else:
                img_np = np.array(image.convert("RGB"))

        raw_ocr_out = None
        if engine is not None:
            try:
                with OCR_LOCK:
                    if hasattr(engine, "predict"):
                        raw_ocr_out = engine.predict(img_np)
                    else:
                        raw_ocr_out = engine.ocr(img_np)
            except Exception as err:
                print(f"PaddleOCR execution error ({lang}): {err}")
                raw_ocr_out = None
            finally:
                clear_system_memory_caches()

        extracted_items = self._extract_ocr_items(raw_ocr_out, scale=scale)
        all_raw_texts = [item[1] for item in extracted_items]

        regions: List[DetectedTextRegion] = []

        for clean_polygon, raw_text, score in extracted_items:
            try:
                angle = calculate_polygon_angle(clean_polygon)
                font_size = calculate_font_size(clean_polygon, image=image, text=raw_text)
                bbox = calculate_bounding_box(clean_polygon, image=image)
                geom_conf = calculate_geometry_confidence(clean_polygon)
                # Extract crop for visual icon validation & typography matching
                crop_x1 = max(0, int(np.floor(bbox[0])))
                crop_y1 = max(0, int(np.floor(bbox[1])))
                crop_x2 = min(image.width, int(np.ceil(bbox[0] + bbox[2])))
                crop_y2 = min(image.height, int(np.ceil(bbox[1] + bbox[3])))

                crop_bgr = None
                if crop_x2 > crop_x1 and crop_y2 > crop_y1:
                    crop_img = image.crop((crop_x1, crop_y1, crop_x2, crop_y2))
                    crop_bgr = cv2.cvtColor(np.array(crop_img.convert("RGB")), cv2.COLOR_RGB2BGR)

                # Filter out UI icons, non-text symbols, and graphic glyphs
                if self._is_icon_or_noise(raw_text, bbox, round(score, 3), crop_bgr=crop_bgr, image_dims=(w, h)):
                    continue

                # Apply universal text normalization
                normalized_text = self._normalize_detected_text(raw_text, all_raw_texts)

                color = estimate_text_color(image, clean_polygon)
                weight = estimate_text_weight(image, clean_polygon, font_size, text=normalized_text)
                blur = 0.0  # Crisp digital rendering: prevent artificial blur

                # High-fidelity Typography & Font Family Identification
                matched_family = "Inter"
                matched_category = "sans-serif"
                matched_weight = weight

                if crop_bgr is not None and crop_bgr.size > 0:
                    try:
                        typo_svc = TypographyService.get_instance()
                        typo_res = typo_svc.match_typography(crop_bgr, normalized_text, font_size_hint=font_size, top_k=3)
                        if typo_res and typo_res.candidates:
                            top_cand = typo_res.candidates[0]
                            matched_family = top_cand.family
                            matched_category = top_cand.category
                            if top_cand.weight:
                                matched_weight = top_cand.weight
                    except Exception as typo_err:
                        print(f"Typography matching warning: {typo_err}")

                region = DetectedTextRegion(
                    regionId=f"ocr-{uuid.uuid4().hex[:8]}",
                    text=normalized_text,
                    polygon=clean_polygon,
                    bbox=bbox,
                    angle=angle,
                    estimatedFontSize=font_size,
                    estimatedColor=color,
                    estimatedWeight=matched_weight,
                    estimatedFontFamily=matched_family,
                    fontCategory=matched_category,
                    estimatedBlur=blur,
                    confidence=round(score, 3),
                    geometryConfidence=geom_conf,
                    isConverted=False
                )
                regions.append(region)
            except Exception as item_err:
                print(f"Error creating DetectedTextRegion: {item_err}")
                continue

        # Sort detected regions in reading order: top-to-bottom, left-to-right
        regions.sort(key=lambda r: (round(r.bbox[1] / max(10, r.estimatedFontSize)), r.bbox[0]))

        # Final memory cache cleanup before returning
        clear_system_memory_caches()
        return regions

