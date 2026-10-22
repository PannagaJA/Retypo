import io
from PIL import Image
from app.core.image_utils import validate_dimensions, load_and_normalize_image

def test_validate_dimensions():
    assert validate_dimensions(1920, 1080) is True
    assert validate_dimensions(3840, 2160) is True
    assert validate_dimensions(0, 500) is False
    assert validate_dimensions(500, -1) is False
    assert validate_dimensions(20000, 20000) is False  # Exceeds max dim

def test_load_and_normalize_image():
    # Create test image in memory
    img = Image.new('RGB', (800, 600), color=(50, 100, 150))
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    raw_bytes = buf.getvalue()

    loaded, meta = load_and_normalize_image(raw_bytes)
    assert meta['width'] == 800
    assert meta['height'] == 600
    assert meta['format'] == 'png'
    assert loaded.size == (800, 600)
