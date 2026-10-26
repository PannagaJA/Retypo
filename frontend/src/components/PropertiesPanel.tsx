import React, { useState } from 'react';
import type { TextLayer, ImageMetadata, FontCandidate } from '../types';
import { matchTypography } from '../services/api';
import {
  Type,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Italic,
  Copy,
  Trash2,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Sliders,
  Layers,
  ChevronDown,
  Eraser,
  Loader2,
  CheckCircle2,
  Check,
  ScanText,
  X
} from 'lucide-react';

interface PropertiesPanelProps {
  layer: TextLayer | null;
  image?: ImageMetadata | null;
  onChange: (updated: Partial<TextLayer>) => void;
  onDuplicate: (layerId: string) => void;
  onDelete: (layerId: string) => void;
  onBringForward: (layerId: string) => void;
  onSendBackward: (layerId: string) => void;
  // Inpainting props
  onInpaintLayer: (layer: TextLayer, strategy: string, padding: number) => Promise<void>;
  isInpainting: boolean;
  hasInpaintPatch: boolean;
  onClose?: () => void;
}

const FONT_FAMILIES = [
  'Inter',
  'Roboto',
  'Montserrat',
  'Playfair Display',
  'Outfit',
  'Open Sans',
  'Arial',
  'Georgia',
  'Courier New',
  'Times New Roman'
];

const FONT_WEIGHTS = [
  { label: 'Light', value: '300' },
  { label: 'Regular', value: '400' },
  { label: 'Medium', value: '500' },
  { label: 'Semi-Bold', value: '600' },
  { label: 'Bold', value: '700' },
  { label: 'Extra-Bold', value: '800' }
];

