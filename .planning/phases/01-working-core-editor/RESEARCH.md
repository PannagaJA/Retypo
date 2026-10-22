# Research: Phase 1 — Working Core Editor & Non-Destructive Canvas

## 1. Interactive Canvas Engine (Fabric.js)
- **Selection & Transformations**: Fabric.js provides native support for bounding boxes, rotation handles, scaling, and interactive multi-line `fabric.Textbox` or `fabric.IText`.
- **Coordinate Systems**:
  - **Screen / Viewport Space**: Scaled and panned coordinates within the browser element.
  - **Image Space**: Absolute pixel coordinates relative to the original uncompressed source image (e.g. 3840x2160).
  - **Mapping Rule**: Store all layer geometry (left, top, width, height, fontSize, strokeWidth) normalized to original image pixel coordinates. Compute viewport projection dynamically on render:
    66026\text{viewportCoord} = \text{imageCoord} \times \text{zoom} + \text{panOffset}66026
  - **Export Rule**: On export, render onto an offscreen canvas sized strictly to original image dimensions with zoom=1 and pan=(0,0). This guarantees zero degradation from canvas downscaling.

## 2. Non-Destructive Layer State Architecture
- Never mutate the original image buffer.
- Layer Hierarchy:
  1. **Base Layer**: Original unmodified source image.
  2. **Inpaint Patch Layer**: High-resolution canvas/bitmap containing restored background patches (initially empty).
  3. **Editable Text Layers**: Vector typography layers with discrete properties:
     - `id`: string (UUID)
     - `text`: string
     - `fontFamily`: string
     - `fontSize`: number (in source image pixels)
     - `fontWeight`: string | number
     - `fontStyle`: 'normal' | 'italic'
     - `fill`: string (HEX/RGBA)
     - `stroke`: string
     - `strokeWidth`: number
     - `letterSpacing`: number
     - `lineHeight`: number
     - `textAlign`: 'left' | 'center' | 'right' | 'justify'
     - `shadow`: { color, blur, offsetX, offsetY }
     - `angle`: number
     - `left`, `top`, `width`, `height`: number
     - `opacity`: number
     - `isLocked`: boolean
     - `isVisible`: boolean
     - `origin`: 'ocr_detected' | 'manual'

## 3. History Stack & Undo/Redo
- Immutable snapshot queue (or delta operations) with configurable max depth (e.g., 50 states).
- Fast replay without network roundtrips.
- Keyboard shortcuts: Cmd+Z (undo), Cmd+Shift+Z / Cmd+Y (redo), Delete/Backspace (remove layer), Cmd+D (duplicate layer).

## 4. Full-Resolution Compositing & Export
- Canvas export uses an isolated off-DOM `fabric.StaticCanvas` configured with the source image's exact native dimensions.
- Supports lossless PNG, high-fidelity WebP, and high-quality JPEG (0.95+ quality).
