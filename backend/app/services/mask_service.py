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
    rather than a crude rectangular cutout.

    Returns:
      mask_crop: uint8 binary numpy array (H, W) where 255 = inpaint target, 0 = keep background
      crop_box: (x1, y1, x2, y2) in original image coordinates
    """
    img_w, img_h = image.size
    xs = [p[0] for p in polygon]
    ys = [p[1] for p in polygon]

    # Calculate bounding area with safety margin
    margin = max(4, int(font_size * 0.25))
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

    # Contrast analysis inside polygon
    poly_pixels = gray[poly_mask == 255]
    if len(poly_pixels) > 10 and (np.max(poly_pixels) - np.min(poly_pixels)) > 20:
        # Otsu thresholding
        _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

        # Border perimeter pixels are background
        border_mask = np.zeros_like(thresh, dtype=bool)
        border_mask[0, :] = True
        border_mask[-1, :] = True
        border_mask[:, 0] = True
        border_mask[:, -1] = True

        border_vals = thresh[border_mask]
        bg_val = 255 if np.mean(border_vals) > 127 else 0

        # Foreground is opposite of background
        fg_mask = (thresh != bg_val).astype(np.uint8) * 255
        glyph_mask = cv2.bitwise_and(fg_mask, poly_mask)
    else:
        # Low contrast fallback: use the full polygon
        glyph_mask = poly_mask.copy()

    # 3. Adaptive Morphological Dilation
    # Scales dilation radius with font size to cover anti-aliased edge fringes and soft shadows
    base_radius = max(2, min(14, int(round(font_size * 0.08))))
    final_radius = max(1, min(24, base_radius + padding))

    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (final_radius * 2 + 1, final_radius * 2 + 1))
    dilated_mask = cv2.dilate(glyph_mask, kernel, iterations=1)

    # Never allow dilation to spill beyond polygon + margin
    dilated_mask = cv2.bitwise_and(dilated_mask, cv2.dilate(poly_mask, kernel, iterations=1))

    return dilated_mask, (x1, y1, x2, y2)
