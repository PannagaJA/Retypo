import math
import numpy as np
import cv2
from PIL import Image
from typing import List, Tuple, Optional

DESCENDERS_SET = set("gjpqy")

def calculate_polygon_angle(polygon: List[List[float]]) -> float:
    """
    Computes baseline orientation angle in degrees (-180 to 180) from quad points [P1, P2, P3, P4].
    Uses the top edge vector P1 -> P2.
    PaddleOCR quads for short words frequently have 1-3px vertical corner jitter, resulting
    in small false angles (1° - 4°). Any orientation within ±4.5° of 0° is snapped to 0.0°
    to preserve perfect horizontal alignment.
    """
    if len(polygon) < 2:
        return 0.0
    p1 = polygon[0]
    p2 = polygon[1]
    dx = p2[0] - p1[0]
    dy = p2[1] - p1[1]
    angle_rad = math.atan2(dy, dx)
    angle_deg = math.degrees(angle_rad)
    if abs(angle_deg) <= 4.5:
        return 0.0
    return round(angle_deg, 2)

def calculate_font_size(
    polygon: List[List[float]],
    image: Optional[Image.Image] = None,
    text: Optional[str] = None
) -> float:
    """
    Estimates CSS / Fabric.js fontSize in native image pixels.
    PaddleOCR bounding quads tightly encompass the text line.
    When the image is available, we measure foreground glyph pixel height directly.
    - If the word contains lowercase descenders (g, j, p, q, y), inner height covers
      cap-height + descenders (~0.92 of font em-size).
    - If the word has no descenders (e.g. All, Income, Filter), inner height is cap-height (~0.72 of em-size).
    Clamped strictly to the detected quad height so text never blows up or overflows containers.
    """
    if len(polygon) < 4:
        return 16.0
    p1, p2, p3, p4 = polygon[0], polygon[1], polygon[2], polygon[3]

    h_left = math.hypot(p4[0] - p1[0], p4[1] - p1[1])
    h_right = math.hypot(p3[0] - p2[0], p3[1] - p2[1])
    glyph_height = (h_left + h_right) / 2.0

    if image is not None:
        try:
            xs = [p[0] for p in polygon]
            ys = [p[1] for p in polygon]
            min_x, max_x = max(0, int(min(xs))), min(image.width, int(max(xs)))
            min_y, max_y = max(0, int(min(ys))), min(image.height, int(max(ys)))
            if max_x > min_x and max_y > min_y:
                crop = np.array(image.crop((min_x, min_y, max_x, max_y)))
                if crop.size > 0:
                    gray = cv2.cvtColor(crop, cv2.COLOR_RGB2GRAY) if len(crop.shape) == 3 else crop
                    _, th1 = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
                    _, th2 = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
                    th = th1 if np.sum(th1 == 255) < np.sum(th2 == 255) else th2
                    fg_ys = np.where(th == 255)[0]
                    if len(fg_ys) >= 4:
                        inner_h = float(np.max(fg_ys) - np.min(fg_ys) + 1)
                        has_desc = any(c in DESCENDERS_SET for c in (text or ""))
                        divisor = 0.92 if has_desc else 0.72
                        est_size = inner_h / divisor
                        clamped_size = max(glyph_height * 0.6, min(glyph_height * 1.0, est_size))
                        return round(clamped_size, 1)
        except Exception:
            pass

    if text is not None:
        has_desc = any(c in DESCENDERS_SET for c in text)
        scale = 0.78 if has_desc else 0.82
        return max(8.0, round(glyph_height * scale, 1))

    return max(8.0, round(glyph_height, 1))

