import io
import json
import numpy as np
from PIL import Image, ImageDraw
from fastapi.testclient import TestClient
from app.main import app
from app.services.mask_service import generate_text_mask
from app.services.inpaint_service import InpaintingService

client = TestClient(app)

def test_generate_text_mask_adaptive_dilation():
    # Create white image with black text rectangle
    img = Image.new('RGB', (300, 200), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)
    draw.rectangle([50, 50, 200, 100], fill=(0, 0, 0))

    polygon = [[50.0, 50.0], [200.0, 50.0], [200.0, 100.0], [50.0, 100.0]]
    mask, (x1, y1, x2, y2) = generate_text_mask(img, polygon, font_size=50.0, padding=0)

    assert mask.shape[0] == y2 - y1
    assert mask.shape[1] == x2 - x1
    assert np.any(mask == 255)
    # Background corners should not be in mask
    assert mask[0, 0] == 0

def test_inpaint_solid_background():
    # Flat blue background with red text block
    img = Image.new('RGB', (200, 100), color=(30, 60, 120))
    draw = ImageDraw.Draw(img)
    draw.rectangle([40, 30, 160, 70], fill=(255, 20, 20))

    inpaint_service = InpaintingService.get_instance()
    polygon = [[40.0, 30.0], [160.0, 30.0], [160.0, 70.0], [40.0, 70.0]]
    result = inpaint_service.restore_region(img, polygon, font_size=40.0, strategy="solid")

    assert result["strategyUsed"] == "solid"
    assert "patchDataUrl" in result
    assert result["bounds"]["width"] > 0
    assert result["bounds"]["height"] > 0

def test_inpaint_gradient_background():
    # Linear gradient background
    img = Image.new('RGB', (200, 100))
    for x in range(200):
        for y in range(100):
            val = int(50 + x * 0.8)
            img.putpixel((x, y), (val, val, val))

    draw = ImageDraw.Draw(img)
    draw.rectangle([40, 30, 160, 70], fill=(255, 255, 0))

    inpaint_service = InpaintingService.get_instance()
    polygon = [[40.0, 30.0], [160.0, 30.0], [160.0, 70.0], [40.0, 70.0]]
    result = inpaint_service.restore_region(img, polygon, font_size=40.0, strategy="gradient")

    assert result["strategyUsed"] == "gradient"
    assert "patchDataUrl" in result

def test_inpaint_telea_background():
    # Textured background with text
    np_rand = np.random.randint(80, 120, (100, 200, 3), dtype=np.uint8)
    img = Image.fromarray(np_rand)
    draw = ImageDraw.Draw(img)
    draw.rectangle([40, 30, 160, 70], fill=(255, 255, 255))

    inpaint_service = InpaintingService.get_instance()
    polygon = [[40.0, 30.0], [160.0, 30.0], [160.0, 70.0], [40.0, 70.0]]
    result = inpaint_service.restore_region(img, polygon, font_size=40.0, strategy="telea")

    assert result["strategyUsed"] == "telea"
    assert "patchDataUrl" in result

def test_api_inpaint_restore_endpoint():
    img = Image.new('RGB', (300, 150), color=(40, 50, 60))
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    buf.seek(0)

    polygon = [[50.0, 40.0], [250.0, 40.0], [250.0, 100.0], [50.0, 100.0]]

    response = client.post(
        "/api/inpaint/restore",
        files={"file": ("sample.png", buf.getvalue(), "image/png")},
        data={
            "polygon": json.dumps(polygon),
            "fontSize": 48.0,
            "strategy": "auto",
            "padding": 2
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert "patchDataUrl" in data
    assert "bounds" in data
    assert data["bounds"]["width"] > 0
    assert "strategyUsed" in data
