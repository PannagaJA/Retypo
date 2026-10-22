from typing import List, Optional, Literal, Dict, Any
from pydantic import BaseModel, Field

class TypographySignalBreakdown(BaseModel):
    contourSimilarity: float = Field(..., ge=0.0, le=1.0)
    aspectSimilarity: float = Field(..., ge=0.0, le=1.0)
    weightSimilarity: float = Field(..., ge=0.0, le=1.0)
    serifMatch: float = Field(..., ge=0.0, le=1.0)

class FontCandidate(BaseModel):
    family: str
    weight: str = "400"
    category: Literal["sans-serif", "serif", "display", "monospace"] = "sans-serif"
    confidence: float = Field(..., ge=0.0, le=1.0)
    letterSpacing: float = 0.0
    fontSize: float = 32.0
    signals: TypographySignalBreakdown

class TypographyMatchRequest(BaseModel):
    cropBase64: Optional[str] = None
    text: str
    polygon: Optional[List[List[float]]] = None
    bbox: Optional[List[float]] = None
    fontSize: Optional[float] = None
    topK: int = 5

class TypographyMatchResponse(BaseModel):
    status: str = "success"
    detectedWeight: str = "400"
    detectedSerif: bool = False
    estimatedStrokeWidth: float = 0.0
    candidates: List[FontCandidate] = []
    processingTimeMs: float = 0.0
