import { describe, it, expect } from 'vitest';
import type { TextLayer, FontCandidate } from '../types';

describe('Typography Reconstruction & Candidate Application', () => {
  const initialLayer: TextLayer = {
    id: 'layer-1',
    text: 'HEADLINE TEXT',
    fontFamily: 'Inter',
    fontSize: 32.0,
    fontWeight: '400',
    fontStyle: 'normal',
    fill: '#ffffff',
    strokeWidth: 0,
    letterSpacing: 0,
    lineHeight: 1.2,
    textAlign: 'left',
    left: 100,
    top: 100,
    width: 300,
    height: 40,
    angle: 0,
    opacity: 1.0,
    isLocked: false,
    isVisible: true,
    origin: 'manual',
  };

  const sampleCandidate: FontCandidate = {
    family: 'Montserrat',
    weight: '700',
    category: 'sans-serif',
    confidence: 0.945,
    letterSpacing: 2.5,
    fontSize: 36.0,
    signals: {
      contourSimilarity: 0.96,
      aspectSimilarity: 0.92,
      weightSimilarity: 1.0,
      serifMatch: 0.95,
    },
  };

  it('correctly applies candidate typography properties to layer', () => {
    const updatedLayer: TextLayer = {
      ...initialLayer,
      fontFamily: sampleCandidate.family,
      fontWeight: sampleCandidate.weight,
      letterSpacing: sampleCandidate.letterSpacing,
      fontSize: sampleCandidate.fontSize,
    };

    expect(updatedLayer.fontFamily).toBe('Montserrat');
    expect(updatedLayer.fontWeight).toBe('700');
    expect(updatedLayer.letterSpacing).toBe(2.5);
    expect(updatedLayer.fontSize).toBe(36.0);
    expect(updatedLayer.text).toBe('HEADLINE TEXT');
  });

  it('preserves previous styling when live preview is rolled back', () => {
    let previewBackup: Partial<TextLayer> | null = null;
    let activeLayer = { ...initialLayer };

    // Start preview on hover
    previewBackup = {
      fontFamily: activeLayer.fontFamily,
      fontWeight: activeLayer.fontWeight,
      letterSpacing: activeLayer.letterSpacing,
    };

    activeLayer = {
      ...activeLayer,
      fontFamily: sampleCandidate.family,
      fontWeight: sampleCandidate.weight,
      letterSpacing: sampleCandidate.letterSpacing,
    };

    expect(activeLayer.fontFamily).toBe('Montserrat');

    // Cancel preview on mouse leave
    if (previewBackup) {
      activeLayer = { ...activeLayer, ...previewBackup };
      previewBackup = null;
    }

    expect(activeLayer.fontFamily).toBe('Inter');
    expect(activeLayer.fontWeight).toBe('400');
    expect(activeLayer.letterSpacing).toBe(0);
  });

  it('correctly ranks candidates in descending order of confidence', () => {
    const candidates: FontCandidate[] = [
      { ...sampleCandidate, family: 'Inter', confidence: 0.82 },
      { ...sampleCandidate, family: 'Montserrat', confidence: 0.95 },
      { ...sampleCandidate, family: 'Roboto', confidence: 0.88 },
    ];

    const sorted = [...candidates].sort((a, b) => b.confidence - a.confidence);

    expect(sorted[0].family).toBe('Montserrat');
    expect(sorted[1].family).toBe('Roboto');
    expect(sorted[2].family).toBe('Inter');
  });
});
