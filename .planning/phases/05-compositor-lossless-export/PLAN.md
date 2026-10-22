# Phase 5: High-Fidelity Non-Destructive Compositor & Lossless Export

## Phase Goal
Implement a server-side high-fidelity compositor that executes non-destructive pixel blending (inpaint patches + sub-pixel vector typography rasterization) preserving 100% of unedited pixel data, color profiles (ICC), and native image resolution. Support multi-format export (PNG lossless, WebP ultra, JPEG 4:4:4 chroma) with automated SSIM/Delta E quality verification telemetry.

## Wave Breakdown

### Wave 1: Server-Side Compositor Engine & Rasterizer
- **Task 1.1: Mask-Constrained Patch Compositor**
  - Implement `backend/app/services/compositor_service.py`:
    - Deep-copies the native base image with ICC profile and metadata intact.
    - Blends inpaint patches strictly within target bounds using smooth alpha feathering to eliminate seam edges.
    - Guarantees bitwise preservation on all pixels outside edited regions.
- **Task 1.2: High-Resolution Typography & Layer Effect Rasterizer**
  - Render replacement `TextLayerModel` objects at exact native image coordinates:
    - Font resolution using system & web TrueType fonts.
    - Sub-pixel antialiasing.
    - Drop shadow: offset Gaussian-blurred alpha channel composited beneath fill.
    - Stroke / outline: configurable color and width.
    - Rotation: bicubic resampling around pivot center.
    - Custom letter-spacing (tracking) and multi-line alignment.
- **Task 1.3: Quality Telemetry & SSIM / Delta E Verification**
  - Automatically compute Structural Similarity (SSIM) and color difference (Delta E) on unedited regions between source and exported images.
  - Assert that unedited regions satisfy $\text{SSIM} = 1.000$ and $\Delta E = 0.0$.

### Wave 2: Lossless Export REST API
- **Task 2.1: API Schemas & Endpoint**
  - Add schemas in `backend/app/schemas/export.py`:
    - `CompositorExportRequest`: base image (file/base64), inpaint patches list, text layers list, export options (format, quality, preserve_icc).
    - `CompositorExportResponse`: export dataUrl or binary download, dimensions, file size, processing time, and verification telemetry (ssim, delta_e, changed_pixels).
  - Add `POST /api/export/render` endpoint in `backend/app/main.py`.

### Wave 3: Frontend Export UI & Verification Telemetry
- **Task 3.1: Studio High-Fidelity Option in ExportModal**
  - In `frontend/src/components/ExportModal.tsx`:
    - Add "Studio High-Fidelity Compositor (Recommended)" mode.
    - Format selector with descriptions:
      - `PNG (Lossless 24/32-bit RGBA)`
      - `WebP (Ultra Lossless / 98% Quality)`
      - `JPEG (Studio 4:4:4 Chroma, 95%+ Quality)`
    - Real-time original resolution badge (e.g. `3840 x 2160 • Exact Source Resolution`).
- **Task 3.2: Export Flow & Quality Telemetry Card**
  - Send compositing request to `POST /api/export/render`.
  - Provide direct file download.
  - Display quality telemetry badge: `Unedited Fidelity: 100% (SSIM 1.000, 0 Artifacts)`.

### Wave 4: Automated Verification & Test Suite
- **Task 4.1: Backend Test Suite**
  - Add `backend/tests/test_compositor.py`:
    - Test zero-loss pixel identity on untouched areas.
    - Test typography rasterization with rotation, shadows, strokes, and custom fonts.
    - Test format encoding for PNG, WebP, and JPEG.
    - Test `POST /api/export/render` endpoint and telemetry output.
- **Task 4.2: Frontend Test Suite**
  - Add `frontend/src/tests/compositor.test.ts`:
    - Test export payload serialization and format options.
- **Task 4.3: End-to-End Acceptance Verification**
  - Upload image -> OCR detect -> Inpaint text -> Typography match & replacement -> Server composite export -> Verify lossless preservation on exported file.

## Verification Checklist
- [ ] Unedited pixels outside modified text regions are 100% preserved (SSIM = 1.0 on unedited mask).
- [ ] Replacement text is rendered at native resolution with smooth sub-pixel antialiasing, shadows, strokes, and rotation.
- [ ] Color profiles (ICC) and native image dimensions are strictly preserved.
- [ ] Export formats (PNG lossless, WebP, JPEG 4:4:4) encode cleanly without compression banding.
- [ ] Frontend Export Modal provides 1-click Studio Compositor export and displays verification telemetry.
- [ ] All automated tests pass with 0 errors.
