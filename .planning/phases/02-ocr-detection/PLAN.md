# Phase 2: OCR Detection & Structured Text Region Ingestion

## Phase Goal
Implement a real OCR analysis pipeline (PaddleOCR + fallback) that detects text regions, quadrilaterals, angles, transcriptions, and confidence scores, extracts estimated typography parameters (font size, color), and delivers an interactive click-to-edit overlay on the canvas.

## Wave Breakdown

### Wave 1: Backend OCR Engine & Parameter Estimation Pipeline
- **Task 1.1: PaddleOCR Service & Engine Singleton**
  - Install `paddlepaddle` and `paddleocr` inside the conda environment `ocr`.
  - Implement `backend/app/services/ocr_service.py` with lazy singleton initialization.
  - Support automatic angle classification (`use_angle_cls=True`) and text detection + recognition.
  - Provide a deterministic secondary engine/fallback for fast offline test execution.

- **Task 1.2: Typography Parameter Extraction Service**
  - Implement `backend/app/services/geometry_service.py`:
    - Quad to angle calculation: $\theta = \text{atan2}(dy, dx) \times \frac{180}{\pi}$.
    - Native pixel font size calculation based on quad height.
    - Glyph color extraction using Otsu thresholding on localized image crops and median RGB sampling.
    - Geometry confidence checks.
  - Define structured Pydantic schema `DetectedTextRegion` in `backend/app/core/models.py`.

- **Task 1.3: OCR Analysis REST API**
  - Implement endpoint `POST /api/ocr/analyze` accepting multipart image file or existing project reference.
  - Return JSON payload:
    - `regions`: List of `DetectedTextRegion`
    - `processingTimeMs`: Latency metric
    - `imageWidth`, `imageHeight`: Dimension confirmation

### Wave 2: Frontend Interactive Detection Overlay & Click-to-Edit
- **Task 2.1: OCR API Client & Trigger Actions**
  - Add "Analyze Text (OCR)" action button to `Header.tsx` with loading spinner.
  - Implement `src/services/api.ts` with error handling and backend health check.
  - Provide auto-analysis option on image upload.

- **Task 2.2: Canvas Detection Overlay**
  - Implement interactive overlay in `CanvasWorkspace.tsx` displaying detected text quadrilaterals.
  - Viewport-aware scaling mapping native image coordinates to screen canvas.
  - Interactive hover state: highlights polygon in emerald, displays confidence tooltip.
  - Click-to-edit: Clicking a detected polygon instantly creates an active `TextLayer` pre-populated with OCR text, estimated font size, color, position, and angle.

- **Task 2.3: Detected Regions Tab in Layers Panel**
  - Add "Detected Text" tab/section in `LayersPanel.tsx` showing recognized blocks with confidence scores.
  - Provide "Edit" button per item and "Convert All to Editable" batch action.
  - Allow user correction of OCR transcription text directly in the sidebar.

### Wave 3: Verification & Automated Tests
- **Task 3.1: Backend Test Suite**
  - Unit tests for quad angle and font size math.
  - Unit tests for color extraction accuracy against known color patches (e.g. #FF0000 on white).
  - Integration test for `/api/ocr/analyze` endpoint.
- **Task 3.2: Frontend Test Suite**
  - Unit tests for converting `DetectedTextRegion` to `TextLayer`.
  - Coordinate scaling tests for overlay polygons.
- **Task 3.3: End-to-End Workflow Verification**
  - Test uploading an image with text, running OCR, clicking detected region, editing replacement text, and exporting at native resolution.

## Verification Checklist
- [ ] Backend `/api/ocr/analyze` runs real OCR and returns structured regions with polygon, angle, estimated size, color, and confidence.
- [ ] Detected text regions appear as glowing clickable overlays on the canvas.
- [ ] Clicking any detected text box converts it into an editable `TextLayer` matching original geometry and color.
- [ ] Confidence percentage is displayed transparently (no fake 100% claims).
- [ ] User can correct OCR transcription typos before and after conversion.
- [ ] All automated tests pass in conda `ocr` environment and frontend `vitest`.
