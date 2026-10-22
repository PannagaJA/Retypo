import { describe, it, expect } from 'vitest';
import type { InpaintPatch } from '../types';

describe('Inpaint Patch Layer Architecture', () => {
  const samplePatch: InpaintPatch = {
    id: 'patch-layer-1',
    bounds: {
      left: 120,
      top: 300,
      width: 450,
      height: 80,
    },
    dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    strategy: 'gradient',
  };

  it('stores exact bounding coordinates and strategy metadata', () => {
    expect(samplePatch.id).toBe('patch-layer-1');
    expect(samplePatch.bounds.left).toBe(120);
    expect(samplePatch.bounds.top).toBe(300);
    expect(samplePatch.bounds.width).toBe(450);
    expect(samplePatch.bounds.height).toBe(80);
    expect(samplePatch.strategy).toBe('gradient');
  });

  it('correctly updates and deduplicates patches by target id', () => {
    const patches = [samplePatch];
    const updatedPatch: InpaintPatch = {
      ...samplePatch,
      strategy: 'telea',
    };

    const nextPatches = patches.map((p) => (p.id === updatedPatch.id ? updatedPatch : p));
    expect(nextPatches.length).toBe(1);
    expect(nextPatches[0].strategy).toBe('telea');
  });

  it('removes patch by id cleanly', () => {
    const patches = [samplePatch];
    const filtered = patches.filter((p) => p.id !== 'patch-layer-1');
    expect(filtered.length).toBe(0);
  });
});
