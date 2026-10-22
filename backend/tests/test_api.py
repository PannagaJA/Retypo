import io
from PIL import Image
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health_check():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "version" in data
    assert "ocr_engine" in data

def test_upload_image_endpoint():
    img = Image.new('RGB', (1200, 800), color=(255, 128, 0))
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    buf.seek(0)

    response = client.post(
        "/api/upload",
        files={"file": ("test_poster.png", buf.getvalue(), "image/png")}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["imageWidth"] == 1200
    assert data["imageHeight"] == 800
    assert data["format"] == "png"
    assert "projectId" in data

def test_ocr_analyze_endpoint():
    # Create simple image
    img = Image.new('RGB', (400, 200), color=(20, 20, 30))
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    buf.seek(0)

    response = client.post(
        "/api/ocr/analyze",
        files={"file": ("sample.png", buf.getvalue(), "image/png")}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["imageWidth"] == 400
    assert data["imageHeight"] == 200
    assert "regions" in data
    assert "processingTimeMs" in data
