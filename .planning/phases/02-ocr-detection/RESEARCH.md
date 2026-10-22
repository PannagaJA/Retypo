# Research: Phase 2 — OCR Detection & Structured Text Region Ingestion

## 1. PaddleOCR Engine Architecture
- **Detection Model**: DB (Differentiable Binarization) text detector outputs arbitrary oriented quadrilaterals/polygons `[[x1,y1], [x2,y2], [x3,y3], [x4,y4]]`.
- **Direction / Angle Classifier**: Evaluates orientation (0°, 90°, 180°, 270°) to normalize inverted or vertical text.
- **Recognition Model**: SVTR / CRNN deep sequential model providing transcription string and per-character confidence score.
- **Engine Singleton**: Lazy load `PaddleOCR(use_angle_cls=True, lang='en')` on first request to minimize startup latency and avoid redundant weight reloads.
- **Fallback Engine**: Provide a clean secondary OpenCV contour/Tesseract or mock-free deterministic synthetic text detector for automated unit test suites without requiring multi-hundred-megabyte network downloads during CI.

## 2. Text Region Extraction & Typography Parameter Estimation
Each detected region requires rich geometric and visual parameters:
1. **Geometry & Rotation**:
   - Quad coordinates: $P_1(x_1, y_1), P_2(x_2, y_2), P_3(x_3, y_3), P_4(x_4, y_4)$
   - Baseline slope & Angle:
     $$\theta = \text{atan2}(y_2 - y_1, x_2 - x_1) \times \frac{180}{\pi}$$
   - Bounding Box: $X_{\min}, Y_{\min}, W, H$
   - Estimated Font Size (in original image pixels):
     $$\text{height} = \frac{1}{2} \left( \sqrt{(x_4 - x_1)^2 + (y_4 - y_1)^2} + \sqrt{(x_3 - x_2)^2 + (y_3 - y_2)^2} \right)$$
2. **Text Color Estimation**:
   - Extract region crop from normalized PIL/OpenCV image.
   - Convert crop to grayscale and compute Otsu threshold or adaptive binarization to separate text glyphs from local background.
   - Filter foreground pixels and compute median RGB value to prevent antialiasing edge bias.
   - Return HEX string (e.g. `#ffffff`).
3. **Line Grouping**:
   - When multiple words are recognized along a continuous horizontal baseline with spacing $< 1.5 \times \text{height}$, merge into a coherent multiline / sentence block with grouped word confidence.
4. **Confidence Calibration**:
   - OCR Confidence: Product of detection score and recognition score ($0.0 \dots 1.0$).
   - Geometry Confidence: Quadrilateral aspect regularity and parallel edge check.

## 3. Frontend Click-to-Edit Workflow
1. **Detection Overlay**:
   - Render semi-transparent, non-destructive bounding quadrilaterals over detected text on the Fabric.js canvas.
   - Hovering highlights the polygon with an emerald glow and tooltip showing recognized text and confidence (e.g. `98%`).
2. **Click-to-Convert**:
   - Clicking a detected text polygon instantiates an editable `TextLayer` with:
     - `text`: recognized transcription
     - `fontSize`: estimated height in native pixels
     - `fill`: estimated text color
     - `left`, `top`, `width`, `height`, `angle` mapped from polygon
     - `origin`: `'ocr_detected'`
   - The user can immediately edit text, correct typos, adjust font style, or resize.
3. **Batch Adoption**:
   - "Convert All Detected Text" action to promote all high-confidence regions to editable layers in one click.
