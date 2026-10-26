import os
import sys

# Configure project-local models directory for PaddleX OCR weights
MODELS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "models")
os.environ.setdefault("PADDLE_PDX_CACHE_HOME", MODELS_DIR)
os.environ.setdefault("PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK", "True")

# Configure Paddle low-memory flags before importing any C++ frameworks
os.environ["FLAGS_use_mkldnn"] = "0"
os.environ["PADDLE_PDX_ENABLE_MKLDNN_BYDEFAULT"] = "0"
os.environ.setdefault("FLAGS_fraction_of_cpu_memory_to_use", "0.1")
os.environ.setdefault("FLAGS_allocator_strategy", "naive_best_fit")
os.environ.setdefault("FLAGS_eager_delete_scope", "True")
os.environ.setdefault("FLAGS_fast_eager_deletion_mode", "True")
os.environ.setdefault("CPU_NUM", "1")
os.environ.setdefault("OMP_NUM_THREADS", "1")
os.environ.setdefault("MKL_NUM_THREADS", "1")
os.environ.setdefault("OPENBLAS_NUM_THREADS", "1")
os.environ.setdefault("MALLOC_TRIM_THRESHOLD_", "100000")

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
    uvicorn.run(
        'app.main:app',
        host=host,
        port=port,
        reload=not is_prod,
        app_dir=backend_dir,
        workers=1
    )