const INPAINT_STRATEGIES = [
  { label: 'Auto (Adaptive Variance)', value: 'auto' },
  { label: 'Solid Color Fill', value: 'solid' },
  { label: 'Bilinear Gradient', value: 'gradient' },
  { label: 'Texture-Aware (Telea)', value: 'telea' },
  { label: 'Fluid Dynamics (Navier-Stokes)', value: 'ns' },
];

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
  layer,
  image,
  onChange,
  onDuplicate,
  onDelete,
  onBringForward,
  onSendBackward,
  onInpaintLayer,
  isInpainting,
  hasInpaintPatch,
  onClose,
}) => {
  const [inpaintStrategy, setInpaintStrategy] = useState<string>('auto');
  const [maskPadding, setMaskPadding] = useState<number>(2);

  // Typography Matching State
  const [isMatching, setIsMatching] = useState<boolean>(false);
  const [candidates, setCandidates] = useState<FontCandidate[]>([]);
  const [matchMeta, setMatchMeta] = useState<{
    detectedWeight: string;
    detectedSerif: boolean;
    strokeWidth: number;
  } | null>(null);
  const [previewBackup, setPreviewBackup] = useState<Partial<TextLayer> | null>(null);

  if (!layer) {
    return (
      <aside className="w-full lg:w-80 bg-white border-l-0 lg:border-l border-slate-200 flex flex-col p-6 items-center justify-center text-center select-none text-slate-500 relative h-full">
        {onClose && (
          <button
            onClick={onClose}
            className="lg:hidden absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        )}
        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3 text-slate-600 border border-slate-200 shadow-2xs">
          <Type className="w-6 h-6" />
        </div>
        <h3 className="text-sm font-semibold text-slate-800">No Layer Selected</h3>
        <p className="text-xs text-slate-500 mt-1 max-w-[200px]">
          Click on any text on the canvas or add a new text layer to inspect and customize typography.
        </p>
      </aside>
    );
  }

  const handleScanTypography = async () => {
    if (!layer) return;
    setIsMatching(true);

    try {
      let cropBase64: string | undefined = undefined;

      // Extract client-side high-speed crop if base image exists
      if (image?.dataUrl) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = image.dataUrl;
        await new Promise<void>((resolve) => {
          if (img.complete) {
            resolve();
          } else {
            img.onload = () => resolve();
            img.onerror = () => resolve();
          }
        });

        const cropW = Math.max(16, Math.min(img.width, Math.round(layer.width)));
        const cropH = Math.max(16, Math.min(img.height, Math.round(layer.height)));
        const cropCanvas = document.createElement('canvas');
        cropCanvas.width = cropW;
        cropCanvas.height = cropH;
        const ctx = cropCanvas.getContext('2d');
        if (ctx) {
          const srcX = Math.max(0, Math.min(img.width - cropW, Math.round(layer.left)));
          const srcY = Math.max(0, Math.min(img.height - cropH, Math.round(layer.top)));
          ctx.drawImage(img, srcX, srcY, cropW, cropH, 0, 0, cropW, cropH);
          cropBase64 = cropCanvas.toDataURL('image/png');
        }
      }

      const res = await matchTypography(
        { cropBase64, file: image?.file },
        layer.text,
        undefined,
        [layer.left, layer.top, layer.width, layer.height],
        layer.fontSize,
        5
      );

      setCandidates(res.candidates);
      setMatchMeta({
        detectedWeight: res.detectedWeight,
        detectedSerif: res.detectedSerif,
        strokeWidth: res.estimatedStrokeWidth
      });
    } catch (err) {
      console.error('Failed to match typography:', err);
    } finally {
      setIsMatching(false);
    }
  };

  const handlePreviewCandidate = (cand: FontCandidate) => {
    if (!previewBackup) {
      setPreviewBackup({
        fontFamily: layer.fontFamily,
        fontWeight: layer.fontWeight,
        letterSpacing: layer.letterSpacing,
      });
    }
    onChange({
      fontFamily: cand.family,
      fontWeight: cand.weight,
      letterSpacing: cand.letterSpacing,
    });
  };

  const handleCancelPreview = () => {
    if (previewBackup) {
      onChange(previewBackup);
      setPreviewBackup(null);
    }
  };

  const handleApplyCandidate = (cand: FontCandidate) => {
    setPreviewBackup(null);
    onChange({
      fontFamily: cand.family,
      fontWeight: cand.weight,
      letterSpacing: cand.letterSpacing,
      fontSize: cand.fontSize,
    });
  };

  return (
    <aside className="w-full lg:w-80 bg-white border-l-0 lg:border-l border-slate-200 flex flex-col h-full overflow-y-auto select-none text-slate-800">
      {/* Panel Header */}
      <div className="p-3 sm:p-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-800 flex items-center justify-center shrink-0 border border-slate-200">
            <Type className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">Typography</h2>
            <p className="text-[10px] text-slate-500 font-mono leading-none mt-0.5">Inspector</p>
          </div>
          {layer.origin === 'ocr_detected' && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 font-mono font-semibold ml-1">
              OCR
            </span>
          )}
        </div>

        {/* Quick Toolbar */}
        <div className="flex items-center gap-1 bg-slate-100 border border-slate-200 rounded-full p-1 shadow-xs">
          <button
            onClick={() => onChange({ isLocked: !layer.isLocked })}
            className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
              layer.isLocked ? 'text-amber-700 bg-amber-100' : 'text-slate-500 hover:text-slate-900 hover:bg-white'
            }`}
            title={layer.isLocked ? 'Unlock layer' : 'Lock layer'}
          >
            {layer.isLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={() => onChange({ isVisible: !layer.isVisible })}
            className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
              !layer.isVisible ? 'text-red-700 bg-red-100' : 'text-slate-500 hover:text-slate-900 hover:bg-white'
            }`}
            title={layer.isVisible ? 'Hide layer' : 'Show layer'}
          >
            {layer.isVisible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={() => onDuplicate(layer.id)}
            className="w-7 h-7 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-white transition-colors"
            title="Duplicate layer (Ctrl/Cmd + D)"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDelete(layer.id)}
            className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
            title="Delete layer (Delete/Backspace)"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="lg:hidden w-7 h-7 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-white transition-colors ml-0.5"
              title="Close"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="p-4 pb-28 lg:pb-6 space-y-4">
        {/* Background Inpainting / Text Removal Section */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
              <Eraser className="w-3.5 h-3.5 text-slate-700" />
              Remove Original Text
            </span>
            {hasInpaintPatch ? (
              <span className="flex items-center gap-1 text-[10px] font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full font-medium">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                Restored
              </span>
            ) : (
              <span className="text-[10px] text-slate-500 font-mono">Inpainting</span>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-slate-600">Restoration Method</label>
            <select
              value={inpaintStrategy}
              onChange={(e) => setInpaintStrategy(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-slate-900 cursor-pointer"
            >
              {INPAINT_STRATEGIES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-slate-600">Mask Padding</span>
              <span className="font-mono text-slate-800">+{maskPadding}px</span>
            </div>
            <input
              type="range"
              min="-2"
              max="12"
              value={maskPadding}
              onChange={(e) => setMaskPadding(Number(e.target.value))}
              className="w-full accent-slate-900 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
            />
          </div>

          <button
            onClick={() => onInpaintLayer(layer, inpaintStrategy, maskPadding)}
            disabled={isInpainting}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-all shadow-xs active:scale-95 disabled:opacity-50"
          >
            {isInpainting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />
                Restoring Background...
              </>
            ) : (
              <>
                <Eraser className="w-3.5 h-3.5" />
                {hasInpaintPatch ? 'Re-Inpaint Background' : 'Erase Text from Background'}
              </>
            )}
          </button>
        </div>

        {/* Typography Matching Section */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
              <ScanText className="w-3.5 h-3.5 text-slate-700" />
              Font Matching Engine
            </span>
            <span className="text-[10px] text-slate-600 font-mono bg-slate-200/60 border border-slate-200 px-1.5 py-0.5 rounded-full font-medium">
              4-Signal
            </span>
          </div>

          <button
            onClick={handleScanTypography}
            disabled={isMatching}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-full bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-800 text-xs font-semibold transition-all shadow-xs active:scale-95 disabled:opacity-50"
          >
            {isMatching ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-600" />
                Analyzing Glyphs & Geometry...
              </>
            ) : (
              <>
                <ScanText className="w-3.5 h-3.5 text-slate-700" />
                Match Font From Image
              </>
            )}
          </button>

          {matchMeta && (
            <div className="text-[10px] font-mono text-slate-600 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 flex items-center justify-between">
              <span>Detected: {matchMeta.detectedWeight}</span>
              <span>{matchMeta.detectedSerif ? 'Serif' : 'Sans-Serif'}</span>
              <span>{matchMeta.strokeWidth}px Stroke</span>
            </div>
          )}

          {candidates.length > 0 && (
            <div className="space-y-1.5 pt-1">
              <span className="text-[11px] font-medium text-slate-600 block">
                Top Candidates (Hover to preview, Click to apply):
              </span>
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {candidates.map((cand, idx) => {
                  const isSelected = layer.fontFamily === cand.family;
                  const matchPct = Math.round(cand.confidence * 100);

                  return (
                    <div
                      key={cand.family}
                      onMouseEnter={() => handlePreviewCandidate(cand)}
                      onMouseLeave={handleCancelPreview}
                      onClick={() => handleApplyCandidate(cand)}
                      className={`p-2 rounded-xl border text-left cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-slate-50 border-2 border-slate-900 text-slate-900 shadow-xs'
                          : 'bg-white border-slate-200 hover:border-slate-300 text-slate-800 shadow-2xs'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-mono text-slate-400 w-3">
                            #{idx + 1}
                          </span>
                          <span
                            className="text-xs font-semibold tracking-wide"
                            style={{ fontFamily: cand.family, fontWeight: cand.weight }}
                          >
                            {cand.family}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded-full ${
                              matchPct >= 80
                                ? 'bg-slate-100 text-slate-900 border border-slate-200'
                                : 'bg-slate-100 text-slate-600 border border-slate-200'
                            }`}
                          >
                            {matchPct}%
                          </span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-slate-900" />}
                        </div>
                      </div>

                      {/* Progress Bar & Badges */}
                      <div className="mt-1.5 space-y-1">
                        <div className="w-full bg-slate-100 h-1 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-slate-900"
                            style={{ width: `${matchPct}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[9px] text-slate-500 font-mono">
                          <span>{cand.category}</span>
                          <span>w: {cand.weight}</span>
                          <span>
                            {cand.letterSpacing > 0 ? `+${cand.letterSpacing}` : cand.letterSpacing}px
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Text Content */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-600">Content</label>
          <textarea
            value={layer.text}
            onChange={(e) => onChange({ text: e.target.value })}
            rows={3}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-slate-900 focus:bg-white transition-colors"
          />
        </div>

        {/* Font Family & Weight */}
        <div className="space-y-3 pt-2 border-t border-slate-200">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-600">Font Family</label>
            <div className="relative">
              <select
                value={layer.fontFamily}
                onChange={(e) => onChange({ fontFamily: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-900 appearance-none focus:outline-none focus:border-slate-900 focus:bg-white cursor-pointer"
                style={{ fontFamily: layer.fontFamily }}
              >
                {FONT_FAMILIES.map((family) => (
                  <option key={family} value={family} style={{ fontFamily: family }}>
                    {family}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Weight */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600">Weight</label>
              <div className="relative">
                <select
                  value={String(layer.fontWeight)}
                  onChange={(e) => onChange({ fontWeight: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-900 appearance-none focus:outline-none focus:border-slate-900 focus:bg-white cursor-pointer"
                >
                  {FONT_WEIGHTS.map((w) => (
                    <option key={w.value} value={w.value}>
                      {w.label} ({w.value})
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />
              </div>
            </div>

            {/* Style (Italic) */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600">Style</label>
              <button
                onClick={() =>
                  onChange({ fontStyle: layer.fontStyle === 'italic' ? 'normal' : 'italic' })
                }
                className={`w-full py-1.5 px-3 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 border transition-colors ${
                  layer.fontStyle === 'italic'
                    ? 'bg-slate-900 border-slate-900 text-white'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Italic className="w-3.5 h-3.5" />
                Italic
              </button>
            </div>
          </div>
        </div>

        {/* Font Size & Alignment */}
        <div className="space-y-3 pt-2 border-t border-slate-200">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-slate-600">Font Size</label>
            <span className="text-xs font-mono text-slate-800 font-semibold">{Math.round(layer.fontSize)} px</span>
          </div>
          <input
            type="range"
            min="10"
            max="180"
            value={layer.fontSize}
            onChange={(e) => onChange({ fontSize: Number(e.target.value) })}
            className="w-full accent-slate-900 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
          />

          {/* Text Alignment */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-600">Text Align</label>
            <div className="grid grid-cols-4 gap-1 bg-slate-100 p-1 border border-slate-200 rounded-lg">
              {(['left', 'center', 'right', 'justify'] as const).map((align) => {
                const Icon =
                  align === 'left'
                    ? AlignLeft
                    : align === 'center'
                    ? AlignCenter
                    : align === 'right'
                    ? AlignRight
                    : AlignJustify;
                return (
                  <button
                    key={align}
                    onClick={() => onChange({ textAlign: align })}
                    className={`p-1.5 flex justify-center rounded-md transition-colors ${
                      layer.textAlign === align
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'text-slate-500 hover:text-slate-900 hover:bg-white'
                    }`}
                    title={`Align ${align}`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Colors & Fill */}
        <div className="space-y-3 pt-2 border-t border-slate-200">
          <h3 className="text-xs font-semibold tracking-wider uppercase text-slate-500 flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-slate-700" />
            Appearance
          </h3>

          <div className="grid grid-cols-2 gap-3">
            {/* Fill Color */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600">Text Color</label>
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg p-1.5">
                <input
                  type="color"
                  value={layer.fill.startsWith('#') ? layer.fill : '#0f172a'}
                  onChange={(e) => onChange({ fill: e.target.value })}
                  className="w-6 h-6 rounded border border-slate-200 cursor-pointer bg-transparent"
                />
                <input
                  type="text"
                  value={layer.fill}
                  onChange={(e) => onChange({ fill: e.target.value })}
                  className="w-full bg-transparent text-xs font-mono text-slate-900 focus:outline-none"
                />
              </div>
            </div>

            {/* Opacity */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <label className="font-medium text-slate-600">Opacity</label>
                <span className="font-mono text-slate-800">{Math.round(layer.opacity * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.05"
                max="1"
                step="0.05"
                value={layer.opacity}
                onChange={(e) => onChange({ opacity: Number(e.target.value) })}
                className="w-full accent-slate-900 cursor-pointer h-1.5 bg-slate-200 rounded-lg mt-3"
              />
            </div>

            {/* Edge Softness / Natural Blur */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <label className="font-medium text-slate-600">Edge Softness</label>
                <span className="font-mono text-slate-800">{(layer.blur ?? 0.6).toFixed(1)}px</span>
              </div>
              <input
                type="range"
                min="0"
                max="2.5"
                step="0.1"
                value={layer.blur ?? 0.6}
                onChange={(e) => onChange({ blur: Number(e.target.value) })}
                className="w-full accent-slate-900 cursor-pointer h-1.5 bg-slate-200 rounded-lg mt-3"
              />
            </div>
          </div>

          {/* Stroke */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs">
              <label className="font-medium text-slate-600">Stroke Outline</label>
              <span className="font-mono text-slate-800">{layer.strokeWidth || 0} px</span>
            </div>
            <div className="grid grid-cols-3 gap-2 items-center">
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg p-1">
                <input
                  type="color"
                  value={layer.stroke || '#000000'}
                  onChange={(e) => onChange({ stroke: e.target.value })}
                  className="w-5 h-5 rounded border border-slate-200 cursor-pointer bg-transparent"
                />
                <span className="text-[10px] font-mono text-slate-500">Color</span>
              </div>
              <div className="col-span-2">
                <input
                  type="range"
                  min="0"
                  max="20"
                  value={layer.strokeWidth || 0}
                  onChange={(e) => onChange({ strokeWidth: Number(e.target.value) })}
                  className="w-full accent-slate-900 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
                />
              </div>
            </div>
          </div>

          {/* Spacing & Line Height */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-slate-600">Tracking</label>
              <input
                type="number"
                min="-10"
                max="100"
                value={layer.letterSpacing || 0}
                onChange={(e) => onChange({ letterSpacing: Number(e.target.value) })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-mono text-slate-900"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-slate-600">Line Height</label>
              <input
                type="number"
                step="0.1"
                min="0.5"
                max="3.0"
                value={layer.lineHeight || 1.2}
                onChange={(e) => onChange({ lineHeight: Number(e.target.value) })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-mono text-slate-900"
              />
            </div>
          </div>
        </div>

        {/* Shadow */}
        <div className="space-y-3 pt-2 border-t border-slate-200">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-slate-600">Drop Shadow</label>
            <input
              type="checkbox"
              checked={Boolean(layer.shadow && layer.shadow.blur > 0)}
              onChange={(e) => {
                if (e.target.checked) {
                  onChange({ shadow: { color: 'rgba(0,0,0,0.25)', blur: 8, offsetX: 3, offsetY: 3 } });
                } else {
                  onChange({ shadow: { color: 'transparent', blur: 0, offsetX: 0, offsetY: 0 } });
                }
              }}
              className="accent-slate-900 rounded cursor-pointer"
            />
          </div>

          {layer.shadow && layer.shadow.blur > 0 && (
            <div className="space-y-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-600">Blur</span>
                <span className="font-mono text-slate-800">{layer.shadow.blur}px</span>
              </div>
              <input
                type="range"
                min="1"
                max="40"
                value={layer.shadow.blur}
                onChange={(e) =>
                  onChange({
                    shadow: { ...layer.shadow!, blur: Number(e.target.value) },
                  })
                }
                className="w-full accent-slate-900 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
              />
            </div>
          )}
        </div>

        {/* Layer Depth Ordering */}
        <div className="space-y-2 pt-2 border-t border-slate-200">
          <label className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-slate-700" />
            Layer Stacking
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => onBringForward(layer.id)}
              className="py-1 px-2.5 text-xs bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-700 transition-colors font-medium"
            >
              Bring Forward
            </button>
            <button
              onClick={() => onSendBackward(layer.id)}
              className="py-1 px-2.5 text-xs bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-700 transition-colors font-medium"
            >
              Send Backward
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};
