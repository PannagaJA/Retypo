# Requirements: AI Image Text Editor

## Functional Requirements

### 1. Upload & Analysis
- **REQ-UP-1**: Drag-and-drop & file picker supporting PNG, JPG, JPEG, and WebP.
- **REQ-UP-2**: Client & server file validation (MIME type sniffing, dimension limits, decompression bomb protection).
- **REQ-UP-3**: EXIF auto-rotation handling preserving source pixel resolution.
- **REQ-UP-4**: Original image preserved unmodified in storage/memory.
- **REQ-UP-5**: Thumbnail generation for quick canvas loading, preserving full-resolution pipeline for final export.

### 2. OCR & Text Detection
- **REQ-OCR-1**: Detect text regions, bounding boxes, polygon quadrilaterals, orientation angles, and confidence scores.
- **REQ-OCR-2**: Group detected words into semantic lines/blocks.
- **REQ-OCR-3**: Output structured region entities with stable IDs, text content, geometry, font parameter estimates, and confidence scores.
- **REQ-OCR-4**: Support manual text block creation or user correction of OCR transcription errors.

### 3. Typography Estimation & Font Matching
- **REQ-TYP-1**: Estimate font size (in image pixels), weight (e.g. 100-900), slope/italic, primary text color, and alignment.
- **REQ-TYP-2**: Ingest and index an open font catalogue (Google Fonts subset) with metadata and glyph outlines.
- **REQ-TYP-3**: Extract glyph contours and aspect ratios from detected text crop; rank candidate fonts with similarity scores.
- **REQ-TYP-4**: Render candidate fonts at matched size and calculate visual similarity (edge/contour correlation, stroke thickness).
- **REQ-TYP-5**: Provide user-selectable font candidate recommendations with confidence indicators.

### 4. Text Masking & Background Inpainting
- **REQ-MSK-1**: Isolate text glyphs and antialiased boundaries (avoiding crude rectangular cutouts).
- **REQ-MSK-2**: Dynamic morphological dilation adapted to font size and image scale.
- **REQ-MSK-3**: Interactive mask editor allowing manual brush/erase refinement of detected masks.
- **REQ-INP-1**: Tiered background restoration strategy:
  - Uniform/solid color fill (variance check)
  - Bi-linear / directional gradient reconstruction
  - Texture-aware patch matching / OpenCV Telea / Navier-Stokes
  - LaMa deep learning inpainting for complex textured backgrounds
- **REQ-INP-2**: Restored background saved as a distinct layer; inspectable before text placement.

### 5. Interactive Canvas & Editing Controls
- **REQ-CNV-1**: Fabric.js canvas with smooth panning, multi-level zoom, and transformation controls.
- **REQ-CNV-2**: Interactive text layer editing: direct on-canvas editing and comprehensive properties inspector (font family, weight, style, size, color, letter spacing, line height, alignment, stroke, shadow).
- **REQ-CNV-3**: Non-destructive layer hierarchy: Original Base Image -> Inpainting Patch Layer -> Editable Text Layers.
- **REQ-CNV-4**: Robust Undo / Redo history stack preserving all operational states.
- **REQ-CNV-5**: Before / After split-view or toggle comparison.

### 6. High-Resolution Compositing & Export
- **REQ-EXP-1**: Dual-coordinate system mapping canvas viewport coordinates directly to original source image coordinates.
- **REQ-EXP-2**: Render replacements at original image resolution with antialiasing and color profile preservation.
- **REQ-EXP-3**: Guarantee 100% pixel preservation outside edited bounding masks.
- **REQ-EXP-4**: Multi-format export (PNG, JPEG with configurable quality, WebP).

### 7. Conversational AI Editing Panel
- **REQ-AI-1**: Chat/instruction input to parse natural language edits (e.g. "Change price from $99 to $79", "Change font color to navy blue").
- **REQ-AI-2**: Deterministic operation translation without regenerating entire image.
- **REQ-AI-3**: Diff preview before applying AI-suggested changes.

## Non-Functional Requirements
- **PERF-1**: Fast client responsiveness with progressive loading.
- **SEC-1**: Input validation, payload size restrictions, no arbitrary code/eval, secure asset paths.
- **REL-1**: Comprehensive automated tests (unit tests for geometry/matching, integration tests for export fidelity).
- **ETH-1**: Transparent confidence scores; no false claims of 100% accuracy.
