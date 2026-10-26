import math
import numpy as np
import cv2
from PIL import Image
from typing import List, Tuple

def generate_text_mask(
    image: Image.Image,
    polygon: List[List[float]],
    font_size: float = 32.0,
    padding: int = 0
) -> Tuple[np.ndarray, Tuple[int, int, int, int]]:
    """
    Generates a high-precision binary mask isolating text glyphs and stroke edges
    rather than a crude rectangular cutout, preserving surrounding icons, borders,
    and background gradients.

    Returns:
      mask_crop: uint8 binary numpy array (H, W) where 255 = inpaint target, 0 = keep background
      crop_box: (x1, y1, x2, y2) in original image coordinates
    """
    img_w, img_h = image.size
    xs = [p[0] for p in polygon]
    ys = [p[1] for p in polygon]

    # Calculate bounding area with safety margin
    margin = max(4, int(font_size * 0.20))
    x1 = max(0, int(min(xs)) - margin)
    y1 = max(0, int(min(ys)) - margin)
    x2 = min(img_w, int(max(xs)) + margin)
    y2 = min(img_h, int(max(ys)) + margin)

    crop_w = x2 - x1
    crop_h = y2 - y1

    if crop_w < 4 or crop_h < 4:
        empty_mask = np.zeros((max(1, crop_h), max(1, crop_w)), dtype=np.uint8)
        return empty_mask, (x1, y1, x2, y2)

    # Crop the localized region
    crop_pil = image.crop((x1, y1, x2, y2)).convert("RGB")
    crop_np = np.array(crop_pil)

    # 1. Rasterize polygon mask in localized crop coordinates
    local_poly = np.array([[p[0] - x1, p[1] - y1] for p in polygon], dtype=np.int32)
    poly_mask = np.zeros((crop_h, crop_w), dtype=np.uint8)
    cv2.fillPoly(poly_mask, [local_poly], 255)

    # 2. Extract detailed glyph stroke mask inside the polygon
    gray = cv2.cvtColor(crop_np, cv2.COLOR_RGB2GRAY)

    # Sample local background luminance from a thin perimeter ring around the polygon
    border_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
    dil_poly = cv2.dilate(poly_mask, border_kernel, iterations=1)
    ring = cv2.subtract(dil_poly, poly_mask)
    if np.sum(ring > 0) >= 10:
        bg_lum = float(np.median(gray[ring > 0]))
    else:
        bg_lum = float(np.median(gray))

    diff = np.abs(gray.astype(np.float32) - bg_lum)
    poly_diff = diff[poly_mask == 255]

    if len(poly_diff) > 10 and (np.max(poly_diff) - np.min(poly_diff)) > 15:
        # Localized Otsu threshold strictly on polygon contrast
        otsu_th, _ = cv2.threshold(poly_diff.astype(np.uint8), 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        threshold_val = max(18.0, float(otsu_th))
        fg = (diff >= threshold_val).astype(np.uint8) * 255
        glyph_mask = cv2.bitwise_and(fg, poly_mask)

        # Filter out accidental full-crop spans (e.g. card borders or button outlines)
        num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(glyph_mask)
        clean_glyph_mask = np.zeros_like(glyph_mask)
        for i in range(1, num_labels):
            gx, gy, gw, gh, garea = stats[i]
            # Must have reasonable area and not cover the entire crop height
            if garea >= 3 and gh <= 0.96 * crop_h:
                clean_glyph_mask[labels == i] = 255
        glyph_mask = clean_glyph_mask
    else:
        # Fallback to high-contrast perimeter separation
        glyph_mask = poly_mask.copy()

    # 3. Adaptive Micro-Dilation for Anti-Aliased Edge Preservation
    # Use gentle 1-2px dilation to capture font edge blend without spilling onto background UI
    base_radius = max(1, min(3, int(round(font_size * 0.04))))
    final_radius = max(1, min(6, base_radius + padding))

    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (final_radius * 2 + 1, final_radius * 2 + 1))
    dilated_mask = cv2.dilate(glyph_mask, kernel, iterations=1)

    # Restrict dilation strictly within the polygon dilated by final_radius
    dilated_mask = cv2.bitwise_and(dilated_mask, cv2.dilate(poly_mask, kernel, iterations=1))

    return dilated_mask, (x1, y1, x2, y2)
