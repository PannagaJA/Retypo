import os
import time
import uuid
import numpy as np
from PIL import Image
from typing import List, Optional, Tuple, Any, Dict

from app.core.models import DetectedTextRegion
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

        try:
            from paddleocr import PaddleOCR
            engine = PaddleOCR(
                lang=clean_lang,
                use_doc_orientation_classify=False,
                use_doc_unwarping=False,
                use_textline_orientation=True,
            )
            self._engines[clean_lang] = engine
            print(f"PaddleOCR engine for lang='{clean_lang}' initialized successfully (unwarping disabled).")
            return engine
        except Exception as e:
            print(f"Warning: PaddleOCR failed for lang='{clean_lang}': {e}")
            # Fallback to English if available
            if "en" in self._engines:
                return self._engines["en"]
            try:
                from paddleocr import PaddleOCR
                engine = PaddleOCR(
                    lang="en",
                    use_doc_orientation_classify=False,
                    use_doc_unwarping=False,
                    use_textline_orientation=True,
                )
                self._engines["en"] = engine
                return engine
            except Exception:
                return None

    def _extract_ocr_items(self, ocr_out: Any) -> List[Tuple[List[List[float]], str, float]]:
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
                clean_poly = [[round(float(pt[0]), 1), round(float(pt[1]), 1)] for pt in poly_list]
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
                        clean_poly = [[round(float(pt[0]), 1), round(float(pt[1]), 1)] for pt in poly_raw]
                        items.append((clean_poly, text, score))

        return items

    @staticmethod
    def _is_icon_or_noise(text: str, bbox: List[float], confidence: float) -> bool:
        clean = text.strip()
        if not clean:
            return True
        w, h = float(bbox[2]), float(bbox[3])
        if w < 6.0 or h < 6.0:
            return True
        aspect = w / max(1.0, h)
        # 1. Must contain at least one alphanumeric character or currency symbol
        has_text_char = any(c.isalnum() or c in "$€₹£¥" for c in clean)
        if not has_text_char:
            return True
        # 2. Standalone single-character icon check (e.g. arrow icons ↗ ↙, nav icons misread as '7', 'K', '1', 'O')
        if len(clean) == 1:
            if 0.70 <= aspect <= 1.35 and max(w, h) <= 40.0:
                return True
            if confidence < 0.75:
                return True
        # 3. Small square glyphs with low-to-medium confidence (icon badges, bullets)
        if len(clean) <= 2 and 0.75 <= aspect <= 1.30 and max(w, h) <= 28.0 and confidence < 0.90:
            return True
        return False

    def analyze_image(self, image: Image.Image, lang: str = "en") -> List[DetectedTextRegion]:
        """
        Runs text detection & recognition on PIL image, extracts geometry,
        estimates typography parameters, and returns structured DetectedTextRegion list.
        Filters out non-text icons, stray glyphs, and UI symbols.
        """
        engine = self._get_paddle_engine(lang)
        img_np = np.array(image.convert("RGB"))

        raw_ocr_out = None
        if engine is not None:
            try:
                raw_ocr_out = engine.ocr(img_np)
            except Exception as err:
                print(f"PaddleOCR execution error ({lang}): {err}")
                raw_ocr_out = None

        extracted_items = self._extract_ocr_items(raw_ocr_out)
        regions: List[DetectedTextRegion] = []

        for clean_polygon, text, score in extracted_items:
            try:
                angle = calculate_polygon_angle(clean_polygon)
                font_size = calculate_font_size(clean_polygon, image=image, text=text)
                bbox = calculate_bounding_box(clean_polygon, image=image)
                geom_conf = calculate_geometry_confidence(clean_polygon)
                color = estimate_text_color(image, clean_polygon)
                weight = estimate_text_weight(image, clean_polygon, font_size)
                blur = estimate_text_blur(image, clean_polygon)

                # Filter out UI icons, non-text symbols, and graphic glyphs
                if self._is_icon_or_noise(text, bbox, round(score, 3)):
                    continue

                region = DetectedTextRegion(
                    regionId=f"ocr-{uuid.uuid4().hex[:8]}",
                    text=text,
                    polygon=clean_polygon,
                    bbox=bbox,
                    angle=angle,
                    estimatedFontSize=font_size,
                    estimatedColor=color,
                    estimatedWeight=weight,
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
        return regions
