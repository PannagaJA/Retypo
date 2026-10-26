---
status: in-progress
date: 2026-10-26
title: Retypo - Fix OCR Accuracy & Font Reconstruction
---

# Quick Task: Fix OCR Accuracy & Font Reconstruction

## Objectives
1. **Accurate Text-Only Detection & Icon Separation**:
   - Filter out icons, arrows, logos, battery/status meters, and decorative UI elements from being detected as text.
   - Separate text labels from adjacent component icons (e.g. wallet in Account button, sliders/chevron in Filter button).
   - Preserve genuine text symbols (₹, %, +, −, decimals, commas, quotes).
2. **Typography Reconstruction & Font Matching**:
   - Accurately estimate font size in native image pixels calibrated to em-box and cap-height (fixing 30% undersizing).
   - Accurately estimate font weight from stroke-to-height ratio with digital screen calibrations.
   - Improve visual font matching and serif/sans classification so modern mobile UI matches Inter/Roboto sans-serif rather than false serifs.
   - Correct text color sampling with perimeter inset to avoid sampling annotation/border colors.
   - Adjust baseline and bounding box positioning so Fabric.js textboxes align directly over original text.
3. **Preserve Image Quality in Masking & Inpainting**:
   - Generate precision glyph masks isolating only text ink strokes (dilated by 1-2px for anti-aliasing) instead of wiping out entire rectangular areas.
   - Preserve surrounding buttons, container borders, gradients, and icons during text removal.
4. **Unified OCR Pipeline & GCV Normalization**:
   - Normalize Google Cloud Vision word/line grouping with baseline clustering to match PaddleOCR structure.
   - Apply identical text filtering, currency recovery, typography matching, and masking across both engines.
5. **Free-Tier Deployment & Resource Optimization**:
   - Maintain strict low-memory guarantees (<512MB RAM), singleton caching, glibc trims, and fast inference.
6. **Regression Verification**:
   - Benchmark against the user's financial transactions screenshot and all existing backend/frontend test suites.
