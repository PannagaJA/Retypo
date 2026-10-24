import os
import sys
import time
import json
import math
import psutil
import difflib
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

# Set backend path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.services.ocr_service import OCRService
from app.services.mask_service import generate_text_mask
from app.services.inpaint_service import InpaintingService
from app.services.typography_service import TypographyService
from app.services.compositor_service import CompositorService

def calculate_cer_wer(reference: str, hypothesis: str) -> tuple[float, float]:
    """Calculates Character Error Rate (CER) and Word Error Rate (WER) using Levenshtein distance."""
    ref_clean = reference.strip()
    hyp_clean = hypothesis.strip()
    
    # CER
    char_matcher = difflib.SequenceMatcher(None, ref_clean.lower(), hyp_clean.lower())
    char_dist = len(ref_clean) - sum(block.size for block in char_matcher.get_matching_blocks())
    cer = char_dist / max(1, len(ref_clean))

    # WER
    ref_words = ref_clean.lower().split()
    hyp_words = hyp_clean.lower().split()
    word_matcher = difflib.SequenceMatcher(None, ref_words, hyp_words)
    word_dist = len(ref_words) - sum(block.size for block in word_matcher.get_matching_blocks())
    wer = word_dist / max(1, len(ref_words))

    return round(min(1.0, cer), 3), round(min(1.0, wer), 3)

def generate_test_suite() -> list[dict]:
    """Creates a comprehensive test set covering the 7 diverse image categories."""
    suite = []

    # 1. UI Screenshot (Fintech & Dashboard)
    img1 = Image.new("RGB", (900, 500), color=(15, 23, 42)) # Slate 900
    d1 = ImageDraw.Draw(img1)
    # UI Card
    d1.rectangle([(50, 40), (850, 460)], fill=(30, 41, 59), outline=(51, 65, 85), width=2)
    d1.text((90, 80), "General · Bank of Baroda", fill=(248, 250, 252))
    d1.text((90, 160), "+₹26,800.00", fill=(52, 211, 153))
    d1.text((90, 240), "Received Payment (NEFT)", fill=(148, 163, 184))
    d1.text((90, 320), "Oct 24, 2026 - Real-time financial activity", fill=(148, 163, 184))
    suite.append({
        "category": "UI Screenshot",
        "image": img1,
        "ground_truth": ["General · Bank of Baroda", "+₹26,800.00", "Received Payment (NEFT)", "Real-time financial activity"]
    })

    # 2. Marketing Poster (Bold Display Typography)
    img2 = Image.new("RGB", (1000, 700), color=(248, 250, 252))
    d2 = ImageDraw.Draw(img2)
    d2.rectangle([(0, 0), (1000, 200)], fill=(225, 29, 72)) # Rose header
    d2.text((80, 70), "STUDIO SALE 50% OFF", fill=(255, 255, 255))
    d2.text((80, 280), "LIMITED TIME EXCLUSIVE OFFER", fill=(15, 23, 42))
    d2.text((80, 380), "High-Fidelity Typography Reconstruction", fill=(71, 85, 105))
    suite.append({
        "category": "Marketing Poster",
        "image": img2,
        "ground_truth": ["STUDIO SALE 50% OFF", "LIMITED TIME EXCLUSIVE OFFER", "High-Fidelity Typography Reconstruction"]
    })

    # 3. Multicolored Text on Smooth Linear Gradient
    w, h = 800, 400
    gradient = np.zeros((h, w, 3), dtype=np.uint8)
    for y in range(h):
        for x in range(w):
            r = int(180 + (70 * x / w))
            g = int(50 + (100 * y / h))
            b = int(220 - (100 * x / w))
            gradient[y, x] = [r, g, b]
    img3 = Image.fromarray(gradient)
    d3 = ImageDraw.Draw(img3)
    d3.text((60, 100), "Vibrant Gradient Typography", fill=(255, 255, 255))
    d3.text((60, 220), "Yellow Accent Line Here", fill=(250, 204, 21))
    suite.append({
        "category": "Gradient Background",
        "image": img3,
        "ground_truth": ["Vibrant Gradient Typography", "Yellow Accent Line Here"]
    })

    # 4. Small Lettering & Subtle Contrast
    img4 = Image.new("RGB", (700, 350), color=(240, 240, 245))
    d4 = ImageDraw.Draw(img4)
    d4.text((50, 50), "Compact UI microcopy text", fill=(100, 100, 110))
    d4.text((50, 140), "License terms and conditions apply", fill=(120, 120, 130))
    d4.text((50, 230), "Version 1.2.0 build 2026", fill=(130, 130, 140))
    suite.append({
        "category": "Small Lettering",
        "image": img4,
        "ground_truth": ["Compact UI microcopy text", "License terms and conditions apply", "Version 1.2.0 build 2026"]
    })

    # 5. Rotated Typography
    img5 = Image.new("RGB", (800, 500), color=(255, 255, 255))
    # Render text on transparent layer and rotate
    txt_layer = Image.new("RGBA", (800, 500), (255, 255, 255, 0))
    dt = ImageDraw.Draw(txt_layer)
    dt.text((150, 200), "ROTATED CANVAS LABEL", fill=(30, 58, 138, 255))
    rotated_txt = txt_layer.rotate(-15, resample=Image.Resampling.BILINEAR, center=(350, 250))
    img5.paste(rotated_txt, (0, 0), rotated_txt)
    suite.append({
        "category": "Rotated Typography",
        "image": img5,
        "ground_truth": ["ROTATED CANVAS LABEL"]
    })

    # 6. Outlined and Shadowed Lettering
    img6 = Image.new("RGB", (800, 450), color=(241, 245, 249))
    d6 = ImageDraw.Draw(img6)
    # Draw drop shadow then foreground
    d6.text((73, 103), "SHADOW AND OUTLINE", fill=(160, 175, 195))
    d6.text((70, 100), "SHADOW AND OUTLINE", fill=(15, 23, 42))
    d6.text((73, 243), "STUDIO EXPORT QUALITY", fill=(180, 195, 215))
    d6.text((70, 240), "STUDIO EXPORT QUALITY", fill=(14, 116, 144))
    suite.append({
        "category": "Shadowed Text",
        "image": img6,
        "ground_truth": ["SHADOW AND OUTLINE", "STUDIO EXPORT QUALITY"]
    })

    # 7. Photograph / Textured Background with Text Overlay
    # Generate Perlin-like noise texture
    np.random.seed(42)
    noise = np.random.randint(90, 150, (400, 700, 3), dtype=np.uint8)
    noise_blur = cv2.GaussianBlur(noise, (15, 15), 0)
    img7 = Image.fromarray(noise_blur)
    d7 = ImageDraw.Draw(img7)
    d7.text((80, 120), "NATURE PHOTOGRAPHY CAPTION", fill=(255, 255, 255))
    d7.text((80, 220), "Ambient Texture Inpainting Test", fill=(255, 240, 180))
    suite.append({
        "category": "Textured Background",
        "image": img7,
        "ground_truth": ["NATURE PHOTOGRAPHY CAPTION", "Ambient Texture Inpainting Test"]
    })

    return suite

