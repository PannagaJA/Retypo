# Image Editor Backend

Python backend for AI Image Text Editor (PhoText Studio), providing image processing, normalization, OCR, inpainting, and compositing services.

## Conda Environment: `ocr`
All Python dependencies are installed exclusively in the **`ocr`** conda environment (Python 3.11). Nothing is installed globally.

### Activation & Running:
```bash
conda activate ocr
cd backend
uvicorn app.main:app --reload --port 8000
```

### Running Tests:
```bash
conda activate ocr
PYTHONPATH=. pytest tests
```
