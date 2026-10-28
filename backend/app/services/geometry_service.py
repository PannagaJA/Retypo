import re
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
    In digital typography, the em-box font size corresponds to cap-height / 0.72.
    For single-line OCR detection polygons, the detected polygon height tracks
    the line box (approximately 1.05 to 1.25x the em-box).
    """
    if len(polygon) < 4:
        return 16.0
    p1, p2, p3, p4 = polygon[0], polygon[1], polygon[2], polygon[3]

    h_left = math.hypot(p4[0] - p1[0], p4[1] - p1[1])
    h_right = math.hypot(p3[0] - p2[0], p3[1] - p2[1])
    poly_height = max(6.0, (h_left + h_right) / 2.0)
    nominal_size = poly_height * 0.88

    if image is not None:
        try:
            xs = [p[0] for p in polygon]
            ys = [p[1] for p in polygon]
            min_x, max_x = max(0, int(min(xs))), min(image.width, int(max(xs)))
            min_y, max_y = max(0, int(min(ys))), min(image.height, int(max(ys)))
            if max_x > min_x + 4 and max_y > min_y + 4:
                crop = np.array(image.crop((min_x, min_y, max_x, max_y)))
                if crop.size > 0:
                    gray = cv2.cvtColor(crop, cv2.COLOR_RGB2GRAY) if len(crop.shape) == 3 else crop
                    h, w = gray.shape
                    border = np.concatenate([gray[0, :], gray[-1, :], gray[:, 0], gray[:, -1]])
                    bg_lum = np.median(border)
                    diff = np.abs(gray.astype(np.float32) - bg_lum)
                    _, mask = cv2.threshold(diff.astype(np.uint8), 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

                    # Strip 1px boundary to eliminate outer box border artifacts
                    inner_mask = mask[1:h-1, 1:w-1] if h > 4 and w > 4 else mask
                    num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(inner_mask)
                    char_heights = []
                    for i in range(1, num_labels):
                        gx, gy, gw, gh, garea = stats[i]
                        if 6 <= gh <= 0.95 * h and garea >= 10:
                            char_heights.append(gh)

                    if char_heights:
                        char_h = float(np.percentile(char_heights, 75))
                        # In digital fonts, cap-height ~= 0.72 of em-size
                        calibrated = char_h / 0.72
                        # Bound within sensible line-box envelope of polygon
                        calibrated = max(poly_height * 0.75, min(poly_height * 1.05, calibrated))
                        return max(10.0, round(calibrated, 1))
        except Exception:
            pass

    return max(10.0, round(nominal_size, 1))

def estimate_text_weight(
    image: Optional[Image.Image],
    polygon: List[List[float]],
    font_size: float,
    text: Optional[str] = None
) -> str:
    """
    Estimates CSS font-weight (400, 500, 600, or 700) from text stroke thickness relative to font height.
    Uses scale-independent stroke-to-height ratio tau and edge sharpness gradients.
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
        eff_h = max(12.0, float(font_size))
        tau = stroke_w / eff_h

        sobelx = cv2.Sobel(gray, cv2.CV_64F, 1, 0, ksize=3)
        sobely = cv2.Sobel(gray, cv2.CV_64F, 0, 1, ksize=3)
        mag = np.sqrt(sobelx**2 + sobely**2)
        sig_mag = mag[mag > 30]
        p90_edge = float(np.percentile(sig_mag, 90)) if len(sig_mag) > 0 else 0

        # Calibrated typography weight classification
        if tau >= 0.22 and p90_edge >= 350:
            return "700"
        elif tau >= 0.17:
            return "600"
        elif tau >= 0.13:
            return "500"
        else:
            return "400"
    except Exception:
        return "400"

