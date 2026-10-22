# Phase 1: Working Core Editor & Non-Destructive Canvas

## Phase Goal
Deliver a fully functional creative image-editing workspace with drag-and-drop image upload, responsive Fabric.js canvas, non-destructive layer management, comprehensive typography properties inspector, undo/redo history, split before/after preview, and full-resolution lossless export.

## Wave Breakdown

### Wave 1: Foundation & Scaffolding
- **Task 1.1: Project Scaffolding (Frontend + Backend Skeleton)**
  - Initialize Vite React + TypeScript project with Tailwind CSS in `frontend/`.
  - Install dependencies: `fabric`, `lucide-react`, `clsx`, `tailwind-merge`.
  - Initialize Python FastAPI service in `backend/` with Pillow and OpenCV dependencies ready for subsequent milestones.
  - Setup unified npm / dev scripts.

- **Task 1.2: Core State Management & Layer Data Model**
  - Implement `ProjectState` and `TextLayer` TypeScript models.
  - Implement non-destructive layer hierarchy: Base Image, Inpaint Patches, Text Layers.
  - Implement coordinate conversion utility: Viewport screen coordinates $\leftrightarrow$ Image pixel coordinates.
  - Implement robust Undo/Redo history stack with snapshot management.

### Wave 2: Canvas & Upload Experience
- **Task 2.1: Image Ingestion & Canvas Viewport**
  - Implement drag-and-drop and file picker upload supporting PNG, JPG, JPEG, and WebP.
  - Enforce file dimension & size validation; parse native image width/height.
  - Initialize interactive Fabric.js canvas with smooth panning (Space+Drag or Middle Click) and zooming (Wheel / Buttons).
  - Center and fit image into canvas while keeping pristine original dimensions.

- **Task 2.2: Editable Text Layers on Canvas**
  - Support manual text layer creation and double-click to edit inline.
  - Interactive selection handles for translation, scaling, and rotation.
  - Coordinate syncing between Fabric.js objects and the Project State.
  - Keyboard shortcuts: Delete, Cmd+D (duplicate), Cmd+Z (undo), Cmd+Shift+Z (redo), Escape (deselect).

### Wave 3: Controls, Comparison & High-Res Export
- **Task 3.1: Typography Properties Inspector Panel**
  - Right sidebar inspector updating selected text layer in real time:
    - Text content input
    - Font family selector (bundled with popular web fonts: Inter, Roboto, Montserrat, Playfair Display, Outfit, Open Sans)
    - Font size (in native image pixels), weight (100-900), italic toggle
    - Text color picker & opacity slider
    - Alignment (left, center, right, justify)
    - Letter spacing & line height
    - Stroke color & width
    - Shadow settings (color, blur, offset X/Y)
    - Layer controls: Lock, Hide/Show, Bring Forward, Send Backward, Delete

- **Task 3.2: Layers Panel & Before/After Comparison**
  - Left sidebar layer manager listing all layers with visibility and lock toggles.
  - Before / After split-view slider and instant toggle button comparing edited state against original uploaded image.

- **Task 3.3: High-Resolution Native Compositor & Exporter**
  - Implement offscreen rendering pipeline using native image dimensions.
  - Avoid any preview downscaling artifacts.
  - Export modal offering PNG, JPEG (quality slider), and WebP formats with dimension validation.

### Wave 4: Verification & Automated Tests
- **Task 4.1: Automated Test Suite**
  - Unit tests for coordinate transformation math (screen <-> image coordinates).
  - Unit tests for undo/redo state serialization and layer mutations.
  - Integration tests for offscreen canvas export resolution matching source image.
  - Verification checklist and user workflow testing.

## Verification Checklist
- [ ] Uploading a 4K image displays properly without browser lag.
- [ ] Panning and zooming works smoothly.
- [ ] Adding and editing text layers updates canvas and properties inspector bidirectionally.
- [ ] Undo and redo reliably revert and restore changes.
- [ ] Before/after comparison shows unmodified original vs edited layers.
- [ ] Exporting at native resolution produces an image matching exact source dimensions with sharp text rendering.
- [ ] Automated tests pass with 0 errors.
