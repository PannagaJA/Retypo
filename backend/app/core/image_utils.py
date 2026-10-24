import io
import os
from PIL import Image, ImageOps
from typing import Tuple, Optional

# Configurable bounds via environment variables for Render Free 512MB RAM budget
MAX_IMAGE_WIDTH = int(os.getenv("MAX_IMAGE_WIDTH", "4096"))
MAX_IMAGE_HEIGHT = int(os.getenv("MAX_IMAGE_HEIGHT", "4096"))
MAX_IMAGE_PIXELS = int(os.getenv("MAX_IMAGE_PIXELS", "16777216"))  # 16 Megapixels
MAX_UPLOAD_BYTES = int(os.getenv("MAX_UPLOAD_BYTES", "15728640"))   # 15 MB
ALLOWED_FORMATS = {"png", "jpeg", "jpg", "webp"}

# Prevent PIL decompression bombs
Image.MAX_IMAGE_PIXELS = MAX_IMAGE_PIXELS

def validate_magic_bytes(header: bytes) -> Optional[str]:
    """Validates raw binary header signatures for supported formats."""
    if header.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if header.startswith(b"\xff\xd8\xff"):
        return "jpeg"
    if len(header) >= 12 and header.startswith(b"RIFF") and header[8:12] == b"WEBP":
        return "webp"
    return None

def load_and_normalize_image(image_bytes: bytes) -> Tuple[Image.Image, dict]:
    """
    Validates upload size, magic bytes, and dimensions.
    Applies EXIF orientation transpose and returns RGB/RGBA PIL Image and metadata dict.
    Raises ValueError with descriptive actionable error messages.
    """
    if not image_bytes or len(image_bytes) == 0:
        raise ValueError("Uploaded file is empty (0 bytes).")

    if len(image_bytes) > MAX_UPLOAD_BYTES:
        max_mb = round(MAX_UPLOAD_BYTES / (1024 * 1024), 1)
        actual_mb = round(len(image_bytes) / (1024 * 1024), 2)
        raise ValueError(f"File size exceeds maximum allowable limit of {max_mb}MB (received {actual_mb}MB).")

    magic_format = validate_magic_bytes(image_bytes[:16])
    if not magic_format:
        raise ValueError("Unsupported or malformed image format. Only PNG, JPEG, and WebP images are supported.")

    try:
        image = Image.open(io.BytesIO(image_bytes))
    except Image.DecompressionBombError:
        raise ValueError(f"Image pixel count exceeds safe decompression limit ({MAX_IMAGE_PIXELS} pixels).")
    except Exception as e:
        raise ValueError(f"Failed to decode image data: {str(e)}")

    fmt = (image.format or magic_format).lower()
    if fmt == "jpg":
        fmt = "jpeg"
    if fmt not in ALLOWED_FORMATS:
        raise ValueError(f"Format '{fmt}' is not supported. Please upload a PNG, JPEG, or WebP image.")

    # Apply EXIF rotation if present
    try:
        image = ImageOps.exif_transpose(image)
    except Exception:
        pass

    w, h = image.width, image.height
    if not validate_dimensions(w, h):
        if w * h > MAX_IMAGE_PIXELS:
            raise ValueError(f"Image dimensions ({w}x{h} = {w*h:,} pixels) exceed safe processing limits (max {MAX_IMAGE_PIXELS:,} pixels).")
        raise ValueError(f"Image dimensions ({w}x{h}) exceed maximum allowable edge limits ({MAX_IMAGE_WIDTH}x{MAX_IMAGE_HEIGHT}px).")

    meta = {
        "width": w,
        "height": h,
        "format": fmt,
        "mode": image.mode,
    }
    return image, meta

def validate_dimensions(
    width: int,
    height: int,
    max_w: Optional[int] = None,
    max_h: Optional[int] = None,
    max_pixels: Optional[int] = None
) -> bool:
    mw = max_w or MAX_IMAGE_WIDTH
    mh = max_h or MAX_IMAGE_HEIGHT
    mp = max_pixels or MAX_IMAGE_PIXELS

    if width <= 0 or height <= 0:
        return False
    if width > mw or height > mh:
        return False
    if width * height > mp:
        return False
    return True
