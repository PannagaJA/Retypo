---
status: complete
date: 2026-10-22
title: Fix typography font matching, font size scaling, and color extraction
---

# Quick Task: Fix Typography Font, Size & Color Detection

## Root Causes Identified & Resolved
1. **Font Size Scaling**: OCR bounding box height was visual glyph height (e.g. 21px). Digital fonts have cap-height ≈ 0.72 of em-box fontSize. Directly setting fontSize=21px rendered glyphs at only 15px (30% too small). Calibrated in geometry_service.py with `font_size = glyph_height / 0.72`, producing 29.2px which renders letters at exact 21px visual height.
2. **Font Family Matching**: classify_serif had Harris corner threshold set below Arial, falsely tagging clean sans-serif text as Serif. Calibrated classify_serif and boosted contour cross-correlation to 0.55 weight in typography_service.py so Inter, Outfit, Roboto, and Montserrat rank at the top with matching weights.
3. **True Color Extraction**: Added morphological erosion on the Otsu foreground mask in geometry_service.py to discard anti-aliased edge bleed and sample 100% pure core ink pixels.
