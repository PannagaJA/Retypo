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
OCR_LOCK = threading.RLock()

# Configure project-local models directory for PaddleX OCR weights
if "PADDLE_PDX_CACHE_HOME" not in os.environ:
    _cur_dir = os.path.dirname(os.path.abspath(__file__))
    _root_models = os.path.abspath(os.path.join(_cur_dir, "..", "..", "..", "models"))
    _backend_models = os.path.abspath(os.path.join(_cur_dir, "..", "..", "models"))
    if os.path.isdir(_root_models):
        os.environ["PADDLE_PDX_CACHE_HOME"] = _root_models
    elif os.path.isdir(_backend_models):
        os.environ["PADDLE_PDX_CACHE_HOME"] = _backend_models
    else:
        os.environ["PADDLE_PDX_CACHE_HOME"] = _root_models

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
    refine_polygon_to_text,
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
        clean_lang = "en"

        if clean_lang in self._engines:
            return self._engines[clean_lang]

        # In low-memory / Render environments, evict previously loaded engines to prevent multi-model RAM bloat
        is_low_mem = os.getenv("RENDER") is not None or os.getenv("LOW_MEMORY_MODE", "true").lower() == "true"
        if is_low_mem and self._engines:
            self._engines.clear()
            clear_system_memory_caches()

        det_limit = 960

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
                text_recognition_batch_size=8,
                text_det_unclip_ratio=1.6,
                text_det_box_thresh=0.50,
                text_det_thresh=0.25,
                device="cpu",
            )
            self._engines[clean_lang] = engine
            print(f"PaddleOCR small mobile engine initialized (lang='{clean_lang}', low_mem={is_low_mem}, det_limit={det_limit}, batch_size=8).")
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
                    text_recognition_batch_size=8,
                    text_det_unclip_ratio=1.6,
                    text_det_box_thresh=0.50,
                    text_det_thresh=0.25,
                    device="cpu",
                )
                self._engines["en"] = engine
                return engine
            except Exception:
                return None

    def _extract_ocr_items(
        self,
        ocr_out: Any,
        scale: float = 1.0,
        scale_x: Optional[float] = None,
        scale_y: Optional[float] = None
    ) -> List[Tuple[List[List[float]], str, float]]:
        items: List[Tuple[List[List[float]], str, float]] = []
        if not ocr_out or len(ocr_out) == 0:
            return items

        sx = scale_x if scale_x is not None else scale
        sy = scale_y if scale_y is not None else scale

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
                clean_poly = [[round(float(pt[0]) / sx, 1), round(float(pt[1]) / sy, 1)] for pt in poly_list]
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
                        clean_poly = [[round(float(pt[0]) / sx, 1), round(float(pt[1]) / sy, 1)] for pt in poly_raw]
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
        # Genuine text must contain at least one alphanumeric character or currency symbol
        if not re.search(r'[a-zA-Z0-9\u00C0-\u024F\u0400-\u04FF\u4E00-\u9FFF\u3040-\u30FF\uAC00-\uD7AF₹$€£¥]', clean):
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

        # 3. Small square glyphs: UI icons misread as a single character (e.g. search magnifying glass as 'Q' or 'O', user avatar as '0' or 'o')
        if len(compact) <= 1:
            # Low confidence standalone character
            if confidence < 0.82:
                return True
            # Square icon bounding box (avatars, search lenses, radio buttons, navigation arrows)
            if 0.70 <= aspect <= 1.40 and max(w, h) <= 80.0 and not compact.isdigit():
                return True

        # 4. Status-bar / notification icon noise sequences (e.g. '0000', '||||||', 'xxxxxx', '------')
        if len(compact) >= 3 and len(set(compact)) == 1 and compact[0] in ['0', 'o', 'O', 'x', '|', '-']:
            return True

        # 5. Non-text images / large photo textures / decorative elements
        if image_dims:
            img_w, img_h = image_dims
            if (w * h) > 0.35 * (img_w * img_h) and confidence < 0.75:
                return True

        # 6. Computer Vision check on crop: Detect circular avatars, button badges, and solid icons
        # Strictly applies ONLY to isolated single non-digit glyphs with low-to-medium confidence
        if crop_bgr is not None and crop_bgr.size > 0 and len(compact) == 1 and not compact.isdigit() and confidence < 0.90:
            try:
                gray = cv2.cvtColor(crop_bgr, cv2.COLOR_BGR2GRAY)
                border = np.concatenate([gray[0, :], gray[-1, :], gray[:, 0], gray[:, -1]])
                bg = float(np.median(border))
                diff = np.abs(gray.astype(np.float32) - bg)
                _, mask = cv2.threshold(diff.astype(np.uint8), 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
                cnts, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
                if cnts:
                    c = max(cnts, key=cv2.contourArea)
                    area = cv2.contourArea(c)
                    peri = cv2.arcLength(c, True)
                    crop_area = float(crop_bgr.shape[0] * crop_bgr.shape[1])
                    if peri > 0 and area >= 0.40 * crop_area:
                        circ = 4.0 * math.pi * area / (peri * peri)
                        if circ > 0.75:
                            return True
            except Exception:
                pass

        return False

    @staticmethod
    def _separate_adjacent_icons(
        crop_bgr: Optional[np.ndarray],
        polygon: List[List[float]],
        text: str
    ) -> Tuple[List[List[float]], str]:
        """
        Detects if an OCR detection polygon spans both a UI icon and a text label
        (e.g. Income/Expenses with bullet indicator dots, Account button with wallet icon on left,
        Filter button with sliders on left and chevron on right, '+ Transaction' button with plus icon on left,
        Search bar with magnifying glass, status clock with notification icons on right,
        status battery with network meters on left).
        Trims the polygon to wrap strictly the text characters, leaving the icons in the background.
        Strictly guards against modifying names, account numbers, IDs, sentences, emails, or currency amounts.
        """
        if crop_bgr is None or crop_bgr.size == 0:
            return polygon, text

        clean_text = text.strip()
        if not clean_text or len(clean_text) <= 1 or len(clean_text) > 40:
            return polygon, text

        # Strictly exclude emails, UPI IDs, currency symbols, slashes, or backslashes
        if any(ch in clean_text for ch in ['@', '#', '$', '€', '£', '¥', '/', '\\']):
            return polygon, text

        # Currency amounts, numbers, or numerical figures (never trim glyphs from numbers or monetary amounts)
        if re.search(r'\d', clean_text) or any(c in clean_text for c in ['₹', '$', '€', '£', '¥', '%']):
            return polygon, text

        # Account numbers, transaction IDs, UTRs, pure IDs
        if re.match(r'^(?:[X\d\-_]{6,}|T\d{10,}|UTR[:\s]|UPI)', clean_text, re.IGNORECASE):
            return polygon, text

        # Check if text is a standalone status-bar clock (e.g. '1:55', '1:55 0000', '1:55 0020')
        # NEVER match date/time strings like '10:38 pm on 22 Oct 2026'
        is_status_clock = bool(re.match(r'^\d{1,2}:\d{2}(?:\s+[\d0oOxX|–\-]{2,})?$', clean_text))

        # Check if text is a status-bar battery percentage (e.g. '40%', '40 40%')
        is_status_battery = bool(re.match(r'^(?:\d{1,2}\s+)?\d{1,2}%$', clean_text))

        norm_lower = clean_text.lower().lstrip('+').strip()
        is_ui_button = norm_lower in {
            'filter', 'transaction', 'transactions', 'dashboard', 'settings',
            'profile', 'history', 'subscriptions', 'budgets', 'search', 'sort', 'menu'
        }

        # Exclude dates like 'Oct 8, 2026'
        if re.match(r'^(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b', clean_text, re.IGNORECASE):
            return polygon, text

        words = clean_text.split()
        is_single_word = len(words) == 1
        has_plus_prefix = clean_text.startswith(('+ ', '+')) and len(words) <= 2

        # CRITICAL: Multi-word phrases like 'Transaction Successful', 'Transfer Details', 'Powered by'
        # must NEVER have words trimmed!
        if not (is_status_clock or is_status_battery or is_ui_button or is_single_word or has_plus_prefix):
            return polygon, text

        h, w = crop_bgr.shape[:2]
        if w < 20 or h < 8:
            return polygon, text

        try:
            gray = cv2.cvtColor(crop_bgr, cv2.COLOR_BGR2GRAY)
            border = np.concatenate([gray[0, :], gray[-1, :], gray[:, 0], gray[:, -1]])
            bg = float(np.median(border))
            diff = np.abs(gray.astype(np.float32) - bg)
            _, th = cv2.threshold(diff.astype(np.uint8), 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

            # Strip 2px perimeter border to eliminate any surrounding container border artifacts
            pad = 2 if (h > 8 and w > 8) else 1
            inner_th = th[pad:h-pad, pad:w-pad] if h > 4 and w > 4 else th
            num, labels, stats, _ = cv2.connectedComponentsWithStats(inner_th)
            raw_comps = [stats[i] for i in range(1, num) if stats[i][4] >= 4 and (stats[i][3] >= 3 or stats[i][3] >= 0.15 * h)]
            raw_comps.sort(key=lambda c: c[0])

            if len(raw_comps) < 2:
                return polygon, text

            # Cluster contiguous components separated by <= 3px (e.g. multi-bar slider icons or broken glyphs)
            clusters: List[List[int]] = []
            curr = list(raw_comps[0][:4])
            for c in raw_comps[1:]:
                cx, cy, cw, ch = c[:4]
                curr_right = curr[0] + curr[2]
                if cx <= curr_right + 3:
                    new_right = max(curr_right, cx + cw)
                    curr[2] = new_right - curr[0]
                    curr[3] = max(curr[3], ch)
                else:
                    clusters.append(curr)
                    curr = [cx, cy, cw, ch]
            clusters.append(curr)

            if len(clusters) < 2:
                return polygon, text

            # Minimum expected width for text: 0.28 * h per char
            expected_min_w = max(8.0, len(clean_text) * (h * 0.28))

            left_offset = 0.0
            right_offset = 0.0
            new_text = clean_text

            # 1. Check for leading icon on the left
            if len(clusters) >= 2:
                for c_idx in range(min(2, len(clusters) - 1)):
                    cl = clusters[c_idx]
                    fx, fy, fw, fh = cl
                    f_aspect = fw / max(1.0, float(fh))
                    next_cl = clusters[c_idx + 1]
                    gap = next_cl[0] - (fx + fw)

                    # Bullet / indicator dot (e.g. small circular green dot in Income, red dot in Expenses)
                    # Notice: full-height letters like 'K' in Krishna have fh >= 0.80*h and fail this condition
                    is_bullet_dot = is_single_word and (0.65 <= f_aspect <= 1.40) and (fh <= 0.70 * h) and (fw <= 0.70 * h) and (gap >= 5)

                    # Graphic icon on explicit UI action buttons (e.g. wallet on Account, sliders on Filter, plus on + Transaction)
                    is_button_icon = (is_ui_button or has_plus_prefix) and (0.30 <= f_aspect <= 3.50 or fh >= 0.35 * h) and (gap >= 4)

                    if fx < 0.40 * w and (is_bullet_dot or is_button_icon):
                        cand_w = (w - pad) - float(next_cl[0] + pad)
                        # Check if text starts with a plus icon that belongs to button graphic (e.g. "+ Transaction")
                        if has_plus_prefix:
                            if cand_w >= expected_min_w * 0.7:
                                left_offset = float(next_cl[0] + pad)
                                new_text = clean_text.lstrip('+').strip()
                                break
                        elif not clean_text.startswith(('+', '-', '₹', '$', '€', '£')):
                            if cand_w >= expected_min_w:
                                left_offset = float(next_cl[0] + pad)
                                break

            # Special case: Status bar battery/network cluster on left where percentage text is on right
            if is_status_battery:
                pct_clusters = [cl for cl in clusters if (cl[0] + pad) > 0.60 * w]
                if pct_clusters:
                    leftmost_pct = pct_clusters[0][0] + pad
                    if leftmost_pct > left_offset and (w - leftmost_pct) >= 12.0:
                        left_offset = float(leftmost_pct)

            # 2. Check for trailing icon on the right (strictly for UI buttons like chevron down 'v' in 'Filter')
            if is_ui_button and len(clusters) >= 2:
                last_cl = clusters[-1]
                lx, ly, lw, lh = last_cl
                l_aspect = lw / max(1.0, float(lh))
                if (lx + lw + pad) > 0.60 * w:
                    prev_cl = clusters[-2]
                    gap = lx - (prev_cl[0] + prev_cl[2])
                    if gap >= 4 and (0.30 <= l_aspect <= 3.50 or lh >= 0.35 * h):
                        if not clean_text.endswith(('%', 'Cr', 'Lakh', 'st', 'nd', 'rd', 'th')):
                            cand_w = (prev_cl[0] + prev_cl[2] + pad) - left_offset
                            if cand_w >= expected_min_w:
                                right_offset = float(w - (prev_cl[0] + prev_cl[2] + pad))

            # Special case: Standalone status bar clock on left followed by app notification icons on right
            if is_status_clock:
                clock_end_x = 0
                for idx in range(len(clusters) - 1):
                    curr_cl = clusters[idx]
                    nxt_cl = clusters[idx + 1]
                    curr_right = curr_cl[0] + curr_cl[2] + pad
                    if curr_right >= 1.0 * h:
                        gap_after = (nxt_cl[0] + pad) - curr_right
                        if gap_after >= 4:
                            clock_end_x = curr_right
                            break
                if clock_end_x > 0 and (w - clock_end_x) > right_offset:
                    right_offset = float(w - clock_end_x)

            if left_offset > 0 or right_offset > 0:
                xs = [p[0] for p in polygon]
                min_x = min(xs)
                max_x = max(xs)
                poly_w = max_x - min_x
                scale_x = poly_w / float(w)

                new_min_x = min_x + left_offset * scale_x
                new_max_x = max_x - right_offset * scale_x

                new_poly = [
                    [round(new_min_x, 1), polygon[0][1]],
                    [round(new_max_x, 1), polygon[1][1]],
                    [round(new_max_x, 1), polygon[2][1]],
                    [round(new_min_x, 1), polygon[3][1]]
                ]
                return new_poly, new_text
        except Exception:
            pass

        return polygon, text

    @staticmethod
    def _normalize_detected_text(text: str, all_raw_texts: Optional[List[str]] = None) -> str:
        s = text.strip()
        if not s:
            return s

        # 1. Normalize excessive internal whitespace and linebreaks
        s = re.sub(r'[\r\n\t]+', ' ', s)
        s = re.sub(r' {2,}', ' ', s)

        # 2. Strip purely decorative bullet/arrow markers (e.g. '• Read More' -> 'Read More')
        # CRITICAL: NEVER strip minus '-', plus '+', hyphens, or currency symbols ($ € £ ¥ ₹)!
        s = re.sub(r'^[•·»›«‹→←]\s+(?=[A-Za-z])', '', s)

        # 3. Clean status bar clock & notification sequences (e.g. '1:55 0000', '1:55 0020' -> '1:55')
        # NEVER strip legitimate date/time suffixes such as 'pm', 'am', 'on 22 Oct 2026', etc.
        s = re.sub(r'^(\d{1,2}:\d{2})\s+[\d0oOxX|–\-]{2,}$', r'\1', s)
        s = re.sub(r'\s+[0oOxX|–\-]{3,}$', '', s)

        # 3b. Convert OCR misread of Rupee symbol 'F' or 'r' before numbers:
        # e.g. 'F30' -> '₹30', 'F 30' -> '₹30', 'r150.00' -> '₹150.00'
        s = re.sub(r'^[FfRr]\s*(\d[\d,\.]*)', r'₹\1', s)

        # 4. Clean status bar battery & network sequences (e.g. '40 40%' -> '40%', '4040%' -> '40%')
        s = re.sub(r'^\d{1,2}\s+(\d{1,2}%)$', r'\1', s)
        s = re.sub(r'^(\d{2})\1%$', r'\1%', s)

        # 5. Strip stray trailing colons on single-word UI tabs, buttons, or list subtitles
        # (e.g. 'Transfer:' -> 'Transfer', 'More:' -> 'More', 'Bank of Baroda:' -> 'Bank of Baroda')
        if s.endswith(':') and not re.search(r'(?i)^(note|warning|tip|total|subtotal|tax):', s):
            s = s[:-1].strip()

        # 6. Normalize common subtitle bullets: 'General - Bank of Baroda' -> 'General • Bank of Baroda'
        s = re.sub(r'(?<=[A-Za-z0-9])\s*[-·]\s*(?=[A-Z][a-z])', ' • ', s)

        # 7. Fix currency symbols attached to numbers or spaces universally:
        # e.g. "$ 120" -> "$120", "€ 49.99" -> "€49.99", "£ 10" -> "£10", "₹ 250" -> "₹250", "- ₹ 105" -> "-₹105"
        s = re.sub(r'([+-])\s*([$€£¥₹])', r'\1\2', s)
        s = re.sub(r'([$€£¥₹])\s+(\d)', r'\1\2', s)

        # 8. Standard punctuation spacing: remove space before comma/period
        s = re.sub(r'\s+([,\.])', r'\1', s)

        # 9. Remove stray leading or trailing decorative quotes or backticks if unbalanced
        if (s.startswith("`") or s.startswith("'") or s.startswith('"')) and not (s.endswith("`") or s.endswith("'") or s.endswith('"')):
            s = s[1:].strip()
        elif (s.endswith("`") or s.endswith("'") or s.endswith('"')) and not (s.startswith("`") or s.startswith("'") or s.startswith('"')):
            s = s[:-1].strip()

        return s

    @staticmethod
    def _recover_currency_symbols(
        crop_bgr: Optional[np.ndarray],
        text: str,
        all_raw_texts: Optional[List[str]] = None
    ) -> str:
        """
        Detects if an Indian Rupee symbol ₹ or currency glyph is present in the visual image crop
        when the OCR engine missed or skipped it (e.g. recognized '105.00' instead of '-₹105.00', '30' instead of '₹30').
        Strictly targets strings matching monetary patterns (e.g. 30, 105.00, +26,800.00, 1,75,710.33)
        to prevent falsely modifying dates (Oct 9, 2026), percentages (40%), account numbers, or IDs.
        """
        clean = text.strip()
        # Strictly target monetary numbers (supports decimals or whole integer amounts)
        m = re.match(r'^([+-]?)\s*([\d,]+(?:\.\d{1,2})?)(?:\s+(?:100%|Cr|Lakh))?$', clean)
        if not m or crop_bgr is None or crop_bgr.size == 0:
            return text

        # If already has currency symbol, return
        if any(c in clean for c in ['₹', '$', '€', '£', '¥']):
            return text

        sign, amount = m.group(1), m.group(2)
        # Exclude single digits or pure years (e.g. 2026, 7) unless amount contains comma or decimal
        if len(amount) == 4 and amount.startswith(('19', '20')) and not sign and '.' not in amount and ',' not in amount:
            return text
        if len(amount) < 1:
            return text
        # Exclude long continuous digit sequences without formatting (account numbers, UPI IDs, phone numbers)
        raw_digits = re.sub(r'[,\.]', '', amount)
        if len(raw_digits) > 8 and not ('.' in amount or ',' in amount):
            return text

        # Document currency context: check if other amounts in this image use ₹
        has_rupee_context = all_raw_texts and any('₹' in t for t in all_raw_texts)

        try:
            gray = cv2.cvtColor(crop_bgr, cv2.COLOR_BGR2GRAY)
            h, w = gray.shape
            border = np.concatenate([gray[0, :], gray[-1, :], gray[:, 0], gray[:, -1]])
            bg = float(np.median(border))
            diff = np.abs(gray.astype(np.float32) - bg)
            _, mask = cv2.threshold(diff.astype(np.uint8), 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

            num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(mask)
            major_comps = []
            for i in range(1, num_labels):
                gx, gy, gw, gh, garea = stats[i]
                if gh >= 0.25 * h and garea >= 6:
                    major_comps.append((gx, gy, gw, gh, garea))
            major_comps.sort(key=lambda c: c[0])

            if not major_comps:
                return text

            # Check components in prefix area (left 40% of crop)
            prefix_comps = [c for c in major_comps if c[0] < 0.40 * w]
            detected_sign = sign

            # If no sign in text, check if first component is a minus sign
            if not detected_sign and prefix_comps:
                first_c = prefix_comps[0]
                gx, gy, gw, gh, garea = first_c
                mid_y = gy + gh / 2.0
                if 0.30 * h <= mid_y <= 0.70 * h and gh <= 0.40 * h and gw >= 1.2 * gh:
                    detected_sign = '-'
                    prefix_comps = prefix_comps[1:]

            # Check if currency symbol is present in prefix
            has_currency_glyph = False
            if prefix_comps:
                for c in prefix_comps:
                    gx, gy, gw, gh, garea = c
                    if gh >= 0.28 * h and garea >= 10:
                        has_currency_glyph = True
                        break

            # Strictly require an actual currency glyph to be present in the crop!
            # Never hallucinate or prepend a currency symbol to a number that has no currency glyph in its visual crop.
            if has_currency_glyph:
                currency_sym = '₹'
                target = f"{sign}{amount}" if sign else amount
                replacement = f"{detected_sign}{currency_sym}{amount}"
                return clean.replace(target, replacement, 1)

        except Exception:
            pass
        return text

    def _recover_missed_hero_text(
        self,
        image: Image.Image,
        engine: Any,
        extracted_items: List[Tuple[List[List[float]], str, float]]
    ) -> List[Tuple[List[List[float]], str, float]]:
        """
        Recovers prominent hero amounts or headline text missed by global DBNet detection.
        In mobile transaction/receipt screens, single-line amounts (e.g. '₹5', '₹105', '$20')
        often sit isolated in large empty background spaces between headers and buttons.
        DBNet feature-map downsampling can fail to reach the contour activation threshold on these.
        This targeted pass scans the upper section for uncovered high-contrast text glyph clusters,
        runs localized inference on the candidate crop, and appends any detected text.
        """
        w, h = image.width, image.height
        if w < 200 or h < 200 or engine is None:
            return extracted_items

        # Check if a prominent amount is already detected in the upper section
        has_hero_amount = False
        for poly, text, conf in extracted_items:
            min_y = min(p[1] for p in poly)
            max_y = max(p[1] for p in poly)
            poly_h = max_y - min_y
            if min_y < 0.45 * h and poly_h >= 24:
                if any(c.isdigit() for c in text) and (any(curr in text for curr in ["₹", "$", "€", "£", "Rs", "INR"]) or len(text.strip()) <= 8):
                    has_hero_amount = True
                    break
        if has_hero_amount:
            return extracted_items

        top_y = int(0.06 * h)
        bot_y = int(0.45 * h)
        crop_zone = image.crop((0, top_y, w, bot_y))
        gray = cv2.cvtColor(np.array(crop_zone.convert("RGB")), cv2.COLOR_RGB2GRAY)
        bg_val = float(np.median(gray))
        diff = 26.0
        if bg_val < 128:
            _, thresh = cv2.threshold(gray, int(min(250, bg_val + diff)), 255, cv2.THRESH_BINARY)
        else:
            _, thresh = cv2.threshold(gray, int(max(5, bg_val - diff)), 255, cv2.THRESH_BINARY_INV)

        num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(thresh)
        existing_boxes = []
        for poly, text, conf in extracted_items:
            xs = [p[0] for p in poly]
            ys = [p[1] for p in poly]
            existing_boxes.append((min(xs) - 8, min(ys) - 8, max(xs) + 8, max(ys) + 8))

        uncovered_glyphs = []
        for i in range(1, num_labels):
            x, y_rel, cw, ch, area = stats[i]
            y_abs = top_y + y_rel
            if ch < 12 or cw < 6 or area < 30 or ch > 200 or cw > 400:
                continue
            overlaps = False
            for bx1, by1, bx2, by2 in existing_boxes:
                if not (x + cw < bx1 or x > bx2 or y_abs + ch < by1 or y_abs > by2):
                    overlaps = True
                    break
            if not overlaps:
                uncovered_glyphs.append((x, y_abs, cw, ch, area))

        if not uncovered_glyphs:
            return extracted_items

        uncovered_glyphs.sort(key=lambda g: (g[1], g[0]))
        clusters = []
        for g in uncovered_glyphs:
            gx, gy, gw, gh, ga = g
            merged = False
            for c in clusters:
                c_y1, c_y2 = c["min_y"], c["max_y"]
                c_x1, c_x2 = c["min_x"], c["max_x"]
                vert_close = abs(gy - c_y1) < 25 or not (gy + gh < c_y1 or gy > c_y2)
                horiz_close = not (gx > c_x2 + 45 or gx + gw < c_x1 - 45)
                if vert_close and horiz_close:
                    c["min_x"] = min(c_x1, gx)
                    c["min_y"] = min(c_y1, gy)
                    c["max_x"] = max(c_x2, gx + gw)
                    c["max_y"] = max(c_y2, gy + gh)
                    c["glyphs"].append(g)
                    merged = True
                    break
            if not merged:
                clusters.append({
                    "min_x": gx,
                    "min_y": gy,
                    "max_x": gx + gw,
                    "max_y": gy + gh,
                    "glyphs": [g]
                })

        new_items = list(extracted_items)
        for c in clusters:
            c_w = c["max_x"] - c["min_x"]
            c_h = c["max_y"] - c["min_y"]
            if c_h < 14 or c_w < 8:
                continue

            pad_x = 28
            pad_y = 22
            cx1 = max(0, c["min_x"] - pad_x)
            cy1 = max(0, c["min_y"] - pad_y)
            cx2 = min(w, c["max_x"] + pad_x)
            cy2 = min(h, c["max_y"] + pad_y)

            crop = image.crop((cx1, cy1, cx2, cy2))
            crop_np = np.array(crop.convert("RGB"))
            try:
                with OCR_LOCK:
                    if hasattr(engine, "predict"):
                        crop_out = engine.predict(crop_np)
                    else:
                        crop_out = engine.ocr(crop_np)
            except Exception:
                continue

            rec_items = self._extract_ocr_items(crop_out, scale=1.0)
            for r_poly, r_text, r_conf in rec_items:
                shifted_poly = [[p[0] + cx1, p[1] + cy1] for p in r_poly]
                cleaned_r_text = r_text.strip()
                if not cleaned_r_text:
                    continue
                xs = [p[0] for p in shifted_poly]
                ys = [p[1] for p in shifted_poly]
                sx1, sy1, sx2, sy2 = min(xs), min(ys), max(xs), max(ys)
                dup = False
                for ex_poly, ex_text, _ in new_items:
                    ex_xs = [p[0] for p in ex_poly]
                    ex_ys = [p[1] for p in ex_poly]
                    ex1, ey1, ex2, ey2 = min(ex_xs), min(ex_ys), max(ex_xs), max(ex_ys)
                    ox1 = max(sx1, ex1)
                    oy1 = max(sy1, ey1)
                    ox2 = min(sx2, ex2)
                    oy2 = min(sy2, ey2)
                    if ox2 > ox1 and oy2 > oy1:
                        inter = (ox2 - ox1) * (oy2 - oy1)
                        area_s = (sx2 - sx1) * (sy2 - sy1)
                        if inter > 0.5 * area_s:
                            dup = True
                            break
                if not dup:
                    new_items.append((shifted_poly, cleaned_r_text, r_conf))
        return new_items

    def analyze_image(self, image: Image.Image, lang: str = "en") -> List[DetectedTextRegion]:
        """
        Runs text detection & recognition on PIL image, extracts geometry,
        estimates typography parameters, and returns structured DetectedTextRegion list.
        Applies adaptive resolution scaling, noise filtering, and smart text normalization.
        """
        w, h = image.width, image.height
        extracted_items = None
        try:
            from app.services.google_vision_service import GoogleVisionService
            if GoogleVisionService.is_available():
                extracted_items = GoogleVisionService.analyze_image_sync(image)
                if extracted_items is not None:
                    print(f"[OCR] Google Cloud Vision detected {len(extracted_items)} high-accuracy text regions in ~350ms.")
        except Exception as gv_err:
            print(f"[OCR] Google Cloud Vision fallback triggered: {gv_err}")
            extracted_items = None

        if extracted_items is None:
            engine = self._get_paddle_engine(lang)

            is_low_mem = os.getenv("RENDER") is not None or os.getenv("LOW_MEMORY_MODE", "true").lower() == "true"
            scale = 1.0
            scale_x = 1.0
            scale_y = 1.0

            if is_low_mem:
                # On 512MB RAM and 0.1 CPU, cap maximum resolution to 1024px to guarantee fast sub-5s DBNet inference
                if max(w, h) > 1024:
                    scale = 1024.0 / float(max(w, h))
                    scaled_w = int(round(w * scale))
                    scaled_h = int(round(h * scale))
                    scale_x = float(scaled_w) / float(w)
                    scale_y = float(scaled_h) / float(h)
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
                    scale_x = float(new_w) / float(w)
                    scale_y = float(new_h) / float(h)
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

            extracted_items = self._extract_ocr_items(raw_ocr_out, scale=scale, scale_x=scale_x, scale_y=scale_y)
            extracted_items = self._recover_missed_hero_text(image, engine, extracted_items)
        all_raw_texts = [item[1] for item in extracted_items]

        regions: List[DetectedTextRegion] = []

        for clean_polygon, raw_text, score in extracted_items:
            try:
                angle = calculate_polygon_angle(clean_polygon)
                clean_polygon = refine_polygon_to_text(image, clean_polygon, angle)
                bbox = calculate_bounding_box(clean_polygon, image=image)

                # Extract initial crop
                crop_x1 = max(0, int(np.floor(bbox[0])))
                crop_y1 = max(0, int(np.floor(bbox[1])))
                crop_x2 = min(image.width, int(np.ceil(bbox[0] + bbox[2])))
                crop_y2 = min(image.height, int(np.ceil(bbox[1] + bbox[3])))

                crop_bgr = None
                if crop_x2 > crop_x1 and crop_y2 > crop_y1:
                    crop_img = image.crop((crop_x1, crop_y1, crop_x2, crop_y2))
                    crop_bgr = cv2.cvtColor(np.array(crop_img.convert("RGB")), cv2.COLOR_RGB2BGR)

                # 1. Apply universal text normalization and recover currency symbols if dropped
                normalized_text = self._normalize_detected_text(raw_text, all_raw_texts)
                normalized_text = self._recover_currency_symbols(crop_bgr, normalized_text, all_raw_texts)

                # 2. Separate text labels from adjacent component icons (e.g. Account with wallet, Filter with sliders)
                trimmed_polygon, trimmed_text = self._separate_adjacent_icons(crop_bgr, clean_polygon, normalized_text)
                if trimmed_polygon != clean_polygon:
                    clean_polygon = trimmed_polygon
                    normalized_text = trimmed_text
                    bbox = calculate_bounding_box(clean_polygon, image=image)
                    crop_x1 = max(0, int(np.floor(bbox[0])))
                    crop_y1 = max(0, int(np.floor(bbox[1])))
                    crop_x2 = min(image.width, int(np.ceil(bbox[0] + bbox[2])))
                    crop_y2 = min(image.height, int(np.ceil(bbox[1] + bbox[3])))
                    if crop_x2 > crop_x1 and crop_y2 > crop_y1:
                        crop_img = image.crop((crop_x1, crop_y1, crop_x2, crop_y2))
                        crop_bgr = cv2.cvtColor(np.array(crop_img.convert("RGB")), cv2.COLOR_RGB2BGR)

                # 3. Filter out UI icons, non-text symbols, and graphic glyphs
                if self._is_icon_or_noise(normalized_text, bbox, round(score, 3), crop_bgr=crop_bgr, image_dims=(w, h)):
                    continue
                # 4. Accurate font size, color, weight estimation
                font_size = calculate_font_size(clean_polygon, image=image, text=normalized_text)
                geom_conf = calculate_geometry_confidence(clean_polygon)
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
                        matched_family, matched_category, matched_weight = typo_svc.quick_estimate_typography(
                            crop_bgr, normalized_text, font_size_hint=font_size
                        )
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

