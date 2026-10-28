import type { InpaintPatch } from '../types';

/**
 * Creates an instantaneous client-side inpaint patch by sampling the perimeter pixels
 * of an image crop around the given polygon or bounding box.
 * This guarantees zero visual latency: the underlying raster text is immediately
 * concealed the exact millisecond the user selects a region to edit, eliminating
 * any ghosting or "double text" while the high-fidelity server inpainting runs in the background.
 */
export function createInstantInpaintPatch(
  imageSource: HTMLImageElement | HTMLCanvasElement,
  polygon: [number, number][],
  targetLayerId: string,
  padding: number = 4
): InpaintPatch | null {
  if (!imageSource) return null;

  const naturalWidth = (imageSource as HTMLImageElement).naturalWidth || imageSource.width;
  const naturalHeight = (imageSource as HTMLImageElement).naturalHeight || imageSource.height;

  if (!naturalWidth || !naturalHeight) return null;

  const xs = polygon.map((p) => p[0]);
  const ys = polygon.map((p) => p[1]);

  const x1 = Math.max(0, Math.floor(Math.min(...xs)) - padding);
  const y1 = Math.max(0, Math.floor(Math.min(...ys)) - padding);
  const x2 = Math.min(naturalWidth, Math.ceil(Math.max(...xs)) + padding);
  const y2 = Math.min(naturalHeight, Math.ceil(Math.max(...ys)) + padding);

  const w = x2 - x1;
  const h = y2 - y1;

  if (w <= 0 || h <= 0) return null;

  try {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    // Draw the image crop
    ctx.drawImage(imageSource, x1, y1, w, h, 0, 0, w, h);
    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;

    let rTotal = 0;
    let gTotal = 0;
    let bTotal = 0;
    let sampleCount = 0;

    // Sample the outer perimeter (border pixels around the text)
    // Top and bottom borders
    for (let x = 0; x < w; x++) {
      const topIdx = (0 * w + x) * 4;
      rTotal += data[topIdx];
      gTotal += data[topIdx + 1];
      bTotal += data[topIdx + 2];
      sampleCount++;

      const botIdx = ((h - 1) * w + x) * 4;
      rTotal += data[botIdx];
      gTotal += data[botIdx + 1];
      bTotal += data[botIdx + 2];
      sampleCount++;
    }

    // Left and right borders (excluding corners already counted)
    for (let y = 1; y < h - 1; y++) {
      const leftIdx = (y * w + 0) * 4;
      rTotal += data[leftIdx];
      gTotal += data[leftIdx + 1];
      bTotal += data[leftIdx + 2];
      sampleCount++;

      const rightIdx = (y * w + (w - 1)) * 4;
      rTotal += data[rightIdx];
      gTotal += data[rightIdx + 1];
      bTotal += data[rightIdx + 2];
      sampleCount++;
    }

    const rAvg = sampleCount > 0 ? Math.round(rTotal / sampleCount) : 0;
    const gAvg = sampleCount > 0 ? Math.round(gTotal / sampleCount) : 0;
    const bAvg = sampleCount > 0 ? Math.round(bTotal / sampleCount) : 0;

    // Fill the canvas with the background color to cleanly erase the text
    ctx.fillStyle = `rgb(${rAvg}, ${gAvg}, ${bAvg})`;
    ctx.fillRect(0, 0, w, h);

    return {
      id: `patch-${targetLayerId}`,
      targetLayerId,
      bounds: { left: x1, top: y1, width: w, height: h },
      dataUrl: canvas.toDataURL('image/png'),
      strategy: 'solid',
      createdAt: Date.now(),
    };
  } catch (err) {
    console.warn('Failed creating instant inpaint patch:', err);
    return null;
  }
}