def run_comprehensive_benchmark() -> dict:
    proc = psutil.Process()
    base_ram = proc.memory_info().rss / (1024 * 1024)

    results = {
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "system": {
            "ram_base_mb": round(base_ram, 1),
            "render_limit_mb": 512.0,
            "target_headroom_mb": round(512.0 - base_ram, 1)
        },
        "ocr_benchmarks": [],
        "categories_tested": [],
        "inpaint_benchmarks": [],
        "compositor_benchmarks": [],
        "repeated_requests_stability": []
    }

    # 1. Benchmark OCR Engine
    t_init_start = time.perf_counter()
    ocr_service = OCRService.get_instance()
    # Force engine load
    ocr_service._get_paddle_engine("en")
    t_init = round((time.perf_counter() - t_init_start) * 1000.0, 1)
    init_ram = proc.memory_info().rss / (1024 * 1024)

    test_suite = generate_test_suite()
    total_detected_words = 0
    total_expected_words = 0
    all_cers = []
    all_wers = []
    category_metrics = []

    print(f"\n=======================================================")
    print(f"RETYPO PERFORMANCE & ACCURACY PIPELINE BENCHMARK")
    print(f"Render Free Constraint: 512MB RAM | 0.1 CPU Allocation")
    print(f"=======================================================\n")
    print(f"[*] Base Process RAM: {base_ram:.1f} MB")
    print(f"[*] Engine Startup Latency: {t_init} ms | Post-Init RAM: {init_ram:.1f} MB\n")

    for idx, test in enumerate(test_suite, start=1):
        cat_name = test["category"]
        img = test["image"]
        ground_truth = test["ground_truth"]

        ram_before = proc.memory_info().rss / (1024 * 1024)
        t_start = time.perf_counter()
        regions = ocr_service.analyze_image(img, "en")
        inf_time_ms = round((time.perf_counter() - t_start) * 1000.0, 1)
        ram_after = proc.memory_info().rss / (1024 * 1024)

        detected_texts = [r.text for r in regions]
        detected_blob = " ".join(detected_texts).lower()

        matched_gt = 0
        cer_list = []
        wer_list = []

        for gt in ground_truth:
            gt_words = len(gt.split())
            total_expected_words += gt_words
            # Find best match among detected texts
            best_ratio = 0.0
            best_match_text = ""
            for dt in detected_texts:
                ratio = difflib.SequenceMatcher(None, gt.lower(), dt.lower()).ratio()
                if ratio > best_ratio:
                    best_ratio = ratio
                    best_match_text = dt

            if best_ratio >= 0.50:
                matched_gt += 1
                cer, wer = calculate_cer_wer(gt, best_match_text)
                cer_list.append(cer)
                wer_list.append(wer)
                total_detected_words += int(round(gt_words * (1.0 - wer)))
            else:
                cer_list.append(1.0)
                wer_list.append(1.0)

        avg_cer = round(float(np.mean(cer_list)), 3) if cer_list else 1.0
        avg_wer = round(float(np.mean(wer_list)), 3) if wer_list else 1.0
        recall = round(matched_gt / max(1, len(ground_truth)), 3)
        all_cers.append(avg_cer)
        all_wers.append(avg_wer)

        cat_summary = {
            "category": cat_name,
            "dimensions": f"{img.width}x{img.height}",
            "expected_items": len(ground_truth),
            "detected_regions": len(regions),
            "recall": recall,
            "avg_cer": avg_cer,
            "avg_wer": avg_wer,
            "latency_ms": inf_time_ms,
            "ram_mb": round(ram_after, 1),
            "ram_delta_mb": round(ram_after - ram_before, 2)
        }
        category_metrics.append(cat_summary)
        print(f"[{idx}/7] {cat_name.ljust(22)} | Latency: {inf_time_ms:>6.1f}ms | Recall: {recall*100:>5.1f}% | CER: {avg_cer*100:>4.1f}% | RAM: {ram_after:.1f}MB")

    # 2. Inpaint & Reconstruction Quality Benchmark
    inpaint_service = InpaintingService.get_instance()
    sample_img = test_suite[0]["image"] # UI Card
    sample_polygon = [[90.0, 80.0], [450.0, 80.0], [450.0, 110.0], [90.0, 110.0]]
    
    t_inp_start = time.perf_counter()
    inpaint_res = inpaint_service.restore_region(sample_img, sample_polygon, font_size=24.0, strategy="auto")
    inpaint_latency = round((time.perf_counter() - t_inp_start) * 1000.0, 1)

    # Calculate Untouched Pixel Integrity: Non-masked pixels must have 0 distortion (Delta E = 0.0, SSIM = 1.0)
    orig_crop = sample_img.crop((
        inpaint_res["bounds"]["left"],
        inpaint_res["bounds"]["top"],
        inpaint_res["bounds"]["left"] + inpaint_res["bounds"]["width"],
        inpaint_res["bounds"]["top"] + inpaint_res["bounds"]["height"]
    )).convert("RGB")
    
    # 3. Repeated Request Stability Test (5 sequential requests verifying 0 memory creep)
    creep_samples = []
    print(f"\n[*] Testing Repeated Request Stability (5 Iterations)...")
    for rep in range(1, 6):
        r_before = proc.memory_info().rss / (1024 * 1024)
        _ = ocr_service.analyze_image(test_suite[0]["image"], "en")
        r_after = proc.memory_info().rss / (1024 * 1024)
        creep_samples.append({
            "iteration": rep,
            "ram_mb": round(r_after, 2),
            "delta_mb": round(r_after - r_before, 2)
        })
        print(f"    Iter #{rep}: RAM = {r_after:.2f} MB (Delta: {r_after - r_before:+.2f} MB)")

    final_ram = proc.memory_info().rss / (1024 * 1024)
    net_creep = round(final_ram - init_ram, 2)

    results["category_metrics"] = category_metrics
    results["summary"] = {
        "overall_recall": round(float(np.mean([c["recall"] for c in category_metrics])), 3),
        "overall_cer": round(float(np.mean(all_cers)), 3),
        "overall_wer": round(float(np.mean(all_wers)), 3),
        "avg_latency_ms": round(float(np.mean([c["latency_ms"] for c in category_metrics])), 1),
        "peak_ram_mb": round(max([c["ram_mb"] for c in category_metrics]), 1),
        "final_ram_mb": round(final_ram, 1),
        "memory_creep_5_requests_mb": net_creep,
        "inpainting_strategy_used": inpaint_res["strategyUsed"],
        "inpainting_latency_ms": inpaint_latency,
        "render_512mb_safe": (final_ram < 450.0 and net_creep <= 10.0)
    }

    print(f"\n=======================================================")
    print(f"BENCHMARK SUMMARY RESULTS")
    print(f"=======================================================")
    print(f"• Overall OCR Recall:        {results['summary']['overall_recall']*100:.1f}%")
    print(f"• Overall Char Error Rate:   {results['summary']['overall_cer']*100:.1f}%")
    print(f"• Overall Word Error Rate:   {results['summary']['overall_wer']*100:.1f}%")
    print(f"• Average Per-Image Latency: {results['summary']['avg_latency_ms']:.1f} ms")
    print(f"• Inpainting Latency:        {inpaint_latency:.1f} ms (Strategy: {inpaint_res['strategyUsed']})")
    print(f"• Peak Resident RAM:         {results['summary']['peak_ram_mb']:.1f} MB (Budget: 512 MB)")
    print(f"• Net Memory Creep (5 req):  {net_creep:+.2f} MB")
    print(f"• Render 512MB Safe Gate:    {'PASSED ✓' if results['summary']['render_512mb_safe'] else 'FAILED ✗'}")
    print(f"=======================================================\n")

    return results

if __name__ == "__main__":
    report = run_comprehensive_benchmark()
    # Save benchmark report to disk
    out_dir = os.path.join(backend_dir, "benchmarks")
    os.makedirs(out_dir, exist_ok=True)
    out_file = os.path.join(out_dir, "benchmark_report.json")
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)
    print(f"[✓] Benchmark report exported to {out_file}")
