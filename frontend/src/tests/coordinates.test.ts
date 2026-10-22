import { describe, it, expect } from 'vitest';
import {
  calculateFitScale,
  nativeToScreen,
  screenToNative,
  nativeSizeToScreen,
  screenSizeToNative,
} from '../utils/coordinates';

describe('Coordinate Mapping Utilities', () => {
  it('calculates fit scale correctly preserving aspect ratio and margins', () => {
    // 2000x1000 image in a 1000x600 canvas with 40px padding
    // available width = 1000 - 80 = 920, available height = 600 - 80 = 520
    // scaleX = 920 / 2000 = 0.46, scaleY = 520 / 1000 = 0.52
    // min is 0.46
    const scale = calculateFitScale(2000, 1000, 1000, 600, 40);
    expect(scale).toBeCloseTo(0.46, 2);
  });

  it('never upscales images smaller than canvas at fit scale', () => {
    const scale = calculateFitScale(200, 100, 1200, 800, 40);
    expect(scale).toBe(1.0);
  });

  it('converts native to screen coordinates accurately with pan and zoom', () => {
    const baseScale = 0.5;
    const zoom = 2.0; // total scale = 1.0
    const panX = 100;
    const panY = 50;

    const screenPoint = nativeToScreen(300, 200, baseScale, zoom, panX, panY);
    expect(screenPoint.x).toBe(400); // 300 * 1.0 + 100
    expect(screenPoint.y).toBe(250); // 200 * 1.0 + 50
  });

  it('reverses screen to native coordinates losslessly', () => {
    const baseScale = 0.25;
    const zoom = 1.5; // total scale = 0.375
    const panX = 80;
    const panY = 60;

    const originalNative = { x: 1240, y: 720 };
    const screen = nativeToScreen(originalNative.x, originalNative.y, baseScale, zoom, panX, panY);
    const roundtripNative = screenToNative(screen.x, screen.y, baseScale, zoom, panX, panY);

    expect(roundtripNative.x).toBeCloseTo(originalNative.x, 4);
    expect(roundtripNative.y).toBeCloseTo(originalNative.y, 4);
  });

  it('converts font sizes between native and screen coordinates', () => {
    const baseScale = 0.5;
    const zoom = 2.0; // total scale = 1.0
    const nativeFontSize = 64;

    const screenSize = nativeSizeToScreen(nativeFontSize, baseScale, zoom);
    expect(screenSize).toBe(64);

    const reversedNative = screenSizeToNative(screenSize, baseScale, zoom);
    expect(reversedNative).toBe(64);
  });
});
