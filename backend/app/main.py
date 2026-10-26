import os
try:
    from dotenv import load_dotenv
    load_dotenv()
except Exception:
    pass

# Configure project-local models directory for PaddleX OCR weights
if "PADDLE_PDX_CACHE_HOME" not in os.environ:
    _cur_dir = os.path.dirname(os.path.abspath(__file__))
    _root_models = os.path.abspath(os.path.join(_cur_dir, "..", "..", "models"))
    _backend_models = os.path.abspath(os.path.join(_cur_dir, "..", "models"))
    if os.path.isdir(_root_models):
        os.environ["PADDLE_PDX_CACHE_HOME"] = _root_models
    elif os.path.isdir(_backend_models):
        os.environ["PADDLE_PDX_CACHE_HOME"] = _backend_models
    else:
        os.environ["PADDLE_PDX_CACHE_HOME"] = _root_models

os.environ.setdefault("PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK", "True")
os.environ["FLAGS_use_mkldnn"] = "0"
os.environ["PADDLE_PDX_ENABLE_MKLDNN_BYDEFAULT"] = "0"

# Neutralize any uvicorn request limit to prevent container self-termination crash loops under continuous Render health checks
try:
    from uvicorn.server import Server
    _orig_on_tick = Server.on_tick
    async def _safe_on_tick(self, counter: int) -> bool:
        self.limit_max_requests = None
        return await _orig_on_tick(self, counter)
    Server.on_tick = _safe_on_tick
except Exception:
    pass

import json
import time
import uuid
from typing import Optional
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from starlette.concurrency import run_in_threadpool

from app.core.models import (
    TextLayerModel,
    ProjectMetadata,
    OCRResponse,
    InpaintRestoreResponse,
    MaskInspectResponse,
    InpaintBounds,
)
from app.core.image_utils import load_and_normalize_image, validate_dimensions
from app.services.ocr_service import OCRService
from app.services.inpaint_service import InpaintingService
from app.services.mask_service import generate_text_mask
from app.schemas.typography import TypographyMatchResponse
from app.services.typography_service import TypographyService
from app.schemas.export import CompositorExportResponse, InpaintPatchModel
from app.services.compositor_service import CompositorService


import base64
import io
from PIL import Image
import cv2
import numpy as np

