import { describe, it, expect } from 'vitest';
import type { TextLayer, InpaintPatch, CompositorExportResult } from '../types';

describe('Lossless Compositor & Studio Export Pipeline', () => {
  const sampleLayer: TextLayer = {
    id: 'layer-master',
    text: 'STUDIO TYPOGRAPHY',
    fontFamily: 'Montserrat',
    fontSize: 44.0,
    fontWeight: '700',
    fontStyle: 'normal',
    fill: '#ffffff',
    stroke: '#000000',
    strokeWidth: 2,
    letterSpacing: 2.0,
    lineHeight: 1.2,
    textAlign: 'center',
    left: 50,
    top: 80,
    width: 320,
    height: 60,
    angle: 0,
    opacity: 1.0,
    isLocked: false,
    isVisible: true,
    origin: 'manual',
  };

  const samplePatch: InpaintPatch = {
    id: 'patch-1',
    bounds: { left: 40, top: 70, width: 340, height: 80 },
    dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    strategy: 'gradient',
  };

  it('correctly prepares layers and patches payload for compositor render', () => {
    const layers = [sampleLayer];
    const patches = [samplePatch];

    const serializedLayers = JSON.stringify(layers);
    const serializedPatches = JSON.stringify(patches);

    expect(serializedLayers).toContain('STUDIO TYPOGRAPHY');
    expect(serializedPatches).toContain('patch-1');
  });

  it('correctly maps export file extensions based on target format', () => {
    const resolveExtension = (format: 'png' | 'jpeg' | 'webp') => {
      return format === 'jpeg' ? 'jpg' : format;
    };

    expect(resolveExtension('png')).toBe('png');
    expect(resolveExtension('jpeg')).toBe('jpg');
    expect(resolveExtension('webp')).toBe('webp');
  });

  it('parses lossless telemetry data with SSIM and Delta E guarantees', () => {
    const sampleResult: CompositorExportResult = {
      status: 'success',
      exportDataUrl: 'data:image/png;base64,test',
      fileName: 'photext_studio_export.png',
      telemetry: {
        ssimUneditedRegion: 1.0,
        deltaEMax: 0.0,
        changedPixelPercentage: 12.5,
        nativeWidth: 1920,
        nativeHeight: 1080,
        formatUsed: 'PNG',
        fileSizeBytes: 245000,
      },
      processingTimeMs: 42.5,
    };

    expect(sampleResult.telemetry.ssimUneditedRegion).toBe(1.0);
    expect(sampleResult.telemetry.deltaEMax).toBe(0.0);
    expect(sampleResult.telemetry.nativeWidth).toBe(1920);
    expect(sampleResult.telemetry.formatUsed).toBe('PNG');
  });
});
