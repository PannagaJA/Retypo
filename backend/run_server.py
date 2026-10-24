import os
import sys

# Auto-detect and switch to dedicated OCR conda environment if current python lacks dependencies
OCR_PYTHON = "/opt/homebrew/Caskroom/miniconda/base/envs/ocr/bin/python"
try:
    import cv2
    import paddleocr
except ImportError:
    if os.path.exists(OCR_PYTHON) and os.path.realpath(sys.executable) != os.path.realpath(OCR_PYTHON):
        print(f"[*] Activating OCR environment: {OCR_PYTHON}")
        os.execv(OCR_PYTHON, [OCR_PYTHON] + sys.argv)

# Add backend directory to sys.path
backend_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'backend')
if not os.path.exists(backend_dir):
    backend_dir = os.path.dirname(os.path.abspath(__file__))

if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

if __name__ == '__main__':
    import uvicorn
    host = os.getenv("HOST", "127.0.0.1")
    port = int(os.getenv("PORT", 8000))
    is_prod = os.getenv("RENDER") is not None or os.getenv("ENVIRONMENT") == "production"
    uvicorn.run('app.main:app', host=host, port=port, reload=not is_prod, app_dir=backend_dir)