from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Warm up OCR mobile engine on background worker thread during container boot."""
    try:
        ocr_service = OCRService.get_instance()
        await run_in_threadpool(ocr_service._get_paddle_engine, "en")
        print("[Startup] PaddleOCR mobile engine pre-warmed successfully.")
    except Exception as e:
        print(f"[Startup] Warmup warning: {e}")
    yield

app = FastAPI(
    title="Retypo API",
    description="Retypo AI Image Text Editor & High-Fidelity Typography Reconstruction Engine",
    version="1.2.0",
    lifespan=lifespan
)

# Allowed production and local development origins
ALLOWED_ORIGINS = [
    "https://retypo-image.vercel.app",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

# Ensure CORS headers are attached on every response, including internal exceptions
@app.middleware("http")
async def ensure_cors_headers(request, call_next):
    origin = request.headers.get("origin")
    try:
        response = await call_next(request)
    except Exception as exc:
        from fastapi.responses import JSONResponse
        response = JSONResponse(
            status_code=500,
            content={"status": "error", "detail": f"Internal server error: {str(exc)}"}
        )
    if origin:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS, PATCH"
        response.headers["Access-Control-Allow-Headers"] = "*"
    return response

# Enable CORS for Vercel production domains and local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "version": "1.2.0",
        "ocr_engine": "PaddleOCR v3.7",
        "inpaint_engine": "Multi-tier (Solid, Gradient, Telea, NS, LaMa Interface)"
    }

@app.post("/api/upload", response_model=ProjectMetadata)
async def upload_image(file: UploadFile = File(...)):
    contents = await file.read()
    try:
        image, meta = load_and_normalize_image(contents)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid image format: {str(e)}")

    if not validate_dimensions(meta["width"], meta["height"]):
        raise HTTPException(status_code=400, detail="Image dimensions exceed maximum allowable limits")

    project_id = str(uuid.uuid4())
    return ProjectMetadata(
        projectId=project_id,
        imageWidth=meta["width"],
        imageHeight=meta["height"],
        format=meta["format"],
        fileName=file.filename or "uploaded_image.png"
    )

@app.get("/api/ocr/analyze")
def ocr_analyze_info():
    return {
        "status": "ready",
        "service": "PaddleOCR v3.7 Low-Memory Analysis Engine",
        "methods_supported": ["POST", "OPTIONS", "HEAD", "GET"],
        "usage": "Send a POST multipart/form-data request with 'file' and 'lang' parameters."
    }

@app.post("/api/ocr/analyze", response_model=OCRResponse)
async def analyze_ocr(file: UploadFile = File(...), lang: str = Form('en')):
    start_time = time.perf_counter()
    contents = await file.read()

    try:
        image, meta = load_and_normalize_image(contents)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read image file: {str(e)}")

    if not validate_dimensions(meta["width"], meta["height"]):
        raise HTTPException(status_code=400, detail="Image dimensions exceed maximum allowable limits")

    ocr_service = OCRService.get_instance()
    detected_regions = await run_in_threadpool(ocr_service.analyze_image, image, lang=lang)

    elapsed_ms = round((time.perf_counter() - start_time) * 1000.0, 1)

    return OCRResponse(
        status="success",
        imageWidth=meta["width"],
        imageHeight=meta["height"],
        regionsCount=len(detected_regions),
        processingTimeMs=elapsed_ms,
        regions=detected_regions
    )

@app.post("/api/inpaint/restore", response_model=InpaintRestoreResponse)
async def inpaint_restore(
    file: UploadFile = File(...),
    polygon: str = Form(..., description="JSON serialized polygon coordinates [[x1, y1], [x2, y2], ...]"),
    fontSize: float = Form(32.0),
    strategy: str = Form("auto"),
    padding: int = Form(0)
):
    contents = await file.read()
    try:
        image, meta = load_and_normalize_image(contents)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to load image: {str(e)}")

    try:
        parsed_polygon = json.loads(polygon)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid polygon JSON: {str(e)}")

    inpaint_service = InpaintingService.get_instance()
    result = await run_in_threadpool(
        inpaint_service.restore_region,
        image=image,
        polygon=parsed_polygon,
        font_size=fontSize,
        strategy=strategy, # type: ignore
        padding=padding
    )

    return InpaintRestoreResponse(
        status="success",
        patchDataUrl=result["patchDataUrl"],
        maskDataUrl=result["maskDataUrl"],
        bounds=InpaintBounds(**result["bounds"]),
        strategyUsed=result["strategyUsed"],
        processingTimeMs=result["processingTimeMs"],
        maskPixelCount=result["maskPixelCount"]
    )

@app.post("/api/inpaint/mask", response_model=MaskInspectResponse)
async def inpaint_mask(
    file: UploadFile = File(...),
    polygon: str = Form(...),
    fontSize: float = Form(32.0),
    padding: int = Form(0)
):
    contents = await file.read()
    try:
        image, meta = load_and_normalize_image(contents)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to load image: {str(e)}")

    try:
        parsed_polygon = json.loads(polygon)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid polygon JSON: {str(e)}")

    mask_np, (x1, y1, x2, y2) = generate_text_mask(image, parsed_polygon, fontSize, padding)

    # Encode mask to base64 PNG
    mask_pil = Image.fromarray(mask_np)
    buffer = io.BytesIO()
    mask_pil.save(buffer, format="PNG")
    mask_base64 = "data:image/png;base64," + base64.b64encode(buffer.getvalue()).decode("utf-8")

    return MaskInspectResponse(
        status="success",
        maskDataUrl=mask_base64,
        bounds=InpaintBounds(left=x1, top=y1, width=x2 - x1, height=y2 - y1),
        maskPixelCount=int((mask_np == 255).sum())
    )


@app.post("/api/typography/match", response_model=TypographyMatchResponse)
async def match_typography(
    file: Optional[UploadFile] = File(None),
    cropBase64: Optional[str] = Form(None),
    text: str = Form(...),
    polygon: Optional[str] = Form(None),
    bbox: Optional[str] = Form(None),
    fontSize: Optional[float] = Form(None),
    topK: int = Form(5)
):
    crop_bgr = None

    if cropBase64:
        try:
            # Handle data URL prefix
            data_str = cropBase64
            if "," in data_str:
                data_str = data_str.split(",", 1)[1]
            img_bytes = base64.b64decode(data_str)
            pil_img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
            crop_bgr = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to decode cropBase64: {str(e)}")
    elif file:
        try:
            contents = await file.read()
            pil_img, meta = load_and_normalize_image(contents)
            full_bgr = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)
            h, w = full_bgr.shape[:2]

            if polygon:
                pts = json.loads(polygon)
                xs = [p[0] for p in pts]
                ys = [p[1] for p in pts]
                x1, y1 = max(0, int(min(xs))), max(0, int(min(ys)))
                x2, y2 = min(w, int(max(xs))), min(h, int(max(ys)))
                crop_bgr = full_bgr[y1:y2, x1:x2]
            elif bbox:
                b = json.loads(bbox)
                x1, y1 = max(0, int(b[0])), max(0, int(b[1]))
                x2, y2 = min(w, int(b[0] + b[2])), min(h, int(b[1] + b[3]))
                crop_bgr = full_bgr[y1:y2, x1:x2]
            else:
                crop_bgr = full_bgr
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to process image file: {str(e)}")
    else:
        raise HTTPException(status_code=400, detail="Either file or cropBase64 must be provided.")

    typography_service = TypographyService.get_instance()
    response = typography_service.match_typography(
        crop_bgr=crop_bgr,
        text=text,
        font_size_hint=fontSize,
        top_k=topK
    )
    return response


@app.post("/api/export/render", response_model=CompositorExportResponse)
async def export_render(
    file: Optional[UploadFile] = File(None),
    imageBase64: Optional[str] = Form(None),
    format: str = Form("png"),
    quality: float = Form(0.95),
    layers: str = Form("[]"),
    inpaintPatches: str = Form("[]"),
    preserveIcc: bool = Form(True)
):
    base_image = None
    if file:
        try:
            contents = await file.read()
            base_image, meta = load_and_normalize_image(contents)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to load image file: {str(e)}")
    elif imageBase64:
        try:
            data_str = imageBase64
            if "," in data_str:
                data_str = data_str.split(",", 1)[1]
            img_bytes = base64.b64decode(data_str)
            base_image = Image.open(io.BytesIO(img_bytes)).convert("RGB")
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to decode imageBase64: {str(e)}")
    else:
        raise HTTPException(status_code=400, detail="Either file or imageBase64 must be provided.")

    try:
        raw_layers = json.loads(layers)
        parsed_layers = [TextLayerModel(**l) for l in raw_layers]
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid layers JSON: {str(e)}")

    try:
        raw_patches = json.loads(inpaintPatches)
        parsed_patches = [InpaintPatchModel(**p) for p in raw_patches]
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid inpaintPatches JSON: {str(e)}")

    compositor = CompositorService.get_instance()
    response = compositor.composite_image(
        base_image=base_image,
        inpaint_patches=parsed_patches,
        text_layers=parsed_layers,
        format=format,
        quality=quality,
        preserve_icc=preserveIcc
    )
    return response
