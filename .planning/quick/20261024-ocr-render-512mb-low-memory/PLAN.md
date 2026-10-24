---
status: complete
date: 2026-10-24
title: Render 512MB Free Tier OCR Optimization & Low-Memory Streaming Architecture
---

# Quick Task: Render 512MB Low-Memory OCR Weight Streaming & Optimization

## Context & Root Cause Analysis
Render's free tier provides a strict **512MB RAM ceiling** with zero swap memory. 
When PaddleOCR loads in standard mode:
1. **Three Concurrently Loaded Neural Networks**: Detection (`PP-OCRv4_det`), Recognition (`PP-OCRv4_rec`), and Angle/Direction Classifier (`ch_ppocr_mobile_v2.0_cls` via `use_textline_orientation=True`) all live in RAM simultaneously (~300MB–450MB).
2. **Framework Allocation Pools**: PaddlePaddle's default memory allocator reserves a massive workspace buffer pool and spawns multi-threaded OpenMP/MKL-DNN caches, instantly pushing total container RSS over 512MB, triggering Linux OOM (Exit code 137).
3. **Linux Glibc Memory Fragmentation**: Python & Paddle C++ tensor memory does not return to the Linux OS after inference, causing memory to accumulate across requests until OOM kill.

---

## Technical Implementation Completed

### 1. Stripped Unnecessary Models & Disabled MKL-DNN Memory Pools
- In `backend/app/services/ocr_service.py`:
  - `use_textline_orientation=False`: Dropped the 3rd neural network (angle/direction classifier) completely, saving **~90MB RAM**.
  - `enable_mkldnn=False`: Stopped MKL-DNN cache expansion from ballooning by **200MB+**.
  - `cpu_threads=1`, `use_gpu=False`, `show_log=False`.
  - `text_det_limit_side_len=736` (on low memory / Render mode) and `text_det_limit_type="max"`.
  - Single-engine cache: In low-memory mode, evicts previous engines when switching language.

### 2. Concurrency Lock & Memory Release
- Added `OCR_LOCK = threading.Lock()` to serialize all OCR calls so concurrent requests never double working buffers.
- Wrapped inference with `with OCR_LOCK:` and added `finally: gc.collect()`.
- Added image downsampling guard: In low-memory environments, caps maximum input dimension to 1200px before inference so DBNet activation tensors remain compact, while transparently scaling detected polygon coordinates back to original image size.

### 3. C++ Allocator & Glibc Trim Thresholds
- Set allocator flags before importing C++ modules in `run_server.py`, `backend/run_server.py`, and `backend/Dockerfile`:
  - `FLAGS_fraction_of_cpu_memory_to_use=0.1`
  - `FLAGS_allocator_strategy=naive_best_fit`
  - `FLAGS_eager_delete_scope=True`
  - `FLAGS_fast_eager_deletion_mode=True`
  - `CPU_NUM=1`, `OMP_NUM_THREADS=1`, `MKL_NUM_THREADS=1`, `OPENBLAS_NUM_THREADS=1`
  - `MALLOC_TRIM_THRESHOLD_=100000` (Forces Linux glibc memory allocator to release memory back to the host OS).

### 4. Worker Recycling on Render
- In `backend/Dockerfile` and `run_server.py`:
  - Configured Uvicorn with single worker and `--limit-max-requests 20` to periodically refresh the worker process and eliminate long-term memory leaks.

### 5. Verification
- 25/25 Pytest tests passing cleanly with 0 warnings.
- OCR text detection, normalization, and polygon math verified.