def estimate_text_weight(
    image: Optional[Image.Image],
    polygon: List[List[float]],
    font_size: float
) -> str:
    """
    Estimates CSS font-weight (400, 600, or 700) from text stroke thickness and edge sharpness.
    Uses Euclidean distance transform to measure stem stroke width relative to font height,
    along with edge sharpness to distinguish bold headers/titles from regular body/subtitles.
    """
    if image is None or len(polygon) < 4:
        return "400"

    xs = [p[0] for p in polygon]
    ys = [p[1] for p in polygon]
    min_x, max_x = max(0, int(min(xs))), min(image.width, int(max(xs)))
    min_y, max_y = max(0, int(min(ys))), min(image.height, int(max(ys)))

    if max_x <= min_x + 4 or max_y <= min_y + 4:
        return "400"

    try:
        crop = image.crop((min_x, min_y, max_x, max_y))
        crop_np = np.array(crop)
        if crop_np.size == 0:
            return "400"

        if len(crop_np.shape) == 2:
            gray = crop_np
        else:
            gray = cv2.cvtColor(crop_np[:, :, :3], cv2.COLOR_RGB2GRAY)

        h, w = gray.shape
        _, otsu = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

        border = np.concatenate([gray[0, :], gray[-1, :], gray[:, 0], gray[:, -1]])
        mask = cv2.bitwise_not(otsu) if np.mean(border) > 127 else otsu

        dist = cv2.distanceTransform(mask, cv2.DIST_L2, 5)
        vals = dist[dist > 0.5]
        if len(vals) < 5:
            return "400"

        p80 = float(np.percentile(vals, 80))
        stroke_w = p80 * 2.0
        eff_h = max(14.0, float(font_size))
        tau = stroke_w / eff_h

        sobelx = cv2.Sobel(gray, cv2.CV_64F, 1, 0, ksize=3)
        sobely = cv2.Sobel(gray, cv2.CV_64F, 0, 1, ksize=3)
        mag = np.sqrt(sobelx**2 + sobely**2)
        sig_mag = mag[mag > 30]
        p90_edge = float(np.percentile(sig_mag, 90)) if len(sig_mag) > 0 else 0

        # Calibrated:
        # Bold (700): heavy stroke >= 3.6 or (tau >= 0.18 and p90_edge >= 600)
        # Semi-Bold (600): tau >= 0.15 and p90_edge >= 500
        # Regular (400): default
        if stroke_w >= 3.6 or (tau >= 0.18 and p90_edge >= 600):
            return "700"
        elif tau >= 0.15 and p90_edge >= 500:
            return "600"
        else:
            return "400"
    except Exception:
        return "400"

def calculate_bounding_box(
    polygon: List[List[float]],
    image: Optional[Image.Image] = None
) -> Tuple[float, float, float, float]:
    """
    Returns axis-aligned bounding box (left, top, width, height) in original image pixels.
    When image is provided, calibrates bounds to exact visual foreground text bounds,
    preventing 5-6px vertical/horizontal alignment offsets caused by outer whitespace padding.
    """
    xs = [p[0] for p in polygon]
    ys = [p[1] for p in polygon]
    min_x = min(xs)
    max_x = max(xs)
    min_y = min(ys)
    max_y = max(ys)

    if image is not None:
        try:
            ix1, ix2 = max(0, int(min_x)), min(image.width, int(max_x))
            iy1, iy2 = max(0, int(min_y)), min(image.height, int(max_y))
            if ix2 > ix1 + 4 and iy2 > iy1 + 4:
                crop = np.array(image.crop((ix1, iy1, ix2, iy2)))
                if crop.size > 0:
                    gray = cv2.cvtColor(crop, cv2.COLOR_RGB2GRAY) if len(crop.shape) == 3 else crop
                    _, th1 = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
                    _, th2 = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
                    th = th1 if np.sum(th1 == 255) < np.sum(th2 == 255) else th2
                    fg_ys, fg_xs = np.where(th == 255)
                    if len(fg_ys) >= 6 and len(fg_xs) >= 6:
                        cal_left = ix1 + float(np.min(fg_xs))
                        cal_top = iy1 + float(np.min(fg_ys))
                        cal_w = float(np.max(fg_xs) - np.min(fg_xs) + 1)
                        cal_h = float(np.max(fg_ys) - np.min(fg_ys) + 1)
                        return (round(cal_left, 1), round(cal_top, 1), round(cal_w, 1), round(cal_h, 1))
        except Exception:
            pass

    return (round(min_x, 1), round(min_y, 1), round(max_x - min_x, 1), round(max_y - min_y, 1))

