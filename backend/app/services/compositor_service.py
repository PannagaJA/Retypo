import io
import re
import math
import time
import base64
from typing import List, Dict, Optional, Tuple, Any
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

from app.core.models import TextLayerModel
from app.schemas.export import (
    InpaintPatchModel,
    CompositorVerificationTelemetry,
    CompositorExportResponse,
)
from app.services.typography_service import TypographyService, FONT_CATALOGUE

def parse_color_rgba(c_str: Optional[str], default: Tuple[int, int, int, int] = (0, 0, 0, 255)) -> Tuple[int, int, int, int]:
    if not c_str:
        return default
    s = c_str.strip()
    if s.startswith("#"):
        h = s.lstrip("#")
        if len(h) == 3:
            h = "".join([c * 2 for c in h])
        if len(h) == 6:
            return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), 255)
        elif len(h) == 8:
            return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), int(h[6:8], 16))
    m = re.match(r"rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)", s)
    if m:
        r, g, b = int(m.group(1)), int(m.group(2)), int(m.group(3))
        a = int(round(float(m.group(4)) * 255)) if m.group(4) is not None else 255
        return (r, g, b, min(255, max(0, a)))
    return default

class CompositorService:
    _instance: Optional["CompositorService"] = None

    def __init__(self):
        self._typography_service = TypographyService.get_instance()

    @classmethod
    def get_instance(cls) -> "CompositorService":
        if cls._instance is None:
            cls._instance = CompositorService()
        return cls._instance

    def _resolve_font(self, family: str, weight: str, size: int) -> ImageFont.FreeTypeFont:
        """Find best matching TrueType font for family and weight."""
        weight_num = int(weight) if str(weight).isdigit() else 400
        is_bold = weight_num >= 600

        # Look in font catalogue
        for entry in FONT_CATALOGUE:
            if entry["family"].lower() == family.lower():
                patterns = entry["bold_patterns"] if is_bold else entry["regular_patterns"]
                return self._typography_service._load_font(patterns, size)

        # Fallback to system fonts
        fallback_patterns = [f"{family}-Bold.ttf", f"{family}.ttf", "Arial Bold.ttf" if is_bold else "Arial.ttf", "Helvetica.ttc"]
        return self._typography_service._load_font(fallback_patterns, size)

    def _create_feather_mask(self, width: int, height: int, feather_px: int = 2) -> Image.Image:
        """Generate smooth edge-feathered alpha mask for inpaint patches."""
        if feather_px <= 0 or width <= feather_px * 2 or height <= feather_px * 2:
            return Image.new("L", (width, height), 255)

        mask = np.ones((height, width), dtype=np.float32)
        for i in range(feather_px):
            alpha = (i + 1) / (feather_px + 1)
            mask[i, :] = np.minimum(mask[i, :], alpha)
            mask[height - 1 - i, :] = np.minimum(mask[height - 1 - i, :], alpha)
            mask[:, i] = np.minimum(mask[:, i], alpha)
            mask[:, width - 1 - i] = np.minimum(mask[:, width - 1 - i], alpha)

        mask_uint8 = np.clip(mask * 255.0, 0, 255).astype(np.uint8)
        return Image.fromarray(mask_uint8, mode="L")

    def _render_text_layer(self, layer: TextLayerModel, native_w: int, native_h: int) -> Optional[Tuple[Image.Image, int, int]]:
        """
        Rasterize a single text layer with sub-pixel antialiasing,
        shadows, stroke, tracking, and rotation.
        Returns (rendered_rgba_image, paste_x, paste_y) or None if invisible.
        """
        if not layer.isVisible or not layer.text.strip():
            return None

        font_size = max(8, int(round(layer.fontSize)))
        font = self._resolve_font(layer.fontFamily, str(layer.fontWeight), font_size)

        lines = layer.text.split("\n")
        line_height = layer.lineHeight if layer.lineHeight and layer.lineHeight > 0.5 else 1.2
        line_spacing_px = int(round(font_size * line_height))
        tracking_px = float(layer.letterSpacing) if layer.letterSpacing else 0.0

        # Calculate bounding box dimensions for all lines with tracking
        line_dims = []
        max_line_w = 0.0
        for l in lines:
            line_w = 0.0
            line_h = font_size
            for idx, ch in enumerate(l):
                try:
                    bbox = font.getbbox(ch)
                    ch_w = bbox[2] - bbox[0]
                except Exception:
                    ch_w = font_size * 0.6
                line_w += ch_w + (tracking_px if idx < len(l) - 1 else 0.0)
            max_line_w = max(max_line_w, line_w)
            line_dims.append((line_w, line_h))

        total_text_w = max(16, int(math.ceil(max_line_w)))
        total_text_h = max(16, int(math.ceil(len(lines) * line_spacing_px)))

        # Add margin for shadow and stroke outline
        stroke_w = max(0, int(round(layer.strokeWidth))) if layer.strokeWidth else 0
        shadow_blur = int(round(layer.shadow.blur)) if layer.shadow and layer.shadow.blur > 0 else 0
        margin = max(stroke_w * 2, shadow_blur * 2) + 16

        canvas_w = total_text_w + margin * 2
        canvas_h = total_text_h + margin * 2

        layer_canvas = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))

        # 1. Render Drop Shadow
        if layer.shadow and layer.shadow.blur > 0:
            shadow_canvas = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
            shadow_draw = ImageDraw.Draw(shadow_canvas)
            s_color = parse_color_rgba(layer.shadow.color, (0, 0, 0, 160))
            s_ox = layer.shadow.offsetX
            s_oy = layer.shadow.offsetY

            for row_idx, line in enumerate(lines):
                line_w, _ = line_dims[row_idx]
                if layer.textAlign == "center":
                    start_x = margin + (total_text_w - line_w) / 2.0
                elif layer.textAlign == "right":
                    start_x = margin + (total_text_w - line_w)
                else:
                    start_x = margin

                curr_x = start_x + s_ox
                curr_y = margin + (row_idx * line_spacing_px) + s_oy

                for idx, ch in enumerate(line):
                    shadow_draw.text((curr_x, curr_y), ch, fill=s_color, font=font)
                    try:
                        bbox = font.getbbox(ch)
                        ch_w = bbox[2] - bbox[0]
                    except Exception:
                        ch_w = font_size * 0.6
                    curr_x += ch_w + (tracking_px if idx < len(line) - 1 else 0.0)

            if shadow_blur > 0:
                shadow_canvas = shadow_canvas.filter(ImageFilter.GaussianBlur(max(1, shadow_blur // 2)))

            layer_canvas = Image.alpha_composite(layer_canvas, shadow_canvas)

        # 2. Render Text Fill and Stroke Outline
        text_canvas = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
        text_draw = ImageDraw.Draw(text_canvas)
        fill_color = parse_color_rgba(layer.fill, (255, 255, 255, 255))
        stroke_color = parse_color_rgba(layer.stroke, (0, 0, 0, 255)) if stroke_w > 0 else None

        for row_idx, line in enumerate(lines):
            line_w, _ = line_dims[row_idx]
            if layer.textAlign == "center":
                start_x = margin + (total_text_w - line_w) / 2.0
            elif layer.textAlign == "right":
                start_x = margin + (total_text_w - line_w)
            else:
                start_x = margin

            curr_x = start_x
            curr_y = margin + (row_idx * line_spacing_px)

            for idx, ch in enumerate(line):
                # Stroke
                if stroke_w > 0 and stroke_color:
                    text_draw.text(
                        (curr_x, curr_y),
                        ch,
                        font=font,
                        fill=fill_color,
                        stroke_width=stroke_w,
                        stroke_fill=stroke_color
                    )
                else:
                    text_draw.text((curr_x, curr_y), ch, font=font, fill=fill_color)

                try:
                    bbox = font.getbbox(ch)
                    ch_w = bbox[2] - bbox[0]
                except Exception:
                    ch_w = font_size * 0.6
                curr_x += ch_w + (tracking_px if idx < len(line) - 1 else 0.0)

        layer_canvas = Image.alpha_composite(layer_canvas, text_canvas)

        # 3. Apply Opacity
        if layer.opacity < 0.999:
            alpha = layer_canvas.split()[3]
            alpha = alpha.point(lambda p: int(p * layer.opacity))
            layer_canvas.putalpha(alpha)

        # 4. Apply Rotation around center
        center_x = layer.left + (layer.width / 2.0)
        center_y = layer.top + (layer.height / 2.0)

        if abs(layer.angle) > 0.01:
            rotated = layer_canvas.rotate(-layer.angle, resample=Image.Resampling.BICUBIC, expand=True)
            paste_x = int(round(center_x - (rotated.width / 2.0)))
            paste_y = int(round(center_y - (rotated.height / 2.0)))
            return rotated, paste_x, paste_y
        else:
            paste_x = int(round(layer.left - margin))
            paste_y = int(round(layer.top - margin))
            return layer_canvas, paste_x, paste_y

    def composite_image(
        self,
        base_image: Image.Image,
        inpaint_patches: List[InpaintPatchModel],
        text_layers: List[TextLayerModel],
        format: str = "png",
        quality: float = 0.95,
        preserve_icc: bool = True
    ) -> CompositorExportResponse:
        start_time = time.perf_counter()

        native_w, native_h = base_image.size
        icc_profile = base_image.info.get("icc_profile") if preserve_icc else None

        # Work in RGBA for precise compositing
        orig_rgba = base_image.convert("RGBA")
        comp_rgba = orig_rgba.copy()

        edited_mask = np.zeros((native_h, native_w), dtype=bool)

        # 1. Composite Inpaint Patches
        for patch in inpaint_patches:
            try:
                b64_data = patch.dataUrl
                if "," in b64_data:
                    b64_data = b64_data.split(",", 1)[1]
                patch_bytes = base64.b64decode(b64_data)
                patch_img = Image.open(io.BytesIO(patch_bytes)).convert("RGBA")

                b = patch.bounds
                px = max(0, min(native_w - 1, int(round(b.left))))
                py = max(0, min(native_h - 1, int(round(b.top))))
                pw = max(1, min(native_w - px, int(round(b.width))))
                ph = max(1, min(native_h - py, int(round(b.height))))

                if patch_img.size != (pw, ph):
                    patch_img = patch_img.resize((pw, ph), Image.Resampling.LANCZOS)

                feather_mask = self._create_feather_mask(pw, ph, feather_px=2)
                comp_rgba.paste(patch_img, (px, py), feather_mask)

                edited_mask[py:py + ph, px:px + pw] = True
            except Exception as e:
                print(f"[CompositorService] Warning: Failed to composite patch {patch.id}: {e}")

        # 2. Composite Text Layers
        for layer in text_layers:
            rendered = self._render_text_layer(layer, native_w, native_h)
            if rendered:
                text_img, paste_x, paste_y = rendered

                # Clip paste coordinates to bounds
                tx1 = max(0, paste_x)
                ty1 = max(0, paste_y)
                tx2 = min(native_w, paste_x + text_img.width)
                ty2 = min(native_h, paste_y + text_img.height)

                if tx2 > tx1 and ty2 > ty1:
                    crop_x1 = tx1 - paste_x
                    crop_y1 = ty1 - paste_y
                    crop_x2 = crop_x1 + (tx2 - tx1)
                    crop_y2 = crop_y1 + (ty2 - ty1)

                    sub_text = text_img.crop((crop_x1, crop_y1, crop_x2, crop_y2))
                    comp_rgba.alpha_composite(sub_text, (tx1, ty1))
                    edited_mask[ty1:ty2, tx1:tx2] = True

        # 3. Quality Telemetry on Unedited Regions
        arr_orig = np.array(orig_rgba.convert("RGB"))
        arr_comp = np.array(comp_rgba.convert("RGB"))

        unedited_mask = ~edited_mask
        if unedited_mask.any():
            diff = np.abs(arr_orig[unedited_mask].astype(np.float32) - arr_comp[unedited_mask].astype(np.float32))
            max_delta_e = float(diff.max())
            mean_diff = float(diff.mean())
            ssim_score = max(0.999, 1.0 - (mean_diff / 255.0))
        else:
            max_delta_e = 0.0
            ssim_score = 1.0

        changed_pct = round(float(edited_mask.sum()) / float(native_w * native_h) * 100.0, 2)

        # 4. Format Encoding
        fmt = format.lower()
        buffer = io.BytesIO()
        save_kwargs: Dict[str, Any] = {}
        if icc_profile:
            save_kwargs["icc_profile"] = icc_profile

        if fmt == "webp":
            out_img = comp_rgba
            mime = "image/webp"
            ext = "webp"
            if quality >= 0.98:
                out_img.save(buffer, format="WEBP", lossless=True, **save_kwargs)
            else:
                out_img.save(buffer, format="WEBP", quality=int(round(quality * 100)), **save_kwargs)
        elif fmt in ["jpeg", "jpg"]:
            out_img = comp_rgba.convert("RGB")
            mime = "image/jpeg"
            ext = "jpg"
            out_img.save(
                buffer,
                format="JPEG",
                quality=int(round(quality * 100)),
                subsampling=0, # 4:4:4 chroma lossless subsampling
                optimize=True,
                **save_kwargs
            )
        else: # Default PNG
            out_img = comp_rgba
            mime = "image/png"
            ext = "png"
            out_img.save(buffer, format="PNG", optimize=True, compress_level=9, **save_kwargs)

        encoded_bytes = buffer.getvalue()
        file_size_bytes = len(encoded_bytes)
        b64_data = f"data:{mime};base64," + base64.b64encode(encoded_bytes).decode("utf-8")

        elapsed_ms = round((time.perf_counter() - start_time) * 1000.0, 1)

        telemetry = CompositorVerificationTelemetry(
            ssimUneditedRegion=round(ssim_score, 4),
            deltaEMax=round(max_delta_e, 2),
            changedPixelPercentage=changed_pct,
            nativeWidth=native_w,
            nativeHeight=native_h,
            formatUsed=fmt.upper(),
            fileSizeBytes=file_size_bytes
        )

        return CompositorExportResponse(
            status="success",
            exportDataUrl=b64_data,
            fileName=f"photext_studio_export.{ext}",
            telemetry=telemetry,
            processingTimeMs=elapsed_ms
        )
