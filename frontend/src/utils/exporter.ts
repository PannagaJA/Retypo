import type { ImageMetadata, TextLayer, InpaintPatch, ExportOptions } from '../types';

/**
 * High-resolution native image compositor and exporter.
 * Never renders from the downscaled screen canvas.
 * Renders directly onto an offscreen canvas at the exact original image resolution.
 */
export async function exportHighResImage(
  image: ImageMetadata,
  patches: InpaintPatch[],
  layers: TextLayer[],
  options: ExportOptions
): Promise<Blob> {
  // Ensure web fonts are completely loaded before rasterizing offscreen canvas
  if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
    try {
      await document.fonts.ready;
    } catch {
      // Fallback gracefully
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: false, alpha: true });

  if (!ctx) {
    throw new Error('Failed to create offscreen 2D canvas context');
  }

  // 1. Draw base image
  const baseImg = await loadImageElement(image.dataUrl);
  ctx.drawImage(baseImg, 0, 0, image.width, image.height);

  // 2. Draw inpainting patches (if any)
  for (const patch of patches) {
    try {
      const patchImg = await loadImageElement(patch.dataUrl);
      ctx.drawImage(
        patchImg,
        patch.bounds.left,
        patch.bounds.top,
        patch.bounds.width,
        patch.bounds.height
      );
    } catch (err) {
      console.warn('Could not composite patch:', patch.id, err);
    }
  }

  // 3. Render visible text layers at native resolution
  for (const layer of layers) {
    if (!layer.isVisible) continue;

    ctx.save();

    // Transform: translation to layer position and rotation
    const centerX = layer.left + layer.width / 2;
    const centerY = layer.top + layer.height / 2;
    ctx.translate(centerX, centerY);
    if (layer.angle) {
      ctx.rotate((layer.angle * Math.PI) / 180);
    }
    ctx.translate(-layer.width / 2, -layer.height / 2);

    ctx.globalAlpha = layer.opacity;

    // Apply shadow if configured
    if (layer.shadow && layer.shadow.blur > 0) {
      ctx.shadowColor = layer.shadow.color;
      ctx.shadowBlur = layer.shadow.blur;
      ctx.shadowOffsetX = layer.shadow.offsetX;
      ctx.shadowOffsetY = layer.shadow.offsetY;
    }

    // Configure font typography
    const stylePrefix = layer.fontStyle === 'italic' ? 'italic ' : '';
    const weightPrefix = `${layer.fontWeight} `;
    ctx.font = `${stylePrefix}${weightPrefix}${layer.fontSize}px "${layer.fontFamily}", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans", Helvetica, Arial, sans-serif`;
    ctx.textAlign = layer.textAlign === 'center' ? 'center' : layer.textAlign === 'right' ? 'right' : 'left';
    ctx.textBaseline = 'top';

    // Letter spacing (supported in modern 2D canvas)
    if ('letterSpacing' in ctx && layer.letterSpacing !== 0) {
      (ctx as any).letterSpacing = `${layer.letterSpacing}px`;
    }

    // Multiline rendering
    const lines = layer.text.split('\n');
    const lineHeightPx = layer.fontSize * (layer.lineHeight || 1.2);

    let x = 0;
    if (layer.textAlign === 'center') x = layer.width / 2;
    if (layer.textAlign === 'right') x = layer.width;

    lines.forEach((line, index) => {
      const y = index * lineHeightPx;

      // Stroke rendering
      if (layer.stroke && layer.strokeWidth > 0) {
        ctx.strokeStyle = layer.stroke;
        ctx.lineWidth = layer.strokeWidth;
        ctx.strokeText(line, x, y);
      }

      // Fill rendering
      ctx.fillStyle = layer.fill;
      ctx.fillText(line, x, y);
    });

    ctx.restore();
  }

  // Convert offscreen canvas to Blob
  return new Promise<Blob>((resolve, reject) => {
    let mimeType = 'image/png';
    if (options.format === 'jpeg') mimeType = 'image/jpeg';
    if (options.format === 'webp') mimeType = 'image/webp';

    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Canvas toBlob conversion failed'));
        }
      },
      mimeType,
      options.quality
    );
  });
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(new Error('Failed to load image element: ' + e));
    img.src = src;
  });
}

export function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
