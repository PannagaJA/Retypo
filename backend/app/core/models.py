from typing import List, Optional, Literal, Tuple, Dict, Any
from pydantic import BaseModel, Field

class ShadowConfig(BaseModel):
    color: str = 'rgba(0,0,0,0.5)'
    blur: float = 4.0
    offsetX: float = 2.0
    offsetY: float = 2.0

class TextLayerModel(BaseModel):
    id: str
    text: str
    fontFamily: str = 'Inter'
    fontSize: float = 32.0  # In native image pixels
    fontWeight: str = '400'
    fontStyle: Literal['normal', 'italic'] = 'normal'
    fill: str = '#000000'
    stroke: Optional[str] = None
    strokeWidth: float = 0.0
    letterSpacing: float = 0.0
    lineHeight: float = 1.2
    textAlign: Literal['left', 'center', 'right', 'justify'] = 'left'
    shadow: Optional[ShadowConfig] = None
    left: float = 0.0       # Native image X
    top: float = 0.0        # Native image Y
    width: float = 200.0    # Native image width
    height: float = 50.0    # Native image height
    angle: float = 0.0      # Rotation in degrees
    opacity: float = 1.0
    blur: float = 0.0
    isLocked: bool = False
    isVisible: bool = True
    origin: Literal['ocr_detected', 'manual'] = 'manual'

class DetectedTextRegion(BaseModel):
    regionId: str
    text: str
    polygon: List[List[float]] = Field(
        ...,
        description="Quadrilateral polygon coordinates [[x1,y1], [x2,y2], [x3,y3], [x4,y4]] in original image pixels"
    )
    bbox: Tuple[float, float, float, float] = Field(
        ...,
        description="Axis-aligned bounding box (left, top, width, height) in original image pixels"
    )
    angle: float = Field(0.0, description="Rotation angle in degrees")
    estimatedFontSize: float = Field(32.0, description="Estimated font size in original image pixels")
    estimatedColor: str = Field("#ffffff", description="Estimated dominant text HEX color")
    estimatedWeight: str = Field("400", description="Estimated font weight (300, 400, 500, 600, etc.)")
    estimatedBlur: float = Field(0.6, description="Estimated edge softness blur radius in original image pixels")
    estimatedFontFamily: str = Field("Inter", description="Estimated font family match")
    fontCategory: str = Field("sans-serif", description="Font category: sans-serif, serif, display, monospace")
    confidence: float = Field(..., ge=0.0, le=1.0, description="OCR confidence score")
    geometryConfidence: float = Field(1.0, ge=0.0, le=1.0, description="Polygon geometry regularity score")
    isConverted: bool = Field(False, description="Whether this region has been adopted into an editable layer")

class OCRResponse(BaseModel):
    status: str = "success"
    imageWidth: int
    imageHeight: int
    regionsCount: int
    processingTimeMs: float
    regions: List[DetectedTextRegion]

class InpaintBounds(BaseModel):
    left: float
    top: float
    width: float
    height: float

class InpaintRestoreResponse(BaseModel):
    status: str = "success"
    patchDataUrl: str
    maskDataUrl: str
    bounds: InpaintBounds
    strategyUsed: str
    processingTimeMs: float
    maskPixelCount: int

class MaskInspectResponse(BaseModel):
    status: str = "success"
    maskDataUrl: str
    bounds: InpaintBounds
    maskPixelCount: int

class ProjectMetadata(BaseModel):
    projectId: str
    imageWidth: int
    imageHeight: int
    format: str
    fileName: str

class ExportRequest(BaseModel):
    format: Literal['png', 'jpeg', 'webp'] = 'png'
    quality: Optional[float] = Field(default=0.95, ge=0.1, le=1.0)
    layers: List[TextLayerModel] = []
