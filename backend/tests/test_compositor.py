import io
import json
import base64
import pytest
import numpy as np
from PIL import Image
from fastapi.testclient import TestClient

from app.main import app
from app.core.models import TextLayerModel, InpaintBounds
from app.schemas.export import InpaintPatchModel
from app.services.compositor_service import CompositorService

@pytest.fixture
def client():
    return TestClient(app)

@pytest.fixture
def compositor():
    return CompositorService.get_instance()

def test_unedited_pixel_bitwise_identity(compositor):
    # 400x300 canvas
    base = Image.new("RGB", (400, 300), (120, 140, 160))
    orig_arr = np.array(base)

    # Inpaint patch at (50, 50, 100, 40)
    patch_img = Image.new("RGBA", (100, 40), (200, 50, 50, 255))
    buf = io.BytesIO()
    patch_img.save(buf, format="PNG")
    patch_b64 = "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode("utf-8")

    patch = InpaintPatchModel(
        id="p1",
        bounds=InpaintBounds(left=50.0, top=50.0, width=100.0, height=40.0),
        dataUrl=patch_b64
    )

    # Text layer at (200, 200, 150, 30)
    layer = TextLayerModel(
        id="t1",
        text="LOSSLESS MASTER",
        fontFamily="Inter",
        fontSize=24.0,
        fontWeight="600",
        fill="#ffffff",
        left=200.0,
        top=200.0,
        width=150.0,
        height=30.0
    )

    resp = compositor.composite_image(
        base_image=base,
        inpaint_patches=[patch],
        text_layers=[layer],
        format="png"
    )

    assert resp.status == "success"
    assert resp.telemetry.ssimUneditedRegion >= 0.999
    assert resp.telemetry.deltaEMax == 0.0

def test_typography_effects_rasterization(compositor):
    base = Image.new("RGB", (300, 200), (255, 255, 255))

    # Layer with rotation, drop shadow, outline stroke, and tracking
    layer = TextLayerModel(
        id="t2",
        text="SPECIAL EFFECTS",
        fontFamily="Playfair Display",
        fontSize=28.0,
        fontWeight="700",
        fill="#ff3366",
        stroke="#000000",
        strokeWidth=2.0,
        letterSpacing=2.0,
        angle=15.0,
        shadow={"color": "rgba(0,0,0,0.5)", "blur": 6.0, "offsetX": 3.0, "offsetY": 3.0}, # type: ignore
        left=40.0,
        top=60.0,
        width=220.0,
        height=40.0
    )

    resp = compositor.composite_image(
        base_image=base,
        inpaint_patches=[],
        text_layers=[layer],
        format="png"
    )

    assert resp.status == "success"
    assert resp.telemetry.nativeWidth == 300
    assert resp.telemetry.nativeHeight == 200
    assert resp.telemetry.fileSizeBytes > 1000

def test_export_formats(compositor):
    base = Image.new("RGB", (200, 100), (200, 200, 200))

    # PNG
    res_png = compositor.composite_image(base, [], [], format="png")
    assert res_png.telemetry.formatUsed == "PNG"

    # WebP
    res_webp = compositor.composite_image(base, [], [], format="webp", quality=0.98)
    assert res_webp.telemetry.formatUsed == "WEBP"

    # JPEG
    res_jpg = compositor.composite_image(base, [], [], format="jpeg", quality=0.95)
    assert res_jpg.telemetry.formatUsed == "JPEG"

def test_export_api_endpoint(client):
    base = Image.new("RGB", (200, 100), (240, 240, 240))
    buf = io.BytesIO()
    base.save(buf, format="PNG")
    b64 = "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode("utf-8")

    layer = {
        "id": "l-api",
        "text": "API EXPORT",
        "fontFamily": "Inter",
        "fontSize": 20.0,
        "fontWeight": "400",
        "fill": "#000000",
        "left": 10.0,
        "top": 10.0,
        "width": 100.0,
        "height": 20.0
    }

    response = client.post(
        "/api/export/render",
        data={
            "imageBase64": b64,
            "format": "png",
            "layers": json.dumps([layer]),
            "inpaintPatches": json.dumps([])
        }
    )

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert "data:image/png;base64," in data["exportDataUrl"]
    assert data["telemetry"]["nativeWidth"] == 200
    assert data["telemetry"]["nativeHeight"] == 100
    assert data["telemetry"]["ssimUneditedRegion"] >= 0.999
