/**
 * Coordinate mapping utilities between:
 * 1. Screen Viewport Coordinates (used by Fabric.js canvas UI)
 * 2. Original Native Image Coordinates (lossless source pixel space)
 */

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface TransformContext {
  nativeWidth: number;
  nativeHeight: number;
  canvasWidth: number;
  canvasHeight: number;
  zoom: number;
  panX: number;
  panY: number;
  baseScale: number; // Fit scale factor of image into canvas at 100% zoom
}

/**
 * Calculates base fitting scale so the full image is visible inside the canvas container.
 */
export function calculateFitScale(
  nativeWidth: number,
  nativeHeight: number,
  canvasWidth: number,
  canvasHeight: number,
  padding: number = 40
): number {
  if (nativeWidth <= 0 || nativeHeight <= 0 || canvasWidth <= 0 || canvasHeight <= 0) {
    return 1.0;
  }
  const availW = Math.max(10, canvasWidth - padding * 2);
  const availH = Math.max(10, canvasHeight - padding * 2);
  const scaleX = availW / nativeWidth;
  const scaleY = availH / nativeHeight;
  return Math.min(scaleX, scaleY, 1.0); // Never upscale by default beyond 1.0
}

/**
 * Converts native image pixel coordinate (X, Y) to screen canvas coordinate.
 */
export function nativeToScreen(
  nativeX: number,
  nativeY: number,
  baseScale: number,
  zoom: number,
  panX: number,
  panY: number
): Point {
  const totalScale = baseScale * zoom;
  return {
    x: nativeX * totalScale + panX,
    y: nativeY * totalScale + panY,
  };
}

/**
 * Converts screen canvas coordinate (X, Y) to native image pixel coordinate.
 */
export function screenToNative(
  screenX: number,
  screenY: number,
  baseScale: number,
  zoom: number,
  panX: number,
  panY: number
): Point {
  const totalScale = baseScale * zoom;
  if (totalScale === 0) return { x: screenX, y: screenY };
  return {
    x: (screenX - panX) / totalScale,
    y: (screenY - panY) / totalScale,
  };
}

/**
 * Scales native text property (like fontSize, strokeWidth) to screen size.
 */
export function nativeSizeToScreen(nativeSize: number, baseScale: number, zoom: number): number {
  return nativeSize * baseScale * zoom;
}

/**
 * Scales screen size to native text property.
 */
export function screenSizeToNative(screenSize: number, baseScale: number, zoom: number): number {
  const totalScale = baseScale * zoom;
  if (totalScale === 0) return screenSize;
  return screenSize / totalScale;
}
