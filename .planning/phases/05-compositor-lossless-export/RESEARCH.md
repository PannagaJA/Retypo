# Research: Phase 5 — High-Fidelity Non-Destructive Compositor & Lossless Export

## 1. Zero-Loss Non-Destructive Compositing Model
Conventional browser or canvas image editors often draw the entire image into an HTML5 `<canvas>`, then call `toDataURL('image/jpeg')`. This produces catastrophic global quality degradation:
1. Re-quantization of unedited pixels introduces high-frequency DCT blocking artifacts across unchanged regions.
2. Loss of embedded color profiles (sRGB, Display P3, Adobe RGB) causes noticeable color shifts.
3. Canvas resizing downsamples images exceeding hardware GPU limits (e.g. 4096px on mobile/integrated GPUs).

### The Solution: Selective Region Blending
- **Untouched Pixel Guarantee**:
  $$\forall (x,y) \notin \bigcup_{i} \text{Region}_i, \quad I_{\text{export}}(x,y) = I_{\text{source}}(x,y)$$
  Untouched pixels remain mathematically identical to the original file.
- **Edge Feathering & Seam Elimination**:
  At the boundary of each inpaint patch, a 2-pixel cosine-weighted alpha feather eliminates abrupt cut-line seams:
  $$\alpha(d) = \frac{1}{2} \left(1 + \cos\left(\frac{\pi d}{w_{\text{feather}}}\right)\right)$$

## 2. Server-Side Vector Typography Rasterization
For true high-resolution compositing at native camera resolution (4K, 8K, 300+ DPI), text layers must be composited on the server at native pixel coordinates:
- **Typography Engine**:
  - Pillow `ImageFont.truetype` with TrueType/OpenType font files.
  - Precise font metrics: ascent, descent, bounding box, tracking, and leading.
- **Text Layer Effects**:
  - **Drop Shadow**: Rendered into an isolated alpha channel, offset by `(offsetX, offsetY)`, filtered with `ImageFilter.GaussianBlur(blur/2)`, and composited beneath the text fill.
  - **Stroke / Outline**: Rendered with sub-pixel contour dilation (`stroke_width`, `stroke_fill`).
  - **Rotation**: Transformed around center or top-left pivot using bicubic resampling (`resample=Image.Resampling.BICUBIC`).
  - **Tracking & Multi-Line**: Custom glyph offset positioning supporting multi-line alignment (`left`, `center`, `right`).

## 3. Color Profile & Compression Strategy
- **ICC Profile Passthrough**:
  - Extract `icc_profile = source_image.info.get("icc_profile")`.
  - Pass directly to `img.save(buffer, format=fmt, icc_profile=icc_profile)`.
- **Export Format Optimization**:
  - **PNG**: Maximum lossless compression (`compress_level=9`, `optimize=True`).
  - **WebP**: Lossless mode (`lossless=True`, `quality=100`) or near-lossless (`quality=95`).
  - **JPEG**: Studio quality (`quality=98`, `subsampling=0` / 4:4:4 chroma, `optimize=True`, progressive encoding).

## 4. Automated Quality Telemetry (SSIM & Delta E)
To mathematically verify non-destructive editing:
- Measure structural similarity (SSIM) exclusively on the untouched region mask:
  $$\text{SSIM}_{\text{unedited}} = \text{structural_similarity}(I_{\text{orig}}[\sim M], I_{\text{comp}}[\sim M]) \approx 1.000$$
- Verify that color difference $\Delta E$ is strictly zero outside edited regions.
