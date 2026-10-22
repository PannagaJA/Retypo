from typing import List, Optional, Literal, Dict, Any
from pydantic import BaseModel, Field
from app.core.models import TextLayerModel, InpaintBounds

class InpaintPatchModel(BaseModel):
    id: str
    bounds: InpaintBounds
    dataUrl: str
    strategy: Optional[str] = "auto"

class CompositorVerificationTelemetry(BaseModel):
    ssimUneditedRegion: float = Field(1.0, ge=0.0, le=1.0)
    deltaEMax: float = 0.0
    changedPixelPercentage: float = 0.0
    nativeWidth: int
    nativeHeight: int
    formatUsed: str
    fileSizeBytes: int

class CompositorExportRequest(BaseModel):
    imageBase64: Optional[str] = None
    format: Literal["png", "jpeg", "webp"] = "png"
    quality: float = Field(0.95, ge=0.1, le=1.0)
    layers: List[TextLayerModel] = []
    inpaintPatches: List[InpaintPatchModel] = []
    preserveIcc: bool = True

class CompositorExportResponse(BaseModel):
    status: str = "success"
    exportDataUrl: str
    fileName: str
    telemetry: CompositorVerificationTelemetry
    processingTimeMs: float
