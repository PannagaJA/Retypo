import os
import glob
import time
import math
from typing import List, Dict, Optional, Tuple, Any
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

from app.schemas.typography import (
    FontCandidate,
    TypographySignalBreakdown,
    TypographyMatchResponse,
)

FONT_SEARCH_PATHS = [
    os.path.join(os.path.dirname(__file__), "..", "..", "assets", "fonts"),
    "/System/Library/Fonts/Supplemental",
    "/System/Library/Fonts",
    "/Library/Fonts",
    "/usr/share/fonts/truetype",
    "/usr/share/fonts",
    os.path.expanduser("~/Library/Fonts"),
]

FONT_CATALOGUE = [
    {
        "family": "Inter",
        "category": "sans-serif",
        "is_serif": False,
        "weights": ["300", "400", "500", "600", "700", "800"],
        "regular_patterns": ["Inter-Regular.ttf", "Inter.ttf", "Arial.ttf", "SFNS.ttf", "Helvetica.ttc", "DejaVuSans.ttf"],
        "bold_patterns": ["Inter-Bold.ttf", "Arial Bold.ttf", "Helvetica-Bold.ttc", "DejaVuSans-Bold.ttf"],
        "aspect_factor": 0.58,
    },
    {
        "family": "Roboto",
        "category": "sans-serif",
        "is_serif": False,
        "weights": ["300", "400", "500", "700"],
        "regular_patterns": ["Roboto-Regular.ttf", "Roboto.ttf", "Arial.ttf", "DejaVuSans.ttf"],
        "bold_patterns": ["Roboto-Bold.ttf", "Arial Bold.ttf", "DejaVuSans-Bold.ttf"],
        "aspect_factor": 0.56,
    },
    {
        "family": "Montserrat",
        "category": "sans-serif",
        "is_serif": False,
        "weights": ["400", "500", "600", "700", "800"],
        "regular_patterns": ["Montserrat-Regular.ttf", "Montserrat.ttf", "Trebuchet MS.ttf", "Arial.ttf", "DejaVuSans.ttf"],
        "bold_patterns": ["Montserrat-Bold.ttf", "Trebuchet MS Bold.ttf", "Arial Bold.ttf"],
        "aspect_factor": 0.65,
    },
    {
        "family": "Outfit",
        "category": "sans-serif",
        "is_serif": False,
        "weights": ["400", "500", "600", "700"],
        "regular_patterns": ["Outfit-Regular.ttf", "Outfit.ttf", "Trebuchet MS.ttf", "Arial.ttf"],
        "bold_patterns": ["Outfit-Bold.ttf", "Trebuchet MS Bold.ttf", "Arial Bold.ttf"],
        "aspect_factor": 0.62,
    },
    {
        "family": "Open Sans",
        "category": "sans-serif",
        "is_serif": False,
        "weights": ["400", "600", "700"],
        "regular_patterns": ["OpenSans-Regular.ttf", "OpenSans.ttf", "Verdana.ttf", "Arial.ttf"],
        "bold_patterns": ["OpenSans-Bold.ttf", "Verdana Bold.ttf", "Arial Bold.ttf"],
        "aspect_factor": 0.60,
    },
    {
        "family": "Playfair Display",
        "category": "serif",
        "is_serif": True,
        "weights": ["400", "600", "700"],
        "regular_patterns": ["PlayfairDisplay-Regular.ttf", "PlayfairDisplay.ttf", "Georgia.ttf", "Times New Roman.ttf"],
        "bold_patterns": ["PlayfairDisplay-Bold.ttf", "Georgia Bold.ttf", "Times New Roman Bold.ttf"],
        "aspect_factor": 0.58,
    },
    {
        "family": "Georgia",
        "category": "serif",
        "is_serif": True,
        "weights": ["400", "700"],
        "regular_patterns": ["Georgia.ttf", "Times New Roman.ttf", "DejaVuSerif.ttf"],
        "bold_patterns": ["Georgia Bold.ttf", "Times New Roman Bold.ttf", "DejaVuSerif-Bold.ttf"],
        "aspect_factor": 0.61,
    },
    {
        "family": "Times New Roman",
        "category": "serif",
        "is_serif": True,
        "weights": ["400", "700"],
        "regular_patterns": ["Times New Roman.ttf", "Times.ttf", "DejaVuSerif.ttf"],
        "bold_patterns": ["Times New Roman Bold.ttf", "DejaVuSerif-Bold.ttf"],
        "aspect_factor": 0.54,
    },
    {
        "family": "Merriweather",
        "category": "serif",
        "is_serif": True,
        "weights": ["400", "700"],
        "regular_patterns": ["Merriweather-Regular.ttf", "Merriweather.ttf", "Georgia.ttf", "Times New Roman.ttf"],
        "bold_patterns": ["Merriweather-Bold.ttf", "Georgia Bold.ttf", "Times New Roman Bold.ttf"],
        "aspect_factor": 0.62,
    },
    {
        "family": "Courier Prime",
        "category": "monospace",
        "is_serif": True,
        "weights": ["400", "700"],
        "regular_patterns": ["Courier Prime.ttf", "Courier New.ttf", "Courier.dfont", "DejaVuSansMono.ttf"],
        "bold_patterns": ["Courier New Bold.ttf", "DejaVuSansMono-Bold.ttf"],
        "aspect_factor": 0.60,
    },
]

