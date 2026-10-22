# Research: Phase 3 — Text Segmentation, Accurate Masking & Multi-Tier Background Inpainting

## 1. Accurate Text Segmentation (Not Crude Rectangles)
- **Problem**: Inpainting an entire rectangular bounding box erases underlying textures, gradients, or nearby graphics unnecessarily.
- **Solution**: Accurate text mask extraction targeting:
  - Glyph interiors
  - Antialiased edges
  - Subtle text drop shadows / outlines
  - Avoiding non-text background structures
- **Methodology**:
  1. Crop bounding area with a padding margin (e.g. 10% of font size).
  2. Compute gradient magnitude and local contrast using grayscale derivative filters (Sobel / Laplacian).
  3. Binarize glyphs using adaptive Gaussian thresholding or Otsu thresholding calibrated against the border background color.
  4. Apply **Adaptive Morphological Dilation**:
     $$\text{kernel\_radius} = \max(2, \min(12, \text{round}(\text{font\_size} \times 0.08)))$$
     Using an elliptical structuring element (`cv2.MORPH_ELLIPSE`) to dilate smooth rounded text stroke edges.
  5. Fallback: If contrast is too low to extract discrete glyph contours cleanly, use the detected oriented quadrilateral with safe border padding.

## 2. Multi-Tier Background Restoration Architecture
Background restoration must operate locally on patch crops to preserve 100% of the pixels outside the target text region and maximize performance.

### Strategy Evaluation Hierarchy:
1. **Solid Color Fill (`solid`)**:
   - Condition: Perimeter pixel variance $\sigma^2 < 12.0$.
   - Method: Compute median RGB of boundary perimeter pixels around the text mask. Fill masked pixels with this color.
   - Result: 100% noise-free, exact match for flat UI, posters, and document backgrounds.

2. **Directional Gradient Reconstruction (`gradient`)**:
   - Condition: Low high-frequency texture, but significant directional gradient across bounding box ($R^2 > 0.85$ linear regression fit).
   - Method: Fit a 2D bilinear gradient plane $C(x, y) = A \cdot x + B \cdot y + C_0$ to perimeter pixels for each color channel. Reconstruct masked pixels from the fitted plane.
   - Result: Seamless gradient blending without blur artifacts.

3. **OpenCV Telea Fast Marching Method (`telea`)**:
   - Method: Solves the Eikonal equation to march boundary pixel values along isophotes (lines of equal gray level intensity).
   - Inpainting radius calibrated to font stroke width ($r \in [3, 9]$).
   - Result: Deterministic, fast (sub-10ms), excellent for organic textures and moderate photo grain.

4. **OpenCV Navier-Stokes Fluid Dynamics (`ns`)**:
   - Method: Uses fluid dynamics partial differential equations to propagate Laplacian smoothness and curl across the mask.
   - Result: Optimal for continuous tone images and photographic edges.

5. **Deep Generative Inpainting Interface (`lama`)**:
   - Model: Large Mask Inpainting (LaMa) using Fast Fourier Convolutions (FFC).
   - Modularity: Abstracted behind a common `InpaintingEngine` protocol. If GPU or checkpoint is unavailable, gracefully routes to Telea / Navier-Stokes.

## 3. Separate Background Patch Layer
- Edits are non-destructive:
  - Base Image: Unmodified original buffer.
  - Inpaint Patches: Stored as discrete `InpaintPatch` objects containing bounding coordinates, image data URL, and strategy used.
  - The canvas and exporter render Inpaint Patches on top of the base image and underneath the new editable text layers.
- The user can inspect the restored background with or without text layers to verify clean inpainting before finalizing typography.
