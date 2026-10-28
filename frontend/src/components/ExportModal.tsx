import React, { useState } from 'react';
import type { ImageMetadata, TextLayer, InpaintPatch, ExportFormat, CompositorVerificationTelemetry } from '../types';
import { exportHighResImage, triggerDownload } from '../utils/exporter';
import { renderStudioExport } from '../services/api';
import { X, Download, AlertCircle, Loader2, Sliders, ShieldCheck, Cpu, Layers } from 'lucide-react';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  image: ImageMetadata;
  patches: InpaintPatch[];
  layers: TextLayer[];
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  image,
  patches,
  layers,
}) => {
  const [engine, setEngine] = useState<'studio' | 'client'>('studio');
  const [format, setFormat] = useState<ExportFormat>('png');
  const [quality, setQuality] = useState<number>(0.95);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [telemetry, setTelemetry] = useState<CompositorVerificationTelemetry | null>(null);

  if (!isOpen) return null;

  const handleExport = async () => {
    setIsExporting(true);
    setError(null);
    setTelemetry(null);

    try {
      const ext = format === 'jpeg' ? 'jpg' : format;
      const baseName = image.fileName.substring(0, image.fileName.lastIndexOf('.')) || 'retypo-export';

      if (engine === 'studio') {
        const result = await renderStudioExport(
          { file: image.file, imageBase64: image.dataUrl },
          layers,
          patches,
          { format, quality, preserveIcc: true }
        );

        setTelemetry(result.telemetry);

        // Convert data URL to Blob for clean download
        const res = await fetch(result.exportDataUrl);
        const blob = await res.blob();
        const outputName = `${baseName}_retypo_studio.${ext}`;
        triggerDownload(blob, outputName);
      } else {
        const blob = await exportHighResImage(image, patches, layers, { format, quality });
        const outputName = `${baseName}_retypo.${ext}`;
        triggerDownload(blob, outputName);
      }
    } catch (err: any) {
      console.error('Export error:', err);
      setError(err?.message || 'Failed to export image.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-3 sm:p-4 select-none animate-in fade-in duration-150">
      <div className="w-full max-w-lg max-h-[92dvh] bg-white border border-[#e8e4dc] rounded-3xl shadow-2xl overflow-hidden flex flex-col text-neutral-800">
        {/* Header */}
        <div className="p-4 border-b border-[#e8e4dc] bg-[#fbf9f5] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#ffefe8] text-[#ff6f42] border border-[#ff6f42]/20 flex items-center justify-center shadow-2xs">
              <Download className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-neutral-900">Retypo Studio Export</h2>
              <p className="text-[10px] text-neutral-500">Non-destructive typography compositing at exact source resolution</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center text-neutral-400 hover:text-neutral-700 hover:bg-[#ffefe8] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5 space-y-4 text-xs overflow-y-auto flex-1">
          {/* Engine Selector */}
          <div className="space-y-1.5">
            <label className="font-semibold text-neutral-700">Rendering Engine</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setEngine('studio')}
                className={`p-3 rounded-2xl border text-left transition-all ${
                  engine === 'studio'
                    ? 'bg-[#fffbf8] border-2 border-[#ff6f42] text-neutral-900 shadow-xs'
                    : 'bg-white border-[#e8e4dc] text-neutral-600 hover:border-[#ff6f42]/40'
                }`}
              >
                <div className="flex items-center gap-1.5 font-semibold text-xs text-neutral-900">
                  <Layers className="w-3.5 h-3.5 text-[#ff6f42]" />
                  Studio Compositor
                </div>
                <div className="text-[10px] text-neutral-500 mt-1">
                  Bitwise untouched fidelity & sub-pixel antialiasing
                </div>
              </button>

              <button
                type="button"
                onClick={() => setEngine('client')}
                className={`p-3 rounded-2xl border text-left transition-all ${
                  engine === 'client'
                    ? 'bg-[#fffbf8] border-2 border-[#ff6f42] text-neutral-900 shadow-xs'
                    : 'bg-white border-[#e8e4dc] text-neutral-600 hover:border-[#ff6f42]/40'
                }`}
              >
                <div className="flex items-center gap-1.5 font-semibold text-xs text-neutral-900">
                  <Cpu className="w-3.5 h-3.5 text-neutral-600" />
                  Fast Canvas Export
                </div>
                <div className="text-[10px] text-neutral-500 mt-1">
                  Client-side HTML5 canvas rasterizer
                </div>
              </button>
            </div>
          </div>

          {/* Metadata Specs */}
          <div className="bg-[#fbf9f5] border border-[#e8e4dc] rounded-2xl p-3.5 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-neutral-500 font-medium">Native Resolution</span>
              <span className="font-mono font-bold text-neutral-900">
                {image.width} × {image.height} px
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-neutral-500 font-medium">Unedited Regions Guarantee</span>
              <span className="text-neutral-900 font-mono font-medium flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-[#ff6f42]" />
                SSIM 1.000 (Bitwise Lossless)
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-neutral-500 font-medium">Active Layers</span>
              <span className="text-neutral-800 font-medium">
                {patches.length} Inpaint Patches • {layers.filter((l) => l.isVisible).length} Text Layers
              </span>
            </div>
          </div>

          {/* Format Picker */}
          <div className="space-y-1.5">
            <label className="font-semibold text-neutral-700">Target Image Format</label>
            <div className="grid grid-cols-3 gap-2">
              {(['png', 'webp', 'jpeg'] as const).map((fmt) => (
                <button
                  key={fmt}
                  type="button"
                  onClick={() => setFormat(fmt)}
                  className={`py-2 px-3 rounded-full border text-center font-semibold uppercase tracking-wider text-xs transition-all ${
                    format === fmt
                      ? 'bg-[#ff6f42] border-[#ff6f42] text-white shadow-xs'
                      : 'bg-[#ede9df] border-[#e8e4dc] text-neutral-700 hover:bg-[#e2ddd1]'
                  }`}
                >
                  {fmt === 'jpeg' ? 'JPG (4:4:4)' : fmt === 'png' ? 'PNG (Lossless)' : 'WebP'}
                </button>
              ))}
            </div>
          </div>

          {/* Quality Slider (for JPEG / WebP) */}
          {format !== 'png' && (
            <div className="space-y-2 bg-[#fbf9f5] p-3 rounded-2xl border border-[#e8e4dc]">
              <div className="flex justify-between items-center">
                <span className="text-neutral-600 font-medium flex items-center gap-1.5">
                  <Sliders className="w-3 h-3 text-[#ff6f42]" />
                  Studio Quality Level
                </span>
                <span className="font-mono text-neutral-900 font-bold">{Math.round(quality * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.7"
                max="1.0"
                step="0.05"
                value={quality}
                onChange={(e) => setQuality(Number(e.target.value))}
                className="w-full accent-[#ff6f42] cursor-pointer h-1.5 bg-[#e8e4dc] rounded-lg"
              />
            </div>
          )}

          {/* Telemetry Result Card if available */}
          {telemetry && (
            <div className="bg-[#fbf9f5] border border-[#e8e4dc] rounded-2xl p-3 space-y-1.5 text-[11px] font-mono text-neutral-700">
              <div className="flex items-center gap-1.5 font-bold text-neutral-900">
                <ShieldCheck className="w-4 h-4 text-[#ff6f42]" />
                Verified Lossless Compositing Telemetry
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px] text-neutral-600">
                <div>Unedited SSIM: <span className="text-neutral-900 font-bold">{telemetry.ssimUneditedRegion}</span></div>
                <div>Max Delta E: <span className="text-neutral-900 font-bold">{telemetry.deltaEMax}</span></div>
                <div>Export Size: <span className="text-neutral-900 font-bold">{Math.round(telemetry.fileSizeBytes / 1024)} KB</span></div>
                <div>Changed Area: <span className="text-neutral-900 font-bold">{telemetry.changedPixelPercentage}%</span></div>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 bg-[#fbf9f5] border-t border-[#e8e4dc] flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <span className="text-[10px] text-neutral-500 font-mono text-center sm:text-left">
            Output: {image.width}×{image.height}px • {format.toUpperCase()}
          </span>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={onClose}
              disabled={isExporting}
              className="px-4 py-2 text-xs font-semibold rounded-full text-neutral-700 hover:text-neutral-950 bg-[#ede9df] hover:bg-[#e2ddd1] transition-colors"
            >
              Close
            </button>

            <button
              onClick={handleExport}
              disabled={isExporting}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2 text-xs font-semibold rounded-full bg-[#ff6f42] hover:bg-[#ee6037] text-white shadow-md shadow-[#ff6f42]/20 transition-all active:scale-95 disabled:opacity-50"
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Rendering Full-Res...
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  {engine === 'studio' ? 'Export Studio Master' : 'Export File'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