def calculate_bounding_box(
    polygon: List[List[float]],
    image: Optional[Image.Image] = None
) -> Tuple[float, float, float, float]:
    """
    Returns axis-aligned bounding box (left, top, width, height) in original image pixels
    directly enclosing the polygon coordinates without shrinking or truncating text glyphs.
    """
    xs = [p[0] for p in polygon]
    ys = [p[1] for p in polygon]
    min_x = min(xs)
    max_x = max(xs)
    min_y = min(ys)
    max_y = max(ys)

    return (round(min_x, 1), round(min_y, 1), round(max_x - min_x, 1), round(max_y - min_y, 1))

def refine_polygon_to_text(
    image: Optional[Image.Image],
    polygon: List[List[float]],
    angle: float = 0.0
) -> List[List[float]]:
    """
    Refines OCR detection polygon to tightly and accurately enclose the actual foreground
    text glyph ink on the native image. Corrects vertical drift, removes excess padding,
    and extends boundaries to fully encompass descenders (p, y, g, j, q) and ascenders
    without clipping or unnecessary surrounding space.
    """
    if image is None or len(polygon) < 4 or abs(angle) > 8.0:
        return polygon

    try:
        xs = [p[0] for p in polygon]
        ys = [p[1] for p in polygon]
        min_x, max_x = min(xs), max(xs)
        min_y, max_y = min(ys), max(ys)
        w = max_x - min_x
        h = max_y - min_y
        if w < 10 or h < 6:
            return polygon

        # Pad vertically by 35% of detected height to capture any clipped descenders / ascenders
        pad_y = max(4, int(h * 0.35))
        pad_x = max(2, int(w * 0.02))

        crop_x1 = max(0, int(min_x) - pad_x)
        crop_y1 = max(0, int(min_y) - pad_y)
        crop_x2 = min(image.width, int(max_x) + pad_x)
        crop_y2 = min(image.height, int(max_y) + pad_y)

        if crop_x2 <= crop_x1 + 4 or crop_y2 <= crop_y1 + 4:
            return polygon

        crop = np.array(image.crop((crop_x1, crop_y1, crop_x2, crop_y2)).convert("RGB"))
        gray = cv2.cvtColor(crop, cv2.COLOR_RGB2GRAY)
        border = np.concatenate([gray[0, :], gray[-1, :], gray[:, 0], gray[:, -1]])
        bg = float(np.median(border))
        diff = np.abs(gray.astype(np.float32) - bg)
        max_d = float(np.max(diff))
        if max_d < 18.0:
            return polygon

        _, mask = cv2.threshold(diff.astype(np.uint8), max(15, int(0.35 * max_d)), 255, cv2.THRESH_BINARY)
        num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(mask)

        valid_comps = []
        crop_h = crop_y2 - crop_y1
        for i in range(1, num_labels):
            gx, gy, gw, gh, garea = stats[i]
            # Ignore outer container borders or tiny noise
            if gh >= 4 and garea >= 6 and gw < 0.95 * crop.shape[1] and gh < 0.95 * crop_h:
                orig_rel_y1 = min_y - crop_y1
                orig_rel_y2 = max_y - crop_y1
                # Must overlap original vertical core
                if max(gy, orig_rel_y1) < min(gy + gh, orig_rel_y2):
                    valid_comps.append((gx, gy, gw, gh, garea))

        if not valid_comps:
            return polygon

        min_comp_x = min(c[0] for c in valid_comps)
        max_comp_x = max(c[0] + c[2] for c in valid_comps)
        min_comp_y = min(c[1] for c in valid_comps)
        max_comp_y = max(c[1] + c[3] for c in valid_comps)

        # 2px clean margin around text ink
        tight_x1 = max(0.0, crop_x1 + min_comp_x - 2.0)
        tight_x2 = min(float(image.width), crop_x1 + max_comp_x + 2.0)
        tight_y1 = max(0.0, crop_y1 + min_comp_y - 2.0)
        tight_y2 = min(float(image.height), crop_y1 + max_comp_y + 2.0)

        new_h = tight_y2 - tight_y1
        new_w = tight_x2 - tight_x1
        # Refined box must stay within plausible envelope of detected text
        if new_h < 0.45 * h or new_h > 1.60 * h or new_w < 0.60 * w:
            return polygon

        return [
            [round(tight_x1, 1), round(tight_y1, 1)],
            [round(tight_x2, 1), round(tight_y1, 1)],
            [round(tight_x2, 1), round(tight_y2, 1)],
            [round(tight_x1, 1), round(tight_y2, 1)],
        ]
    except Exception:
        return polygon

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
    Uses 3D Euclidean background contrast separation and luminance clustering.
    Prevents washed-out antialiased gray artifacts on white UI text or dark typography.
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

    h, w = rgb.shape[:2]
    if h == 0 or w == 0:
        return "#ffffff"

    # Sample outer 1-pixel perimeter to accurately model background color
    border = np.concatenate([rgb[0, :, :], rgb[h-1, :, :], rgb[:, 0, :], rgb[:, w-1, :]], axis=0)
    bg_rgb = np.median(border, axis=0)
    bg_lum = 0.299 * bg_rgb[0] + 0.587 * bg_rgb[1] + 0.114 * bg_rgb[2]

    # Measure Euclidean distance in 3D RGB color space from background
    diff = np.linalg.norm(rgb.astype(float) - bg_rgb.astype(float), axis=-1)
    max_diff = float(np.max(diff))

    # Low contrast threshold fallback
    if max_diff < 15.0:
        return "#ffffff" if bg_lum < 128 else "#111827"

    # Extract high-contrast text pixels with perimeter inset
    text_mask = diff >= max(18.0, 0.35 * max_diff)
    if np.sum(text_mask) < 4:
        text_mask = diff >= np.percentile(diff, 80)

    # Inset by 1px from the perimeter to prevent sampling bounding boxes, card borders or canvas outlines
    inner = np.zeros((h, w), dtype=bool)
    if h > 4 and w > 4:
        inner[1:h-1, 1:w-1] = True
        text_mask = text_mask & inner

    # Sample core text pixels (erode by 1px if enough foreground pixels exist)
    eroded = cv2.erode(text_mask.astype(np.uint8), np.ones((2, 2), np.uint8))
    core_mask_to_use = (eroded > 0) if np.sum(eroded) >= 4 else text_mask

    text_pixels = rgb[core_mask_to_use]
    if len(text_pixels) == 0:
        return "#ffffff" if bg_lum < 128 else "#111827"

    pixel_lums = 0.299 * text_pixels[:, 0] + 0.587 * text_pixels[:, 1] + 0.114 * text_pixels[:, 2]

    if bg_lum < 128:
        # Dark Background -> Light text: select brightest core pixels
        core_mask = pixel_lums >= np.percentile(pixel_lums, 60)
        core_pixels = text_pixels[core_mask] if np.sum(core_mask) > 0 else text_pixels
        median_c = np.median(core_pixels, axis=0)
        r, g, b = median_c
        max_ch = max(r, g, b)
        spread = max(abs(r - g), abs(g - b), abs(r - b))
        # Snap near-white anti-aliased digital UI text to crisp pure white
        if max_ch >= 195 and spread <= 22:
            return "#ffffff"
        return f"#{int(r):02x}{int(g):02x}{int(b):02x}"
    else:
        # Light Background -> Dark text: select deepest/darkest core pixels
        core_mask = pixel_lums <= np.percentile(pixel_lums, 40)
        core_pixels = text_pixels[core_mask] if np.sum(core_mask) > 0 else text_pixels
        median_c = np.median(core_pixels, axis=0)
        r, g, b = median_c
        min_ch = min(r, g, b)
        spread = max(abs(r - g), abs(g - b), abs(r - b))
        # Snap near-black anti-aliased digital UI text to deep dark
        if min_ch <= 55 and spread <= 20:
            return "#111827"
        return f"#{int(r):02x}{int(g):02x}{int(b):02x}"
