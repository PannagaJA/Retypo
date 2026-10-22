# Project: AI Image Text Editor with High-Fidelity Typography Reconstruction

## Overview
A production-oriented, AI-powered image editing system that enables users to upload flattened images (PNG, JPG, JPEG, WebP) and edit existing text while preserving the original appearance as closely as technically feasible. Inspired by [PhoText](https://photext.ai/), this platform combines state-of-the-art OCR, typography parameter estimation & font matching, context-aware text masking & background inpainting, and high-resolution non-destructive compositing.

## Core Philosophy & Guiding Principles
1. **Fidelity & Non-Destructive Editing**: Never overwrite or degrade the original source image. Preserve all pixels outside of edited regions. Maintain lossless representations during the working session and compress only on final export.
2. **Honest Confidence & Alternatives**: Never present an estimated font, size, or inpainting result as 100% verified truth. Always supply confidence metrics, candidate rankings, and manual correction controls.
3. **Deterministic First, Generative When Needed**: Use deterministic image operations (solid color fill, gradient estimation, local interpolation) when appropriate, and invoke inpainting models (LaMa / deep inpainting) only when complex textures demand it.
4. **No Fake Pipelines**: All OCR, font matching, masking, and restoration features connect to real processing engines with graceful fallback and clear environment configuration.

## System Architecture

### Frontend
- **Framework**: React + TypeScript (strict mode) with Vite
- **Styling**: Tailwind CSS & modern design system
- **Interactive Canvas**: Fabric.js for high-fidelity canvas manipulation, selection handles, zoom/pan, multi-line editing, undo/redo
- **State Management**: Reactive state tracking non-destructive layers (Original, Masks, Inpainted Background, Editable Text Layers)

### Backend & Image Processing Service
- **Framework**: Python (FastAPI / Django REST Framework)
- **Image Analysis & Geometry**: OpenCV & Pillow for affine transformations, orientation/EXIF handling, perspective corrections, and morphological mask operations
- **OCR Engine**: PaddleOCR (with fallback / secondary engine support) providing text boxes, polygon coordinates, angles, and confidence
- **Typography Engine**: FontTools & glyph feature extractor for contour comparison, stroke width analysis, character aspect ratios, and ranking against a local open-source font library (e.g., Google Fonts subset)
- **Background Reconstruction**: Multi-tier restoration strategy:
  - Solid color fill
  - Directional gradient interpolation
  - Texture-aware patch synthesis & LaMa (Large Mask Inpainting)
- **Compositor**: Full-resolution compositing pipeline mapping screen-space edits back to original image pixel coordinates without downscaling artifacts

## Target Deliverables
- Working web editor interface with canvas controls, properties panel, layer tree, and before/after slider
- REST APIs for image ingestion, OCR analysis, mask generation, background restoration, font candidate ranking, and rendering
- Evaluation test suite measuring OCR accuracy, font matching top-k precision, mask boundary fidelity, and SSIM of non-edited regions
