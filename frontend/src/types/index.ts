export interface ShadowConfig {
  color: string;
  blur: number;
  offsetX: number;
  offsetY: number;
}

export interface TextLayer {
  id: string;
  text: string;
  fontFamily: string;
  fontSize: number; // in native image pixels
  fontWeight: string | number;
  fontStyle: 'normal' | 'italic';
  fill: string;
  stroke?: string;
  strokeWidth: number;
  letterSpacing: number;
  lineHeight: number;
  textAlign: 'left' | 'center' | 'right' | 'justify';
  shadow?: ShadowConfig;
  left: number; // native image X
  top: number; // native image Y
  width: number;
  height: number;
  angle: number; // in degrees
  opacity: number;
  blur?: number;
  isLocked: boolean;
  isVisible: boolean;
  origin: 'ocr_detected' | 'manual';
}

export interface DetectedTextRegion {
  regionId: string;
  text: string;
  polygon: [number, number][]; // 4 points [[x1, y1], [x2, y2], [x3, y3], [x4, y4]] in native image pixels
  bbox: [number, number, number, number]; // [left, top, width, height]
  angle: number; // rotation in degrees
  estimatedFontSize: number;
  estimatedColor: string;
  estimatedWeight?: string;
  estimatedBlur?: number;
  estimatedFontFamily?: string;
  fontCategory?: string;
  confidence: number;
  geometryConfidence: number;
  isConverted: boolean;
}

export interface ImageMetadata {
  width: number;
  height: number;
  fileName: string;
  format: string;
  dataUrl: string;
  file?: File;
}

export interface InpaintPatch {
  id: string;
  bounds: { left: number; top: number; width: number; height: number };
  dataUrl: string;
  strategy: 'solid' | 'gradient' | 'telea' | 'lama' | 'manual';
  maskDataUrl?: string;
  targetLayerId?: string;
  createdAt?: number;
}

export interface EditorState {
  image: ImageMetadata | null;
  layers: TextLayer[];
  selectedLayerId: string | null;
  detectedRegions: DetectedTextRegion[];
  isDetecting: boolean;
  showDetectionOverlay: boolean;
  zoom: number;
  pan: { x: number; y: number };
  isComparing: boolean;
  compareMode: 'toggle' | 'split';
  splitPosition: number; // 0 to 100
  inpaintPatches: InpaintPatch[];
}

export type ExportFormat = 'png' | 'jpeg' | 'webp';

export interface ExportOptions {
  format: ExportFormat;
  quality: number; // 0.1 to 1.0 (for jpeg/webp)
}


export interface TypographySignalBreakdown {
  contourSimilarity: number;
  aspectSimilarity: number;
  weightSimilarity: number;
  serifMatch: number;
}

export interface FontCandidate {
  family: string;
  weight: string;
  category: 'sans-serif' | 'serif' | 'display' | 'monospace';
  confidence: number;
  letterSpacing: number;
  fontSize: number;
  signals: TypographySignalBreakdown;
}

export interface TypographyMatchResponse {
  status: string;
  detectedWeight: string;
  detectedSerif: boolean;
  estimatedStrokeWidth: number;
  candidates: FontCandidate[];
  processingTimeMs: number;
}


export interface CompositorVerificationTelemetry {
  ssimUneditedRegion: number;
  deltaEMax: number;
  changedPixelPercentage: number;
  nativeWidth: number;
  nativeHeight: number;
  formatUsed: string;
  fileSizeBytes: number;
}

export interface CompositorExportResult {
  status: string;
  exportDataUrl: string;
  fileName: string;
  telemetry: CompositorVerificationTelemetry;
  processingTimeMs: number;
}
