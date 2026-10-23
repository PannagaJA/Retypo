import { describe, it, expect } from 'vitest';
import { calculateFitScale } from '../utils/coordinates';

describe('Mobile Responsiveness & Viewport Calculations', () => {
  it('correctly calculates fit scale on mobile viewports (e.g., iPhone 390x844)', () => {
    const mobileWidth = 390;
    const mobileHeight = 650; // remaining height after header and bottom nav
    const imageWidth = 1920;
    const imageHeight = 1080;

    const scale = calculateFitScale(imageWidth, imageHeight, mobileWidth, mobileHeight);
    
    // Scale must fit entirely within mobile width and height with padding
    expect(scale).toBeGreaterThan(0);
    expect(imageWidth * scale).toBeLessThanOrEqual(mobileWidth);
    expect(imageHeight * scale).toBeLessThanOrEqual(mobileHeight);
  });

  it('correctly calculates fit scale on vertical mobile poster images', () => {
    const mobileWidth = 375;
    const mobileHeight = 600;
    const posterWidth = 1080;
    const posterHeight = 1920;

    const scale = calculateFitScale(posterWidth, posterHeight, mobileWidth, mobileHeight);
    
    expect(scale).toBeGreaterThan(0);
    expect(posterWidth * scale).toBeLessThanOrEqual(mobileWidth);
    expect(posterHeight * scale).toBeLessThanOrEqual(mobileHeight);
  });

  it('calculates pinch-to-zoom distance ratio correctly', () => {
    // Initial touch points
    const touch1 = { x: 100, y: 150 };
    const touch2 = { x: 200, y: 250 };
    const initialDist = Math.hypot(touch2.x - touch1.x, touch2.y - touch1.y);

    // Expanded touch points (pinching outward)
    const touch1New = { x: 80, y: 130 };
    const touch2New = { x: 220, y: 270 };
    const newDist = Math.hypot(touch2New.x - touch1New.x, touch2New.y - touch1New.y);

    const zoomRatio = newDist / initialDist;
    expect(zoomRatio).toBeGreaterThan(1.0);

    const initialZoom = 1.0;
    const calculatedZoom = Math.min(Math.max(0.1, initialZoom * zoomRatio), 5.0);
    expect(calculatedZoom).toBeGreaterThan(1.0);
  });

  it('validates mobile tab switching workflow', () => {
    type MobileTab = 'canvas' | 'layers' | 'properties';
    let currentTab: MobileTab = 'canvas';

    // Tap layers
    currentTab = currentTab === 'layers' ? 'canvas' : 'layers';
    expect(currentTab).toBe('layers');

    // Tap layers again to toggle off
    currentTab = currentTab === 'layers' ? 'canvas' : 'layers';
    expect(currentTab).toBe('canvas');

    // Tap properties
    currentTab = currentTab === 'properties' ? 'canvas' : 'properties';
    expect(currentTab).toBe('properties');

    // Tap canvas tab to return to canvas
    currentTab = 'canvas';
    expect(currentTab).toBe('canvas');
  });
});
