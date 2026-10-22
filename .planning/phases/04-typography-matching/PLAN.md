# Phase 4: Typography Reconstruction & Font Matching Engine

## Phase Goal
Implement a high-fidelity typography analysis and font matching engine combining 4 orthogonal visual signals (distance-transform stroke thickness, bounding aspect ratio, serif corner-spur classification, and normalized glyph contour cross-correlation). Provide an interactive candidate ranking inspector in the frontend with live hover preview and 1-click geometric auto-fitting (family, weight, tracking, baseline).

## Wave Breakdown

### Wave 1: Font Catalogue Ingestion & Multi-Signal Feature Extraction Engine
- **Task 1.1: Font Catalogue & Renderer Service**
  - Implement `backend/app/services/typography_service.py`:
    - Catalogue metadata for standard open-source web and system fonts (Inter, Roboto, Montserrat, Open Sans, Lato, Poppins, Outfit, Playfair Display, Georgia, Merriweather, Oswald, Courier Prime).
    - TrueType font rasterizer using Pillow `ImageFont` with graceful system font fallbacks (`/System/Library/Fonts/`, `/System/Library/Fonts/Supplemental/`, or backend assets).
- **Task 1.2: Multi-Signal Typography Feature Extractor**
  - **Signal 1 (Stroke Width / Weight)**: Euclidean distance transform on binary glyph mask (`cv2.distanceTransform`), calculating peak medial axis width $\tau = \text{stroke_width} / \text{font_size}$ mapped to CSS weights (300-800).
  - **Signal 2 (Aspect Ratio)**: Text line length and character spacing correlation against candidate font rendering.
  - **Signal 3 (Serif Classifier)**: Corner spur and terminal stroke gradient analysis to classify serif vs sans-serif.
  - **Signal 4 (Contour Matching)**: Normalized cross-correlation template matching between original glyph binary mask and candidate rendered mask:
    $$\text{Sim}_{\text{contour}} = \frac{\sum (M_{\text{orig}} \cdot M_{\text{candidate}})}{\sqrt{\sum M_{\text{orig}}^2 \cdot \sum M_{\text{candidate}}^2}}$$
  - **Composite Ranking**:
    $$\text{Score} = 0.40 \cdot \text{Sim}_{\text{contour}} + 0.25 \cdot \text{Sim}_{\text{aspect}} + 0.20 \cdot \text{Sim}_{\text{weight}} + 0.15 \cdot \text{Sim}_{\text{serif}}$$
  - **Geometric Auto-Fitting**: Calculate recommended fitted font size, tracking (letter spacing), and baseline offset.

### Wave 2: Typography Matching REST API
- **Task 2.1: API Schemas & Endpoint**
  - Add Pydantic schemas in `backend/app/schemas/typography.py`:
    - `TypographyMatchRequest`: image/crop base64, recognized text string, bounding box `[x, y, w, h]`, optional font size hint, `top_k`.
    - `FontCandidate`: font family, weight, confidence score (0-1), category, recommended letter spacing, recommended font size, signal breakdown.
    - `TypographyMatchResponse`: ranked candidates list, detected weight, detected serif boolean, stroke width.
  - Add `POST /api/typography/match` endpoint in `backend/app/main.py`.

### Wave 3: Frontend Typography Inspector & Live Preview UI
- **Task 3.1: Typography Matcher Card in Properties Inspector**
  - In `frontend/src/components/PropertiesPanel.tsx`:
    - Add "Typography Matcher" section when a text layer is selected.
    - Trigger matching request to `POST /api/typography/match` with active layer crop/text.
    - Display candidate ranking list showing top-5 matches with confidence percentage bars, font family names rendered in their actual font, and category tags.
- **Task 3.2: Live Hover Preview & 1-Click Auto-Fit**
  - Hovering over a candidate in the list temporarily styles the active Fabric.js canvas text layer with that candidate's font family and weight.
  - Mouse leave reverts to previous styling if not clicked.
  - Clicking a candidate permanently commits font family, font weight, fitted font size, and letter spacing, creating an undo/redo history snapshot.
- **Task 3.3: Integration with OCR Region Conversion**
  - When converting an OCR detected region to a text layer, optionally perform quick typography matching to preset the best font automatically.

### Wave 4: Verification & Automated Tests
- **Task 4.1: Backend Test Suite**
  - Add `backend/tests/test_typography.py`:
    - Test distance transform stroke-width calculation.
    - Test serif classifier accuracy on sample serif and sans glyphs.
    - Test candidate ranking formula and determinism.
    - Test `POST /api/typography/match` endpoint response schema and top candidate validity.
- **Task 4.2: Frontend Test Suite**
  - Add `frontend/src/tests/typography.test.ts`:
    - Test candidate ranking rendering and selection.
    - Test property application (family, weight, spacing, size).
    - Test preview rollback on hover cancel.
- **Task 4.3: End-to-End Acceptance Verification**
  - Verify complete workflow on sample image: OCR detect -> extract text -> run typography matching -> apply candidate -> render replacement text at native fidelity.

## Verification Checklist
- [ ] Typography service indexes popular web fonts (Inter, Roboto, Montserrat, Playfair Display, etc.).
- [ ] Stroke width estimation accurately distinguishes Light (300), Regular (400), and Bold (700).
- [ ] Serif classifier accurately distinguishes serif fonts (Playfair, Georgia) from sans-serif (Inter, Roboto).
- [ ] `POST /api/typography/match` returns ranked candidates with confidence scores and signal breakdown.
- [ ] Frontend inspector displays candidate rankings with live hover preview and 1-click apply.
- [ ] All automated backend (Pytest) and frontend (Vitest) tests pass cleanly.
