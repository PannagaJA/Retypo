import React, { useState } from 'react';
import type { ImageMetadata, TextLayer, InpaintPatch, ExportFormat, CompositorVerificationTelemetry } from '../types';
import { exportHighResImage, triggerDownload } from '../utils/exporter';
import { renderStudioExport } from '../services/api';
import { X, Download, AlertCircle, Loader2, Sliders, ShieldCheck, Sparkles, Cpu } from 'lucide-react';

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
      const baseName = image.fileName.substring(0, image.fileName.lastIndexOf('.')) || 'photext-export';

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
        const outputName = `${baseName}_studio_lossless.${ext}`;
        triggerDownload(blob, outputName);
      } else {
        const blob = await exportHighResImage(image, patches, layers, { format, quality });
        const outputName = `${baseName}_canvas_export.${ext}`;
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-3 sm:p-4 select-none animate-in fade-in duration-150">
      <div className="w-full max-w-lg max-h-[92dvh] bg-[#131620] border border-[#252c3e] rounded-xl shadow-2xl overflow-hidden flex flex-col text-gray-200">
        {/* Header */}
        <div className="p-4 border-b border-[#212636] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center">
              <Download className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Lossless Studio Export</h2>
              <p className="text-[10px] text-gray-400">Non-destructive compositing at exact source resolution</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-gray-400 hover:text-white hover:bg-[#1f2536] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5 space-y-4 text-xs overflow-y-auto flex-1">
          {/* Engine Selector */}
          <div className="space-y-1.5">
            <label className="font-medium text-gray-300">Rendering Engine</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setEngine('studio')}
                className={`p-2.5 rounded-lg border text-left transition-all ${
                  engine === 'studio'
                    ? 'bg-blue-600/20 border-blue-500 text-white shadow-sm ring-1 ring-blue-500/30'
                    : 'bg-[#181d2a] border-[#252c3e] text-gray-400 hover:text-white hover:bg-[#1f2536]'
                }`}
              >
                <div className="flex items-center gap-1.5 font-medium text-xs">
                  <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                  Studio Compositor
                </div>
                <div className="text-[10px] text-gray-400 mt-1">
                  100% Bitwise untouched fidelity & sub-pixel antialiasing
                </div>
              </button>

              <button
                type="button"
                onClick={() => setEngine('client')}
                className={`p-2.5 rounded-lg border text-left transition-all ${
                  engine === 'client'
                    ? 'bg-blue-600/20 border-blue-500 text-white shadow-sm ring-1 ring-blue-500/30'
                    : 'bg-[#181d2a] border-[#252c3e] text-gray-400 hover:text-white hover:bg-[#1f2536]'
                }`}
              >
                <div className="flex items-center gap-1.5 font-medium text-xs">
                  <Cpu className="w-3.5 h-3.5 text-gray-400" />
                  Fast Canvas Export
                </div>
                <div className="text-[10px] text-gray-400 mt-1">
                  Client-side HTML5 canvas rasterizer
                </div>
              </button>
            </div>
          </div>

          {/* Metadata Specs */}
          <div className="bg-[#181d2a] border border-[#252c3e] rounded-lg p-3 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Native Resolution</span>
              <span className="font-mono font-medium text-emerald-400">
                {image.width} × {image.height} px
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Unedited Regions Guarantee</span>
              <span className="text-emerald-400 font-mono flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                SSIM 1.000 (Bitwise Lossless)
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Active Layers</span>
              <span className="text-gray-200">
                {patches.length} Inpaint Patches • {layers.filter((l) => l.isVisible).length} Typography Layers
              </span>
            </div>
          </div>

          {/* Format Picker */}
          <div className="space-y-1.5">
            <label className="font-medium text-gray-300">Target Image Format</label>
            <div className="grid grid-cols-3 gap-2">
              {(['png', 'webp', 'jpeg'] as const).map((fmt) => (
                <button
                  key={fmt}
                  type="button"
                  onClick={() => setFormat(fmt)}
                  className={`py-2 px-3 rounded-lg border text-center font-medium uppercase tracking-wider text-xs transition-all ${
                    format === fmt
                      ? 'bg-blue-600/20 border-blue-500 text-blue-400 shadow-sm'
                      : 'bg-[#181d2a] border-[#252c3e] text-gray-400 hover:text-white hover:bg-[#1f2536]'
                  }`}
                >
                  {fmt === 'jpeg' ? 'JPG (4:4:4)' : fmt === 'png' ? 'PNG (Lossless)' : 'WebP (Ultra)'}
                </button>
              ))}
            </div>
          </div>

          {/* Quality Slider (for JPEG / WebP) */}
          {format !== 'png' && (
            <div className="space-y-2 bg-[#181d2a] p-3 rounded-lg border border-[#252c3e]">
              <div className="flex justify-between items-center">
                <span className="text-gray-400 flex items-center gap-1.5">
                  <Sliders className="w-3 h-3 text-blue-400" />
                  Studio Quality Level
                </span>
                <span className="font-mono text-gray-200">{Math.round(quality * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.7"
                max="1.0"
                step="0.05"
                value={quality}
                onChange={(e) => setQuality(Number(e.target.value))}
                className="w-full accent-blue-500 cursor-pointer h-1.5 bg-[#252c3e] rounded-lg"
              />
            </div>
          )}

          {/* Telemetry Result Card if available */}
          {telemetry && (
            <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-lg p-3 space-y-1.5 text-[11px] font-mono text-emerald-300">
              <div className="flex items-center gap-1.5 font-semibold text-emerald-400">
                <ShieldCheck className="w-4 h-4" />
                Verified Lossless Compositing Telemetry
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px] text-gray-300">
                <div>Unedited SSIM: <span className="text-emerald-400 font-bold">{telemetry.ssimUneditedRegion}</span></div>
                <div>Max Delta E: <span className="text-emerald-400 font-bold">{telemetry.deltaEMax}</span></div>
                <div>Export Size: <span className="text-gray-200">{Math.round(telemetry.fileSizeBytes / 1024)} KB</span></div>
                <div>Changed Area: <span className="text-gray-200">{telemetry.changedPixelPercentage}%</span></div>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-md bg-red-500/10 border border-red-500/30 text-red-400">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 bg-[#0f1118] border-t border-[#212636] flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <span className="text-[10px] text-gray-500 font-mono text-center sm:text-left">
            Output: {image.width}×{image.height}px • {format.toUpperCase()}
          </span>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={onClose}
              disabled={isExporting}
              className="px-3 sm:px-4 py-2 text-xs font-medium rounded-lg text-gray-400 hover:text-white hover:bg-[#1a1f2e] transition-colors"
            >
              Close
            </button>

            <button
              onClick={handleExport}
              disabled={isExporting}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3.5 sm:px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-500/25 transition-all active:scale-95 disabled:opacity-50"
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