def estimate_text_blur(
    image: Optional[Image.Image],
    polygon: List[List[float]]
) -> float:
    """
    Estimates natural edge softness / blur radius in native image pixels (typically 0.4 to 1.2px)
    from foreground text edge sharpness.
    """
    if image is None or len(polygon) < 4:
        return 0.6
    try:
        xs = [p[0] for p in polygon]
        ys = [p[1] for p in polygon]
        ix1, ix2 = max(0, int(min_x)), min(image.width, int(max_x))
        iy1, iy2 = max(0, int(min_y)), min(image.height, int(max_y))
        if ix2 <= ix1 + 4 or iy2 <= iy1 + 4:
            return 0.6

        crop = np.array(image.crop((ix1, iy1, ix2, iy2)))
        gray = cv2.cvtColor(crop, cv2.COLOR_RGB2GRAY) if len(crop.shape) == 3 else crop

        gx = cv2.Sobel(gray, cv2.CV_64F, 1, 0, ksize=3)
        gy = cv2.Sobel(gray, cv2.CV_64F, 0, 1, ksize=3)
        mag = np.sqrt(gx**2 + gy**2)
        sig = mag[mag > 30]
        if len(sig) == 0:
            return 0.6
        p90 = float(np.percentile(sig, 90))

        if p90 >= 600:
            return 0.4
        elif p90 >= 380:
            return 0.6
        elif p90 >= 250:
            return 0.8
        else:
            return 1.0
    except Exception:
        return 0.6

def calculate_geometry_confidence(polygon: List[List[float]]) -> float:
    """
    Calculates polygon regularity/rectangularity score between 0.0 and 1.0.
    Measures ratio between polygon area and its minimum area bounding box.
    """
    if len(polygon) < 4:
        return 0.0
    pts = np.array(polygon, dtype=np.float32)
    poly_area = cv2.contourArea(pts)
    rect = cv2.minAreaRect(pts)
    box_w, box_h = rect[1]
    box_area = box_w * box_h
    if box_area <= 0:
        return 0.0
    ratio = poly_area / box_area
    score = min(1.0, max(0.0, ratio))
    return round(score, 3)

def estimate_text_color(image: Image.Image, polygon: List[List[float]]) -> str:
    """
    Estimates the dominant foreground text color in HEX (#RRGGBB).
    Uses Otsu binarization to isolate high-contrast foreground text pixels.
    """
    if len(polygon) < 4:
        return "#ffffff"

    xs = [p[0] for p in polygon]
    ys = [p[1] for p in polygon]
    min_x, max_x = max(0, int(min(xs))), min(image.width, int(max(xs)))
    min_y, max_y = max(0, int(min(ys))), min(image.height, int(max(ys)))

    if max_x <= min_x or max_y <= min_y:
        return "#ffffff"

    crop = image.crop((min_x, min_y, max_x, max_y))
    crop_np = np.array(crop)

    if crop_np.size == 0:
        return "#ffffff"

    if len(crop_np.shape) == 2:
        gray = crop_np
        rgb = np.stack([gray, gray, gray], axis=-1)
    else:
        rgb = crop_np[:, :, :3]
        gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)

    _, otsu_thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

    border_pixels = np.concatenate([
        gray[0, :], gray[-1, :], gray[:, 0], gray[:, -1]
    ])
    border_mean = np.mean(border_pixels) if len(border_pixels) > 0 else 128

    if border_mean > 127:
        text_mask = (otsu_thresh == 0)
    else:
        text_mask = (otsu_thresh == 255)

    if not np.any(text_mask):
        text_pixels = rgb.reshape(-1, 3)
    else:
        text_pixels = rgb[text_mask]

    median_rgb = np.median(text_pixels, axis=0).astype(int)
    hex_color = f"#{median_rgb[0]:02x}{median_rgb[1]:02x}{median_rgb[2]:02x}"
    return hex_color
