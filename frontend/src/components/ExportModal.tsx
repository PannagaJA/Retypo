import React, { useState } from 'react';
import type { ImageMetadata, TextLayer, InpaintPatch, ExportFormat, CompositorVerificationTelemetry } from '../types';
import { exportHighResImage, triggerDownload } from '../utils/exporter';
import { renderStudioExport } from '../services/api';
import { X, AlertCircle, Loader2 } from 'lucide-react';

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

  const activeLayersCount = layers.filter((l) => l.isVisible).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-3 sm:p-4 select-none animate-in fade-in duration-150">
      <div className="w-full max-w-lg max-h-[92dvh] bg-white border border-[#e8e4dc] rounded-3xl shadow-2xl overflow-hidden flex flex-col text-neutral-800">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#e8e4dc] bg-[#fbf9f5] flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-base font-bold text-neutral-900 tracking-tight">Export Image</h2>
            <p className="text-[11px] text-neutral-500 mt-0.5">Save your edited image in high resolution</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-neutral-400 hover:text-neutral-700 hover:bg-[#ede9df] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 text-xs overflow-y-auto flex-1">
          {/* Quality Mode */}
          <div className="space-y-1.5">
            <label className="font-semibold text-neutral-700">Export Quality</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setEngine('studio')}
                className={`p-3.5 rounded-2xl border text-left transition-all ${
                  engine === 'studio'
                    ? 'bg-[#fffbf8] border-2 border-[#ff6f42] text-neutral-900 shadow-xs'
                    : 'bg-white border-[#e8e4dc] text-neutral-600 hover:border-[#ff6f42]/40'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-neutral-900">
                    High Quality
                  </span>
                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-[#ffefe8] text-[#ff6f42] font-semibold">
                    Recommended
                  </span>
                </div>
                <div className="text-[11px] text-neutral-500 mt-1">
                  Crisp text and highest clarity at original resolution
                </div>
              </button>

              <button
                type="button"
                onClick={() => setEngine('client')}
                className={`p-3.5 rounded-2xl border text-left transition-all ${
                  engine === 'client'
                    ? 'bg-[#fffbf8] border-2 border-[#ff6f42] text-neutral-900 shadow-xs'
                    : 'bg-white border-[#e8e4dc] text-neutral-600 hover:border-[#ff6f42]/40'
                }`}
              >
                <div className="font-semibold text-xs text-neutral-900">
                  Quick Export
                </div>
                <div className="text-[11px] text-neutral-500 mt-1">
                  Fast download directly from your browser
                </div>
              </button>
            </div>
          </div>

          {/* Image Details */}
          <div className="bg-[#fbf9f5] border border-[#e8e4dc] rounded-2xl p-4 space-y-2.5">
            <div className="flex justify-between items-center">
              <span className="text-neutral-500 font-medium">Original Dimensions</span>
              <span className="font-semibold text-neutral-900">
                {image.width} × {image.height} px
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-neutral-500 font-medium">Clarity Guarantee</span>
              <span className="text-neutral-900 font-medium">
                Original quality 100% preserved
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-neutral-500 font-medium">Edits Included</span>
              <span className="text-neutral-800 font-medium">
                {activeLayersCount} text {activeLayersCount === 1 ? 'layer' : 'layers'}
                {patches.length > 0 && ` • ${patches.length} cleanup ${patches.length === 1 ? 'patch' : 'patches'}`}
              </span>
            </div>
          </div>

          {/* Format Picker */}
          <div className="space-y-1.5">
            <label className="font-semibold text-neutral-700">File Format</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'png', label: 'PNG', sub: 'Best Quality' },
                { id: 'jpeg', label: 'JPG', sub: 'Smaller Size' },
                { id: 'webp', label: 'WebP', sub: 'Modern Web' },
              ].map((fmt) => (
                <button
                  key={fmt.id}
                  type="button"
                  onClick={() => setFormat(fmt.id as ExportFormat)}
                  className={`py-2.5 px-3 rounded-2xl border text-center transition-all ${
                    format === fmt.id
                      ? 'bg-[#fffbf8] border-2 border-[#ff6f42] text-neutral-900 shadow-xs'
                      : 'bg-white border-[#e8e4dc] text-neutral-700 hover:border-[#ff6f42]/40'
                  }`}
                >
                  <div className="font-bold text-xs">{fmt.label}</div>
                  <div className="text-[10px] text-neutral-500 mt-0.5">{fmt.sub}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Quality Slider (for JPEG / WebP) */}
          {format !== 'png' && (
            <div className="space-y-2.5 bg-[#fbf9f5] p-4 rounded-2xl border border-[#e8e4dc]">
              <div className="flex justify-between items-center">
                <span className="text-neutral-700 font-semibold">Image Quality</span>
                <span className="font-semibold text-neutral-900">{Math.round(quality * 100)}%</span>
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

          {/* Success Telemetry Feedback */}
          {telemetry && (
            <div className="bg-[#fbf9f5] border border-[#e8e4dc] rounded-2xl p-3 text-xs text-neutral-700">
              Image exported successfully with original clarity preserved.
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
        <div className="px-5 py-4 bg-[#fbf9f5] border-t border-[#e8e4dc] flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <span className="text-[11px] text-neutral-500 text-center sm:text-left">
            {image.width} × {image.height} px • {format.toUpperCase()}
          </span>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={onClose}
              disabled={isExporting}
              className="px-4 py-2 text-xs font-semibold rounded-full text-neutral-700 hover:text-neutral-950 bg-[#ede9df] hover:bg-[#e2ddd1] transition-colors"
            >
              Cancel
            </button>

            <button
              onClick={handleExport}
              disabled={isExporting}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-6 py-2.5 text-xs font-semibold rounded-full bg-[#ff6f42] hover:bg-[#ee6037] text-white shadow-md shadow-[#ff6f42]/20 transition-all active:scale-95 disabled:opacity-50"
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Preparing Image...
                </>
              ) : (
                'Download Image'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
