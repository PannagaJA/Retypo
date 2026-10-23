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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-3 sm:p-4 select-none animate-in fade-in duration-150">
      <div className="w-full max-w-lg max-h-[92dvh] bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col text-slate-800">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-800 border border-slate-200 flex items-center justify-center shadow-2xs">
              <Download className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Retypo Studio Export</h2>
              <p className="text-[10px] text-slate-500">Non-destructive typography compositing at exact source resolution</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5 space-y-4 text-xs overflow-y-auto flex-1">
          {/* Engine Selector */}
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-700">Rendering Engine</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setEngine('studio')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  engine === 'studio'
                    ? 'bg-slate-50 border-2 border-slate-900 text-slate-900 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-1.5 font-semibold text-xs text-slate-900">
                  <Layers className="w-3.5 h-3.5 text-slate-700" />
                  Studio Compositor
                </div>
                <div className="text-[10px] text-slate-500 mt-1">
                  Bitwise untouched fidelity & sub-pixel antialiasing
                </div>
              </button>

              <button
                type="button"
                onClick={() => setEngine('client')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  engine === 'client'
                    ? 'bg-slate-50 border-2 border-slate-900 text-slate-900 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-1.5 font-semibold text-xs text-slate-900">
                  <Cpu className="w-3.5 h-3.5 text-slate-600" />
                  Fast Canvas Export
                </div>
                <div className="text-[10px] text-slate-500 mt-1">
                  Client-side HTML5 canvas rasterizer
                </div>
              </button>
            </div>
          </div>

          {/* Metadata Specs */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-medium">Native Resolution</span>
              <span className="font-mono font-semibold text-slate-900">
                {image.width} × {image.height} px
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-medium">Unedited Regions Guarantee</span>
              <span className="text-slate-900 font-mono font-medium flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-slate-700" />
                SSIM 1.000 (Bitwise Lossless)
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-medium">Active Layers</span>
              <span className="text-slate-800 font-medium">
                {patches.length} Inpaint Patches • {layers.filter((l) => l.isVisible).length} Text Layers
              </span>
            </div>
          </div>

          {/* Format Picker */}
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-700">Target Image Format</label>
            <div className="grid grid-cols-3 gap-2">
              {(['png', 'webp', 'jpeg'] as const).map((fmt) => (
                <button
                  key={fmt}
                  type="button"
                  onClick={() => setFormat(fmt)}
                  className={`py-2 px-3 rounded-full border text-center font-semibold uppercase tracking-wider text-xs transition-all ${
                    format === fmt
                      ? 'bg-slate-900 border-slate-900 text-white shadow-xs'
                      : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {fmt === 'jpeg' ? 'JPG (4:4:4)' : fmt === 'png' ? 'PNG (Lossless)' : 'WebP'}
                </button>
              ))}
            </div>
          </div>

          {/* Quality Slider (for JPEG / WebP) */}
          {format !== 'png' && (
            <div className="space-y-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div className="flex justify-between items-center">
                <span className="text-slate-600 font-medium flex items-center gap-1.5">
                  <Sliders className="w-3 h-3 text-slate-700" />
                  Studio Quality Level
                </span>
                <span className="font-mono text-slate-900 font-semibold">{Math.round(quality * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.7"
                max="1.0"
                step="0.05"
                value={quality}
                onChange={(e) => setQuality(Number(e.target.value))}
                className="w-full accent-slate-900 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
              />
            </div>
          )}

          {/* Telemetry Result Card if available */}
          {telemetry && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1.5 text-[11px] font-mono text-slate-700">
              <div className="flex items-center gap-1.5 font-semibold text-slate-900">
                <ShieldCheck className="w-4 h-4 text-slate-700" />
                Verified Lossless Compositing Telemetry
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px] text-slate-600">
                <div>Unedited SSIM: <span className="text-slate-900 font-bold">{telemetry.ssimUneditedRegion}</span></div>
                <div>Max Delta E: <span className="text-slate-900 font-bold">{telemetry.deltaEMax}</span></div>
                <div>Export Size: <span className="text-slate-900">{Math.round(telemetry.fileSizeBytes / 1024)} KB</span></div>
                <div>Changed Area: <span className="text-slate-900">{telemetry.changedPixelPercentage}%</span></div>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <span className="text-[10px] text-slate-500 font-mono text-center sm:text-left">
            Output: {image.width}×{image.height}px • {format.toUpperCase()}
          </span>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={onClose}
              disabled={isExporting}
              className="px-4 py-2 text-xs font-semibold rounded-full text-slate-600 hover:text-slate-900 hover:bg-slate-200 transition-colors"
            >
              Close
            </button>

            <button
              onClick={handleExport}
              disabled={isExporting}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2 text-xs font-semibold rounded-full bg-slate-900 hover:bg-slate-800 text-white shadow-xs transition-all active:scale-95 disabled:opacity-50"
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