class TypographyService:
    _instance: Optional["TypographyService"] = None

    def __init__(self):
        self._font_cache: Dict[Tuple[str, int], ImageFont.FreeTypeFont] = {}
        self._resolved_paths: Dict[str, Optional[str]] = {}
        self._warmup_cache()

    @classmethod
    def get_instance(cls) -> "TypographyService":
        if cls._instance is None:
            cls._instance = TypographyService()
        return cls._instance

    def _resolve_font_file(self, patterns: List[str]) -> Optional[str]:
        cache_key = ":".join(patterns)
        if cache_key in self._resolved_paths:
            return self._resolved_paths[cache_key]

        for base in FONT_SEARCH_PATHS:
            if not os.path.isdir(base):
                continue
            for p in patterns:
                # Search directly in base and recursively in subfolders
                direct = os.path.join(base, p)
                if os.path.isfile(direct):
                    self._resolved_paths[cache_key] = direct
                    return direct
                matches = glob.glob(os.path.join(base, "**", p), recursive=True)
                if matches:
                    resolved = matches[0]
                    self._resolved_paths[cache_key] = resolved
                    return resolved

        self._resolved_paths[cache_key] = None
        return None

    def _warmup_cache(self):
        for entry in FONT_CATALOGUE:
            self._resolve_font_file(entry["regular_patterns"])
            self._resolve_font_file(entry["bold_patterns"])

    def _load_font(self, patterns: List[str], size: int) -> ImageFont.FreeTypeFont:
        font_path = self._resolve_font_file(patterns)
        cache_key = (font_path or "default", size)

        if cache_key in self._font_cache:
            return self._font_cache[cache_key]

        if font_path and os.path.exists(font_path):
            try:
                font = ImageFont.truetype(font_path, size)
                self._font_cache[cache_key] = font
                return font
            except Exception:
                pass

        # Scalable TTF fallback: Use bundled Inter font if specific font is not installed
        bundled_fallback = os.path.join(os.path.dirname(__file__), "..", "..", "assets", "fonts", "Inter-Regular.ttf")
        if os.path.exists(bundled_fallback):
            try:
                font = ImageFont.truetype(bundled_fallback, size)
                self._font_cache[cache_key] = font
                return font
            except Exception:
                pass

        font = ImageFont.load_default()
        self._font_cache[cache_key] = font
        return font

    @staticmethod
    def get_tight_crop(mask: np.ndarray) -> np.ndarray:
        """Trim binary mask to minimal bounding box of non-zero glyph pixels."""
        if mask is None or mask.size == 0:
            return mask
        pts = np.argwhere(mask > 50)
        if len(pts) == 0:
            return mask
        y1, x1 = pts.min(axis=0)
        y2, x2 = pts.max(axis=0) + 1
        return mask[y1:y2, x1:x2]

    def extract_text_mask(self, crop_bgr: np.ndarray) -> np.ndarray:
        """
        Extract clean binary text glyph mask from BGR image crop.
        Glyph pixels are 255 (white), background is 0 (black).
        """
        if crop_bgr is None or crop_bgr.size == 0:
            return np.zeros((32, 100), dtype=np.uint8)

        gray = cv2.cvtColor(crop_bgr, cv2.COLOR_BGR2GRAY)
        h, w = gray.shape

        _, otsu = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

        # Check borders to see if background is bright
        border_pixels = np.concatenate([
            gray[0, :],
            gray[h - 1, :],
            gray[:, 0],
            gray[:, w - 1]
        ])
        border_mean = float(np.mean(border_pixels))

        if border_mean > 127:
            mask = cv2.bitwise_not(otsu)
        else:
            mask = otsu

        mask = cv2.medianBlur(mask, 3)
        return mask

    def estimate_stroke_weight(
        self,
        mask: np.ndarray,
        font_size: float
    ) -> Tuple[float, str]:
        """
        Signal 1: Estimate stroke width via Euclidean distance transform peak medial axis.
        Returns (stroke_width_px, css_weight).
        """
        if mask is None or (mask == 255).sum() < 10:
            return 3.0, "400"

        dist = cv2.distanceTransform(mask, cv2.DIST_L2, 5)
        dist_vals = dist[dist > 0.5]

        if len(dist_vals) == 0:
            return 3.0, "400"

        stroke_radius = float(np.percentile(dist_vals, 92))
        stroke_width = max(1.0, 2.0 * stroke_radius)

        effective_h = max(12.0, font_size)
        tau = stroke_width / effective_h

        if tau < 0.10:
            weight = "300"
        elif tau < 0.14:
            weight = "400"
        elif tau < 0.17:
            weight = "500"
        elif tau < 0.21:
            weight = "600"
        elif tau < 0.26:
            weight = "700"
        else:
            weight = "800"

        return round(stroke_width, 1), weight

    def classify_serif(self, mask: np.ndarray) -> Tuple[bool, float]:
        """
        Signal 3: Serif vs Sans-serif classification using corner spur density
        relative to vertical stroke stems.
        Returns (is_serif, serif_confidence).
        """
        if mask is None or (mask == 255).sum() < 20:
            return False, 0.0

        mask_f = mask.astype(np.float32)
        dst = cv2.cornerHarris(mask_f, 2, 3, 0.04)

        if dst.max() <= 0:
            return False, 0.0

        corner_thresh = 0.05 * dst.max()
        corners = (dst > corner_thresh)

        total_white = max(1, int((mask == 255).sum()))
        total_corners = int(corners.sum())
        corner_density = total_corners / total_white

        # Calibrated threshold on text mask:
        # Sans-serif (Arial, Helvetica, Inter, Verdana) produces corner density 0.12 - 0.19.
        # Real serifs (Georgia, Times, Playfair, Merriweather) produce corner density 0.25 - 0.45.
        # Monospace serifs (Courier) produce corner density > 0.50.
        is_serif = corner_density > 0.22 and total_white > 120
        serif_confidence = min(1.0, max(0.0, (corner_density - 0.18) / 0.15))

        return is_serif, round(serif_confidence, 2)

    def render_candidate_mask(
        self,
        entry: Dict[str, Any],
        text: str,
        font_size: int,
        weight: str,
        target_size: Tuple[int, int]
    ) -> np.ndarray:
        """
        Render candidate text string into binary mask with target dimensions.
        """
        target_w, target_h = target_size
        target_w = max(10, target_w)
        target_h = max(10, target_h)

        patterns = entry["bold_patterns"] if int(weight) >= 600 else entry["regular_patterns"]
        font = self._load_font(patterns, font_size)

        img = Image.new("L", (target_w, target_h), 0)
        draw = ImageDraw.Draw(img)

        try:
            bbox = font.getbbox(text)
            text_w = bbox[2] - bbox[0]
            text_h = bbox[3] - bbox[1]
        except Exception:
            text_w, text_h = target_w, target_h

        pos_x = max(0, min(5, (target_w - text_w) // 2))
        pos_y = max(0, (target_h - text_h) // 2)

        draw.text((pos_x, pos_y), text, fill=255, font=font)
        return np.array(img, dtype=np.uint8)

    def match_typography(
        self,
        crop_bgr: np.ndarray,
        text: str,
        font_size_hint: Optional[float] = None,
        top_k: int = 5
    ) -> TypographyMatchResponse:
        start_time = time.perf_counter()

        if crop_bgr is None or crop_bgr.size == 0 or not text.strip():
            return TypographyMatchResponse(
                status="success",
                detectedWeight="400",
                detectedSerif=False,
                estimatedStrokeWidth=3.0,
                candidates=[],
                processingTimeMs=0.0
            )

        orig_h, orig_w = crop_bgr.shape[:2]
        effective_font_size = font_size_hint if font_size_hint and font_size_hint > 8 else float(orig_h * 0.75)

        # 1. Extract clean binary mask
        orig_mask = self.extract_text_mask(crop_bgr)
        tight_orig = self.get_tight_crop(orig_mask)

        # Signal 1: Stroke width & Weight
        stroke_width, detected_weight = self.estimate_stroke_weight(orig_mask, effective_font_size)

        # Signal 3: Serif vs Sans classification
        detected_serif, serif_conf = self.classify_serif(orig_mask)

        # Canonical resize size for contour correlation
        canonical_h = 48
        canonical_w = max(48, int(round(canonical_h * (orig_w / max(1, orig_h)))))
        canonical_orig = cv2.resize(tight_orig, (canonical_w, canonical_h), interpolation=cv2.INTER_AREA)
        orig_f = (canonical_orig > 80).astype(np.float32)
        norm_orig = float(np.sqrt(np.sum(orig_f ** 2))) + 1e-6

        candidates: List[FontCandidate] = []
        det_weight_num = int(detected_weight)

        for entry in FONT_CATALOGUE:
            family = entry["family"]
            category = entry["category"]
            is_serif_font = entry["is_serif"]

            # Choose closest available weight
            avail_weights = [int(w) for w in entry["weights"]]
            best_weight_num = min(avail_weights, key=lambda w: abs(w - det_weight_num))
            cand_weight = str(best_weight_num)

            # Signal 1: Weight similarity
            weight_diff = abs(det_weight_num - best_weight_num)
            weight_sim = max(0.2, 1.0 - (weight_diff / 500.0))

            # Signal 2: Aspect ratio & line length
            expected_aspect = entry.get("aspect_factor", 0.58) * len(text)
            actual_aspect = orig_w / max(1, orig_h)
            aspect_diff = abs(actual_aspect - expected_aspect) / max(actual_aspect, expected_aspect)
            aspect_sim = max(0.1, 1.0 - min(1.0, aspect_diff))

            # Signal 3: Serif classification match (soft penalty)
            if is_serif_font == detected_serif:
                serif_sim = 0.95
            else:
                serif_sim = 0.55

            # Signal 4: Contour cross-correlation on tight crops (primary ground-truth)
            cand_mask = self.render_candidate_mask(
                entry=entry,
                text=text,
                font_size=int(round(effective_font_size)),
                weight=cand_weight,
                target_size=(orig_w, orig_h)
            )
            tight_cand = self.get_tight_crop(cand_mask)
            canonical_cand = cv2.resize(tight_cand, (canonical_w, canonical_h), interpolation=cv2.INTER_AREA)
            cand_f = (canonical_cand > 80).astype(np.float32)
            norm_cand = float(np.sqrt(np.sum(cand_f ** 2))) + 1e-6

            dot_product = float(np.sum(orig_f * cand_f))
            contour_sim = max(0.0, min(1.0, dot_product / (norm_orig * norm_cand)))

            # Composite weighted confidence: contour cross-correlation is primary visual signal
            confidence = (
                0.55 * contour_sim +
                0.25 * aspect_sim +
                0.15 * weight_sim +
                0.05 * serif_sim
            )
            confidence = max(0.05, min(0.99, confidence))

            # Letter spacing recommendation
            try:
                patterns = entry["bold_patterns"] if best_weight_num >= 600 else entry["regular_patterns"]
                fnt = self._load_font(patterns, int(round(effective_font_size)))
                bbox = fnt.getbbox(text)
                cand_rendered_w = bbox[2] - bbox[0]
            except Exception:
                cand_rendered_w = orig_w

            delta_w = float(orig_w - cand_rendered_w)
            char_count = max(1, len(text) - 1)
            letter_spacing = max(-5.0, min(15.0, round(delta_w / char_count, 1)))

            candidate = FontCandidate(
                family=family,
                weight=cand_weight,
                category=category,
                confidence=round(confidence, 3),
                letterSpacing=letter_spacing,
                fontSize=round(effective_font_size, 1),
                signals=TypographySignalBreakdown(
                    contourSimilarity=round(contour_sim, 3),
                    aspectSimilarity=round(aspect_sim, 3),
                    weightSimilarity=round(weight_sim, 3),
                    serifMatch=round(serif_sim, 3)
                )
            )
            candidates.append(candidate)

        candidates.sort(key=lambda c: c.confidence, reverse=True)
        top_candidates = candidates[:top_k]

        elapsed_ms = round((time.perf_counter() - start_time) * 1000.0, 1)

        return TypographyMatchResponse(
            status="success",
            detectedWeight=detected_weight,
            detectedSerif=detected_serif,
            estimatedStrokeWidth=stroke_width,
            candidates=top_candidates,
            processingTimeMs=elapsed_ms
        )
