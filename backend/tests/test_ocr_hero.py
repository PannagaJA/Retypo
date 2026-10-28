import pytest
from PIL import Image, ImageDraw, ImageFont
from app.services.ocr_service import OCRService

def test_recover_missed_hero_text_synthetic():
    """
    Verifies that _recover_missed_hero_text identifies and recovers an isolated hero
    glyph cluster in the upper section that wasn't included in extracted_items.
    """
    svc = OCRService.get_instance()
    
    # Create an image (400 x 800) with dark background
    img = Image.new("RGB", (400, 800), color=(18, 18, 18))
    draw = ImageDraw.Draw(img)
    
    font = ImageFont.load_default(size=40)
    
    # Header item at y = 100..120
    draw.text((50, 100), "Transaction", fill=(240, 240, 240))
    # Large Hero amount at y = 220..260
    draw.text((180, 220), "500", fill=(255, 255, 255), font=font)
    # Button at y = 350..370
    draw.text((150, 350), "Pay Again", fill=(100, 200, 255))
    
    # Simulate DBNet returning only the header and the button, missing the hero amount
    mock_extracted = [
        ([[50.0, 100.0], [250.0, 100.0], [250.0, 120.0], [50.0, 120.0]], "Transaction", 0.99),
        ([[150.0, 350.0], [250.0, 350.0], [250.0, 370.0], [150.0, 370.0]], "Pay Again", 0.99)
    ]
    
    engine = svc._get_paddle_engine("en")
    recovered = svc._recover_missed_hero_text(img, engine, mock_extracted)
    
    # Check that the hero item was recovered
    texts = [item[1] for item in recovered]
    assert any("500" in t for t in texts), f"Hero amount not recovered: {texts}"
