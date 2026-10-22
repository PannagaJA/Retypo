import io
import base64
import pytest
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from fastapi.testclient import TestClient

from app.main import app
from app.services.typography_service import TypographyService, FONT_CATALOGUE

@pytest.fixture
def client():
    return TestClient(app)

@pytest.fixture
def typography_service():
    return TypographyService.get_instance()

def test_font_catalogue_structure(typography_service):
    assert len(FONT_CATALOGUE) >= 10
    families = [f["family"] for f in FONT_CATALOGUE]
    assert "Inter" in families
    assert "Roboto" in families
    assert "Playfair Display" in families
    assert "Times New Roman" in families

def test_stroke_weight_estimation(typography_service):
    # Create regular line (width 4) vs bold line (width 8) in 40px height
    reg_mask = np.zeros((40, 100), dtype=np.uint8)
    reg_mask[18:22, 10:90] = 255
    stroke_w_reg, weight_reg = typography_service.estimate_stroke_weight(reg_mask, font_size=40.0)
    assert weight_reg in ["300", "400", "500"]

    bold_mask = np.zeros((40, 100), dtype=np.uint8)
    bold_mask[14:26, 10:90] = 255
    stroke_w_bold, weight_bold = typography_service.estimate_stroke_weight(bold_mask, font_size=40.0)
    assert stroke_w_bold > stroke_w_reg
    assert int(weight_bold) > int(weight_reg)

def test_serif_classification(typography_service):
    # Sans test: simple clean rectangular block
    sans_mask = np.zeros((48, 120), dtype=np.uint8)
    sans_mask[8:40, 20:30] = 255  # vertical stroke
    sans_mask[8:16, 20:80] = 255  # horizontal bar
    is_serif_sans, conf_sans = typography_service.classify_serif(sans_mask)
    assert is_serif_sans is False

    # Serif test: vertical stroke with perpendicular horizontal spurs at top and bottom
    serif_mask = np.zeros((48, 120), dtype=np.uint8)
    serif_mask[8:40, 25:35] = 255  # vertical stem
    serif_mask[6:9, 15:45] = 255   # top serif foot
    serif_mask[39:42, 15:45] = 255 # bottom serif foot
    is_serif_t, conf_t = typography_service.classify_serif(serif_mask)
    # Serif mask should have higher corner spur response than plain sans block
    assert conf_t >= conf_sans

def test_match_typography_api(client):
    # Render synthetic text image
    img = Image.new("RGB", (200, 50), (255, 255, 255))
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 36)
    except Exception:
        font = ImageFont.load_default()

    ImageDraw.Draw(img).text((10, 5), "PHOTEXT", fill=(0, 0, 0), font=font)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    b64_crop = "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode("utf-8")

    response = client.post(
        "/api/typography/match",
        data={
            "cropBase64": b64_crop,
            "text": "PHOTEXT",
            "fontSize": 36.0,
            "topK": 5
        }
    )

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert len(data["candidates"]) == 5
    top_cand = data["candidates"][0]
    assert "family" in top_cand
    assert "weight" in top_cand
    assert "confidence" in top_cand
    assert top_cand["confidence"] > 0.4
    assert "signals" in top_cand
    assert "contourSimilarity" in top_cand["signals"]

def test_match_typography_missing_input_error(client):
    response = client.post(
        "/api/typography/match",
        data={
            "text": "ONLY TEXT NO IMAGE"
        }
    )
    assert response.status_code == 400
