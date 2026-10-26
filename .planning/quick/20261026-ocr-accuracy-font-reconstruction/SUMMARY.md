# Quick Task Summary: Retypo — OCR Accuracy & Font Reconstruction

**Status**: Complete ✓  
**Date**: 2026-10-26  
**Directory**: `.planning/quick/20261026-ocr-accuracy-font-reconstruction`

## Problems Identified & Root Causes
1. **Under-estimated Font Sizes (30% too small)**:
   - `geometry_service.py:calculate_font_size` multiplied bounding box height by `0.70`, which severely undersized digital UI typography.
   - *Fix*: Calibrated to true digital typography em-box standards (`char_height / 0.72`, bounded between `0.75 * h` and `1.05 * h`). Heading font sizes increased from 16px to 22-24px, matching native image scale.
2. **False Serif Matching on Numerals**:
   - `typography_service.py` evaluated Harris corner density on numbers and dates containing right angles (`1`, `4`, `7`), causing them to match `Merriweather` or `Playfair Display`.
   - *Fix*: Raised serif spur threshold to `>= 0.65`, enforced alphabetic check (`re.search(r'[a-zA-Z]', text)`), and defaulted digital UI labels to modern sans-serifs (`Inter`, `Montserrat`).
3. **Bounding Boxes Merging Icons and Text**:
   - DBNet detection grouped adjacent icons with text (e.g. wallet icon inside the "Account" button, filter sliders inside the "Filter" button, notification icons inside "1:55 0000").
   - *Fix*: Implemented `_separate_adjacent_icons` with minimum character width constraints, isolating characters and trimming polygons while leaving background icons untouched. Added noise cleanup in `_normalize_detected_text`.
4. **Dropped Currency Symbols (`₹`) in OCR Engine**:
   - PaddleOCR `PP-OCRv6_small_rec` dropped Unicode rupee symbol (`₹`) on numerical amounts.
   - *Fix*: Implemented visual currency recovery (`_recover_currency_symbols`) that checks the prefix crop for currency glyphs or document-level rupee context, specifically matching monetary amounts (e.g. `-₹105.00`, `+₹26,800.00`, `₹1,75,710.33`) while strictly preserving dates, percentages, account numbers, and IDs.
5. **Damaged Backgrounds from Heavy Mask Dilation**:
   - `mask_service.py` dilated text bounding boxes by 5-14px, obliterating surrounding borders, badges, and button shapes.
   - *Fix*: Replaced crop-wide thresholding with localized background ring contrast difference and Otsu thresholding on polygon pixels only. Micro-dilation reduced from 5-14px down to 1-3px, cutting inpainting mask size from 1201px down to 152px.
6. **Provider Inconsistency between Local (PaddleOCR) & Production (Google Cloud Vision)**:
   - Google Vision grouped entire paragraphs and disjoint columns into unwieldy multi-line boxes.
   - *Fix*: Standardized Google Vision parsing using spatial reading-order line clustering (50% vertical overlap, horizontal proximity gap <= 3.2x height) to produce line quads identical to PaddleOCR. Both engines share the identical downstream typography estimation and mask generation pipeline.
7. **Local Model Organization**:
   - Relocated downloaded PaddleX models into `models/official_models` inside the project root, added to `.gitignore` and `.dockerignore`, and set `PADDLE_PDX_CACHE_HOME` in all server entrypoints.

## Verification & Test Results
- **Pytest**: 28/28 tests passing (`backend/tests/`).
- **Vitest**: 25/25 tests passing (`frontend/`).
- **Frontend Build**: `tsc -b && vite build` built cleanly with 0 errors.
- **Regression Benchmark on Transactions Screenshot**:
  - `Transactions` heading: Font family `Inter`, size `24.0px`, weight `500`, color `#163128`.
  - Buttons (`Account`, `Filter`): Bounding boxes accurately cropped to text, wallet and slider icons preserved in the background.
  - Currency amounts: Restored `₹1,75,710.33`, `-₹105.00`, `-₹150.00`, `-₹30.00`, `+₹26,800.00`, `-₹25,270.00` with signs and symbols intact.
  - Numbers, dates, percentages: Preserved as-is (`40%`, `Oct 9, 2026`, `0607571542`, `Anandbabu344-1`) without false currency symbols or false serif classifications.
  - Status noise: Cleaned trailing notification icons (`1:55 0000` -> `1:55`).

## User Rule Compliance
- **No Git commits or staging performed** (all changes remain unstaged in working directory).
