import io
from PIL import Image, ImageOps
from typing import Tuple

def load_and_normalize_image(image_bytes: bytes) -> Tuple[Image.Image, dict]:
    """
    Loads image from bytes, applies EXIF orientation transpose, and validates dimensions.
    Returns RGB or RGBA PIL Image and metadata dict.
    """
    image = Image.open(io.BytesIO(image_bytes))
    # Correct EXIF rotation if present
    image = ImageOps.exif_transpose(image)
    
    meta = {
        "width": image.width,
        "height": image.height,
        "format": (image.format or 'PNG').lower(),
        "mode": image.mode,
    }
    return image, meta

def validate_dimensions(width: int, height: int, max_dim: int = 16384, max_pixels: int = 100_000_000) -> bool:
    if width <= 0 or height <= 0:
        return False
    if width > max_dim or height > max_dim:
        return False
    if width * height > max_pixels:
        return False
    return True
