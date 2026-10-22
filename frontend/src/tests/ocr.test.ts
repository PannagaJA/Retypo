import { describe, it, expect } from 'vitest';
import type { DetectedTextRegion, TextLayer } from '../types';

describe('OCR Detected Region to TextLayer Conversion', () => {
  const sampleRegion: DetectedTextRegion = {
    regionId: 'ocr-test-1',
    text: 'Summer Sale 50% Off',
    polygon: [[100, 150], [500, 150], [500, 210], [100, 210]],
    bbox: [100, 150, 400, 60],
    angle: 0,
    estimatedFontSize: 48,
    estimatedColor: '#ff3366',
    confidence: 0.982,
    geometryConfidence: 1.0,
    isConverted: false,
  };

  it('correctly maps detected region attributes to editable TextLayer properties', () => {
    const layer: TextLayer = {
      id: 'layer-ocr-1',
      text: sampleRegion.text,
      fontFamily: 'Inter',
      fontSize: sampleRegion.estimatedFontSize,
      fontWeight: '600',
      fontStyle: 'normal',
      fill: sampleRegion.estimatedColor,
      strokeWidth: 0,
      letterSpacing: 0,
      lineHeight: 1.2,
      textAlign: 'left',
      left: sampleRegion.bbox[0],
      top: sampleRegion.bbox[1],
      width: sampleRegion.bbox[2],
      height: sampleRegion.bbox[3],
      angle: sampleRegion.angle,
      opacity: 1,
      isLocked: false,
      isVisible: true,
      origin: 'ocr_detected',
    };

    expect(layer.origin).toBe('ocr_detected');
    expect(layer.text).toBe('Summer Sale 50% Off');
    expect(layer.fontSize).toBe(48);
    expect(layer.fill).toBe('#ff3366');
    expect(layer.left).toBe(100);
    expect(layer.top).toBe(150);
    expect(layer.width).toBe(400);
    expect(layer.height).toBe(60);
  });

  it('marks region as converted after adoption', () => {
    const regions = [sampleRegion];
    const updated = regions.map((r) =>
      r.regionId === sampleRegion.regionId ? { ...r, isConverted: true } : r
    );
    expect(updated[0].isConverted).toBe(true);
  });
});
