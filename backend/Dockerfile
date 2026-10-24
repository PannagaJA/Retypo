# Retypo Backend Dockerfile for Render / Cloud Containers
FROM python:3.11-slim

# Prevent python from buffering stdout/stderr and writing bytecode, and configure low memory flags
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8000 \
    PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK=True \
    MALLOC_TRIM_THRESHOLD_=100000 \
    OMP_NUM_THREADS=1 \
    OPENBLAS_NUM_THREADS=1 \
    MKL_NUM_THREADS=1 \
    CPU_NUM=1 \
    FLAGS_fraction_of_cpu_memory_to_use=0.1 \
    FLAGS_allocator_strategy=naive_best_fit \
    FLAGS_eager_delete_scope=True \
    FLAGS_fast_eager_deletion_mode=True \
    LOW_MEMORY_MODE=true

# Install system dependencies required by OpenCV and PaddlePaddle
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    libgomp1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-verify RapidOCR embedded ONNX models (zero network downloads required)
RUN python -c "from rapidocr_onnxruntime import RapidOCR; RapidOCR()"

# Copy backend application code and assets
COPY app ./app
COPY assets ./assets
COPY README.md .

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:${PORT}/api/health || exit 1

EXPOSE 8000

# Start Uvicorn bound to dynamic $PORT with single worker & request limit to prevent memory creep
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1 --limit-max-requests 20"]
