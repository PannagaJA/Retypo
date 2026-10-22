# Roadmap: AI Image Text Editor

## Milestone 1: Working Core Editor & Non-Destructive Canvas
- **Goal**: Functional client canvas and project shell with image upload, full coordinate mapping, manual text creation, layer stack, undo/redo, and high-res export.
- **Deliverables**:
  - Vite + React + TypeScript + Tailwind workspace setup
  - Fabric.js canvas integration with viewport zoom/pan and screen-to-image coordinate transform
  - Image upload (drag-and-drop, EXIF handling, dimension validation)
  - Text property panel (family, size, color, weight, spacing, alignment, shadow, stroke)
  - Non-destructive layer management & Undo/Redo history stack
  - Export engine preserving full original resolution

## Milestone 2: OCR Detection & Structured Text Region Ingestion
- **Goal**: Real OCR pipeline detecting text polygons, words, lines, orientation, and confidence.
- **Deliverables**:
  - Python backend API service with OCR engine (PaddleOCR with robust fallback)
  - Region extraction API returning structured bounding polygons, line groups, estimated font size, color, and confidence scores
  - Interactive canvas overlay highlighting detected text blocks with click-to-edit
  - Transcription correction and manual bounding box adjustment controls

## Milestone 3: Text Segmentation, Masking & Multi-Tier Background Restoration
- **Goal**: High-fidelity text removal and background inpainting without touching unedited pixels.
- **Deliverables**:
  - Glyph segmentation and adaptive morphological dilation
  - Manual mask editing tool (brush/eraser) in the frontend
  - Tiered background restoration service:
    - Uniform color fill
    - Gradient reconstruction
    - Texture-aware OpenCV inpainting (Telea / Navier-Stokes)
    - Deep inpainting interface (LaMa integration)
  - Separate restored background patch layer with before/after toggle

## Milestone 4: Typography Reconstruction & Font Matching Engine
- **Goal**: Automatic font candidate ranking, baseline estimation, and typography fitting.
- **Deliverables**:
  - Font catalogue ingestion with open-licensed fonts (Roboto, Montserrat, Inter, Playfair, Open Sans, etc.)
  - Contour and stroke-width feature extraction
  - Candidate ranking algorithm scoring shape similarity and aspect ratio
  - Candidate preview picker in properties inspector
  - Precise geometric auto-fitting (baseline alignment, tracking, scale)

## Milestone 5: High-Fidelity Non-Destructive Compositor
- **Goal**: Seamless pixel compositing at source resolution with zero loss outside edited regions.
- **Deliverables**:
  - Python compositor engine taking base image, inpainting patches, and SVG/Pillow text layers
  - Sub-pixel antialiasing and color profile preservation
  - Verification test measuring SSIM and Delta E on unedited vs edited regions
  - Multi-format high-resolution export (PNG, WebP, JPEG)

## Milestone 6: Omitted (Per User Request)
- **Status**: Skipped / Omitted. The editor focuses strictly on the direct, high-fidelity visual manipulation tools (OCR, Inpainting, Typography matching, Lossless Studio export) with zero chatbot overhead.

## Milestone 7: Evaluation Suite, Security & Production Polish
- **Goal**: Automated benchmarking, security audits, and production containerization.
- **Deliverables**:
  - Evaluation suite testing OCR CER/WER, font top-k accuracy, and restoration SSIM
  - Security validation (decompression bombs, MIME validation, input sanitization)
  - Comprehensive documentation, setup guides, and CLI/API test runners
