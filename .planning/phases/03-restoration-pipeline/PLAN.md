# Phase 3: Text Segmentation, Masking & Multi-Tier Background Inpainting

## Phase Goal
Implement an accurate text segmentation pipeline (glyph masks + adaptive morphological dilation) and a multi-tier background restoration service (solid, gradient, OpenCV Telea/NS, deep inpainting interface), generating non-destructive background patch layers with interactive mask refinement and real-time preview.

## Wave Breakdown

### Wave 1: Text Masking & Morphological Segmentation Pipeline
- **Task 1.1: Mask Generation Service**
  - Implement `backend/app/services/mask_service.py`:
    - Glyph isolation using local contrast, edge detection, and Otsu/adaptive thresholding.
    - Adaptive morphological dilation using elliptical structuring element:
      $$\text{radius} = \max(2, \min(14, \text{round}(\text{fontSize} \times 0.08) + \text{userPadding}))$$
    - Anti-aliasing boundary coverage and shadow inclusion.
  - Fallback polygon rasterizer if contrast is too low.

- **Task 1.2: Mask Inspection API**
  - Implement endpoint `POST /api/inpaint/mask` returning mask PNG and pixel stats.

### Wave 2: Multi-Tier Background Inpainting Engine & API
- **Task 2.1: Multi-Strategy Inpainting Service**
  - Implement `backend/app/services/inpaint_service.py`:
    - `InpaintStrategy` enum (`solid`, `gradient`, `telea`, `ns`, `lama`, `auto`).
    - Background classifier analyzing perimeter pixel variance $\sigma^2$ and gradient planar fit.
    - Solid color fill for flat backgrounds.
    - Directional bilinear gradient reconstruction for smooth gradient backdrops.
    - OpenCV Telea Fast Marching (`cv2.INPAINT_TELEA`) for organic textures.
    - OpenCV Navier-Stokes (`cv2.INPAINT_NS`) for fluid tones.
    - Pluggable interface for LaMa inpainting.
  
- **Task 2.2: Inpainting REST API**
  - Implement endpoint `POST /api/inpaint/restore`:
    - Accepts image file, region polygon/bbox, strategy selection, and dilation padding.
    - Returns restored patch image (PNG base64), exact bounding coordinates, and strategy used.

### Wave 3: Frontend Inpainting UI & Interactive Mask Inspector
- **Task 3.1: Inpainting Controls in Properties & Layers Panels**
  - Add "Remove Original Text (Inpaint)" button to selected layer in `PropertiesPanel.tsx`.
  - Strategy selector dropdown (`Auto (Recommended)`, `Solid Color`, `Gradient`, `Texture-Aware (Telea)`, `Navier-Stokes`).
  - Dilation padding slider (tight vs broad mask).
  - "Inpaint All Detected" button to batch clean all text backgrounds.

- **Task 3.2: Mask Preview Overlay in Canvas**
  - Add "Show Mask Overlay" toggle in Header/Canvas showing semi-transparent ruby red mask over text to be removed.
  - Interactive Before/After inspection of the clean restored background before adding new text.

- **Task 3.3: Inpaint Patch Rendering on Canvas & Exporter**
  - Synchronize `inpaintPatches` in Fabric.js canvas: renders patches directly over the base image.
  - Update `utils/exporter.ts` to composite inpaint patches with native sub-pixel accuracy.

### Wave 4: Verification & Automated Tests
- **Task 4.1: Backend Test Suite**
  - Unit tests for mask generation on synthetic text images.
  - Unit tests for solid color fill, gradient reconstruction, and OpenCV inpainting.
  - Integration tests for `POST /api/inpaint/mask` and `POST /api/inpaint/restore`.
- **Task 4.2: Frontend Test Suite**
  - Unit tests for inpaint patch state management and layer ordering.
- **Task 4.3: End-to-End User Acceptance Verification**
  - Verify complete workflow: upload image -> detect text -> inspect mask -> inpaint background -> edit replacement text -> export high-res.

## Verification Checklist
- [ ] Text mask isolates glyphs and stroke edges rather than crude bounding rectangles.
- [ ] Multi-tier background restoration cleanly removes text on solid, gradient, and textured backgrounds.
- [ ] Restored background is saved as a distinct layer (`InpaintPatch`) inspectable without replacement text.
- [ ] No pixels outside the target restoration area are modified.
- [ ] Exporter composites inpaint patches at 100% native resolution with zero quality loss.
- [ ] All automated tests pass with 0 errors.
