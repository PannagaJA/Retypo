# Research: Phase 4 — Typography Reconstruction & Font Matching Engine

## 1. Font Library Indexing & Catalogue Metadata
- To achieve high-fidelity reconstruction without arbitrary font substitutions, we index a rich catalogue of popular open-source fonts:
  - **Sans-Serif**: Inter, Roboto, Montserrat, Open Sans, Lato, Poppins, Outfit
  - **Serif**: Playfair Display, Georgia, Merriweather, Times New Roman
  - **Display / Heading**: Oswald, Bebas Neue, Montserrat
  - **Monospace**: Courier Prime, Roboto Mono
- Metadata schema per font entry:
  - `family`: string (e.g. "Montserrat")
  - `category`: "sans-serif" | "serif" | "display" | "monospace"
  - `availableWeights`: ["300", "400", "500", "600", "700", "800"]
  - `hasItalics`: boolean
  - `averageCharAspect`: number (average width / height ratio for Latin glyphs)
  - `strokeCharacteristics`: contrast ratio (high contrast in Didone serifs vs uniform in Grotesque sans)

## 2. Multi-Signal Typography Analysis Pipeline
Rather than relying on a single fallible similarity metric, the engine combines **4 orthogonal signals**:

### Signal 1: Stroke Width / Weight Estimation (Distance Transform)
- Compute Euclidean Distance Transform on the binary glyph mask:
  $$\text{Dist} = \text{cv2.distanceTransform}(\text{glyph\_mask}, \text{cv2.DIST\_L2}, 5)$$
- The medial axis peak corresponds to half the stroke width:
  $$\text{stroke\_width} \approx 2 \times \text{percentile}(\text{Dist}[\text{Dist} > 0], 90)$$
- Relative stroke thickness:
  $$\tau = \frac{\text{stroke\_width}}{\text{font\_size}}$$
  - $\tau < 0.08 \implies 300$ (Light)
  - $0.08 \le \tau < 0.12 \implies 400$ (Regular)
  - $0.12 \le \tau < 0.16 \implies 500$ (Medium)
  - $0.16 \le \tau < 0.20 \implies 600$ (Semi-Bold)
  - $\tau \ge 0.20 \implies 700 / 800$ (Bold / Extra-Bold)

### Signal 2: Aspect Ratio & Width Distribution
- Compare text line length with candidate font rendering:
  $$\text{Sim}_{\text{aspect}} = 1.0 - \min\left(1.0, \frac{|\text{Width}_{\text{orig}} - \text{Width}_{\text{candidate}}|}{\text{Width}_{\text{orig}}}\right)$$

### Signal 3: Serif vs Sans-Serif Classification
- Corner and terminal stroke gradient analysis:
  - Serifs produce characteristic perpendicular high-gradient spurs at horizontal/vertical terminal strokes (detected using Harris corner response or oriented morphological kernels).
  - High corner spur density $\implies$ prioritize serif fonts (Playfair Display, Georgia).

### Signal 4: Glyph Contour Correlation (Normalized Cross-Correlation / SSIM)
- Render the recognized text string using the candidate font at the estimated font size into a matching binary mask.
- Resize candidate mask to target bounding box dimensions.
- Compute normalized template matching correlation:
  $$\text{Sim}_{\text{contour}} = \frac{\sum (M_{\text{orig}} \cdot M_{\text{candidate}})}{\sqrt{\sum M_{\text{orig}}^2 \cdot \sum M_{\text{candidate}}^2}}$$

### Composite Ranking Score:
$$\text{Confidence} = 0.40 \cdot \text{Sim}_{\text{contour}} + 0.25 \cdot \text{Sim}_{\text{aspect}} + 0.20 \cdot \text{Sim}_{\text{weight}} + 0.15 \cdot \text{Sim}_{\text{serif}}$$

## 3. Frontend Candidate Picker UI
- In `PropertiesPanel.tsx`, add "Match Font Typography":
  - Triggers asynchronous matching API.
  - Displays top candidate rankings with match percentage badges (e.g. `1. Montserrat (94%)`, `2. Inter (88%)`).
  - Hovering previews the font on the selected layer in real time.
  - Clicking applies font family, weight, tracking, and fitted font size.
