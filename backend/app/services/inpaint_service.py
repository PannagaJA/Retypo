import io
import base64
import time
import numpy as np
import cv2
from PIL import Image
from typing import List, Tuple, Optional, Literal

from app.services.mask_service import generate_text_mask

InpaintStrategy = Literal["auto", "solid", "gradient", "telea", "ns", "lama"]

class InpaintingService:
    _instance: Optional["InpaintingService"] = None

    @classmethod
    def get_instance(cls) -> "InpaintingService":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def classify_background(self, crop: np.ndarray, mask: np.ndarray) -> str:
        """
        Analyzes the unmasked background pixels around the text to select
        the optimal deterministic or texture-aware restoration strategy.
        """
        unmasked = (mask == 0)
        if np.sum(unmasked) < 20:
            return "solid"

        # 1. Variance test on unmasked background pixels
        bg_pixels = crop[unmasked]
        std_per_channel = np.std(bg_pixels, axis=0)
        mean_std = float(np.mean(std_per_channel))

        # Flat / Solid background
        if mean_std < 5.0:
            return "solid"

        # 2. Linear Gradient Planar Fit Test
        # Test if background fits z = A*x + B*y + C
        h, w = mask.shape
        y_indices, x_indices = np.where(unmasked)
        if len(y_indices) > 50:
            # Build design matrix [x, y, 1]
            A_mat = np.column_stack([x_indices, y_indices, np.ones_like(x_indices)])
            # Test R^2 fit across luminance
            gray_unmasked = cv2.cvtColor(crop, cv2.COLOR_RGB2GRAY)[unmasked]
            try:
                params, residuals, _, _ = np.linalg.lstsq(A_mat, gray_unmasked, rcond=None)
                predicted = A_mat @ params
                total_var = np.sum((gray_unmasked - np.mean(gray_unmasked)) ** 2)
                if total_var > 1e-4:
                    residual_sum = np.sum((gray_unmasked - predicted) ** 2)
                    r_squared = 1.0 - (residual_sum / total_var)
                    if r_squared > 0.82 and mean_std < 30.0:
                        return "gradient"
            except Exception:
                pass

        # 3. For textured, photo, or organic backgrounds
        return "telea"

    def restore_region(
        self,
        image: Image.Image,
        polygon: List[List[float]],
        font_size: float = 32.0,
        strategy: InpaintStrategy = "auto",
        padding: int = 0
    ) -> dict:
        start_time = time.perf_counter()

        # 1. Generate text mask and extract crop
        mask_np, (x1, y1, x2, y2) = generate_text_mask(image, polygon, font_size, padding)
        crop_pil = image.crop((x1, y1, x2, y2)).convert("RGB")
        crop_np = np.array(crop_pil)

        # 2. Select strategy
        selected_strategy = strategy
        if strategy == "auto":
            selected_strategy = self.classify_background(crop_np, mask_np)

        # 3. Execute Inpainting Strategy
        restored_crop = crop_np.copy()

        if selected_strategy == "solid":
            restored_crop = self._inpaint_solid(crop_np, mask_np)
        elif selected_strategy == "gradient":
            restored_crop = self._inpaint_gradient(crop_np, mask_np)
        elif selected_strategy == "ns":
            inpaint_radius = max(3, min(15, int(round(font_size * 0.12))))
            restored_crop = cv2.inpaint(crop_np, mask_np, inpaintRadius=inpaint_radius, flags=cv2.INPAINT_NS)
        else: # "telea" or "lama" default
            inpaint_radius = max(3, min(15, int(round(font_size * 0.12))))
            restored_crop = cv2.inpaint(crop_np, mask_np, inpaintRadius=inpaint_radius, flags=cv2.INPAINT_TELEA)

        # 4. Encode restored patch to Base64 PNG
        restored_pil = Image.fromarray(restored_crop)
        buffer = io.BytesIO()
        restored_pil.save(buffer, format="PNG")
        patch_base64 = "data:image/png;base64," + base64.b64encode(buffer.getvalue()).decode("utf-8")

        # Encode binary mask to Base64 PNG for optional UI preview
        mask_pil = Image.fromarray(mask_np)
        mask_buf = io.BytesIO()
        mask_pil.save(mask_buf, format="PNG")
        mask_base64 = "data:image/png;base64," + base64.b64encode(mask_buf.getvalue()).decode("utf-8")

        elapsed_ms = round((time.perf_counter() - start_time) * 1000.0, 1)

        return {
            "patchDataUrl": patch_base64,
            "maskDataUrl": mask_base64,
            "bounds": {
                "left": x1,
                "top": y1,
                "width": x2 - x1,
                "height": y2 - y1,
            },
            "strategyUsed": selected_strategy,
            "processingTimeMs": elapsed_ms,
            "maskPixelCount": int(np.sum(mask_np == 255)),
        }

    def _inpaint_solid(self, crop: np.ndarray, mask: np.ndarray) -> np.ndarray:
        result = crop.copy()
        unmasked = (mask == 0)
        if np.sum(unmasked) == 0:
            return result
        # Compute median RGB of unmasked pixels
        median_color = np.median(crop[unmasked], axis=0).astype(np.uint8)
        result[mask == 255] = median_color
        return result

    def _inpaint_gradient(self, crop: np.ndarray, mask: np.ndarray) -> np.ndarray:
        result = crop.copy()
        h, w = mask.shape
        unmasked = (mask == 0)

        y_indices, x_indices = np.where(unmasked)
        if len(y_indices) < 10:
            return self._inpaint_solid(crop, mask)

        # Build coordinate design matrix
        A_mat = np.column_stack([x_indices, y_indices, np.ones_like(x_indices)])

        # Target grid for masked pixels
        y_masked, x_masked = np.where(mask == 255)
        if len(y_masked) == 0:
            return result

        target_A = np.column_stack([x_masked, y_masked, np.ones_like(x_masked)])

        # Fit each color channel separately
        for c in range(3):
            c_vals = crop[unmasked, c]
            try:
                params, _, _, _ = np.linalg.lstsq(A_mat, c_vals, rcond=None)
                reconstructed = target_A @ params
                result[y_masked, x_masked, c] = np.clip(reconstructed, 0, 255).astype(np.uint8)
            except Exception:
                result[mask == 255, c] = int(np.median(c_vals))

        return result
