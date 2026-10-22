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
  Sparkles,
  CheckCircle2,
  Check,
  Wand2
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
      <aside className="w-80 bg-[#12151e] border-l border-[#212636] flex flex-col p-6 items-center justify-center text-center select-none text-gray-500">
        <div className="w-12 h-12 rounded-full bg-[#181d2a] flex items-center justify-center mb-3 text-gray-400 border border-[#252c3e]">
          <Type className="w-6 h-6" />
        </div>
        <h3 className="text-sm font-medium text-gray-300">No Layer Selected</h3>
        <p className="text-xs text-gray-500 mt-1 max-w-[200px]">
          Click on any text in the canvas or add a new text layer to inspect and customize typography.
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
    <aside className="w-80 bg-[#12151e] border-l border-[#212636] flex flex-col h-full overflow-y-auto select-none text-gray-200">
      {/* Panel Header */}
      <div className="p-4 border-b border-[#212636] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Type className="w-4 h-4 text-blue-400" />
          <h2 className="text-sm font-semibold tracking-wide text-white">Typography</h2>
          {layer.origin === 'ocr_detected' && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
              OCR
            </span>
          )}
        </div>

        {/* Quick Toolbar */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => onChange({ isLocked: !layer.isLocked })}
            className={`p-1.5 rounded hover:bg-[#1f2536] transition-colors ${
              layer.isLocked ? 'text-amber-400' : 'text-gray-400'
            }`}
            title={layer.isLocked ? 'Unlock layer' : 'Lock layer'}
          >
            {layer.isLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={() => onChange({ isVisible: !layer.isVisible })}
            className={`p-1.5 rounded hover:bg-[#1f2536] transition-colors ${
              !layer.isVisible ? 'text-red-400' : 'text-gray-400'
            }`}
            title={layer.isVisible ? 'Hide layer' : 'Show layer'}
          >
            {layer.isVisible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={() => onDuplicate(layer.id)}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-[#1f2536] rounded transition-colors"
            title="Duplicate layer (Ctrl/Cmd + D)"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDelete(layer.id)}
            className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors"
            title="Delete layer (Delete/Backspace)"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="p-4 space-y-5">
        {/* Background Inpainting / Text Removal Section */}
        <div className="bg-[#161a26] border border-[#273044] rounded-lg p-3 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-white flex items-center gap-1.5">
              <Eraser className="w-3.5 h-3.5 text-purple-400" />
              Remove Original Text
            </span>
            {hasInpaintPatch ? (
              <span className="flex items-center gap-1 text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded">
                <CheckCircle2 className="w-3 h-3" />
                Restored
              </span>
            ) : (
              <span className="text-[10px] text-gray-400 font-mono">Inpainting</span>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-gray-400">Restoration Method</label>
            <select
              value={inpaintStrategy}
              onChange={(e) => setInpaintStrategy(e.target.value)}
              className="w-full bg-[#12151e] border border-[#273044] rounded px-2.5 py-1 text-xs text-white focus:outline-none focus:border-purple-500"
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
              <span className="text-gray-400">Mask Padding</span>
              <span className="font-mono text-gray-300">+{maskPadding}px</span>
            </div>
            <input
              type="range"
              min="-2"
              max="12"
              value={maskPadding}
              onChange={(e) => setMaskPadding(Number(e.target.value))}
              className="w-full accent-purple-500 cursor-pointer h-1.5 bg-[#252c3e] rounded-lg"
            />
          </div>

          <button
            onClick={() => onInpaintLayer(layer, inpaintStrategy, maskPadding)}
            disabled={isInpainting}
            className="w-full flex items-center justify-center gap-2 py-1.5 px-3 rounded-md bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/40 text-xs font-semibold transition-all shadow-sm active:scale-95 disabled:opacity-50"
          >
            {isInpainting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Inpainting Background...
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                {hasInpaintPatch ? 'Re-Inpaint Background' : 'Erase Text & Inpaint'}
              </>
            )}
          </button>
        </div>

        {/* AI Typography Matching Section */}
        <div className="bg-[#141926] border border-[#27364f] rounded-lg p-3 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-white flex items-center gap-1.5">
              <Wand2 className="w-3.5 h-3.5 text-blue-400" />
              AI Font Matcher
            </span>
            <span className="text-[10px] text-blue-400 font-mono bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded">
              4-Signal
            </span>
          </div>

          <button
            onClick={handleScanTypography}
            disabled={isMatching}
            className="w-full flex items-center justify-center gap-2 py-1.5 px-3 rounded-md bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 text-xs font-semibold transition-all shadow-sm active:scale-95 disabled:opacity-50"
          >
            {isMatching ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
                Analyzing Glyphs & Contours...
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                Scan & Match Typography
              </>
            )}
          </button>

          {matchMeta && (
            <div className="text-[10px] font-mono text-gray-400 bg-[#0e121a] px-2 py-1 rounded border border-[#1f2638] flex items-center justify-between">
              <span>Detected: {matchMeta.detectedWeight} Weight</span>
              <span>{matchMeta.detectedSerif ? 'Serif' : 'Sans-Serif'}</span>
              <span>{matchMeta.strokeWidth}px Stroke</span>
            </div>
          )}

          {candidates.length > 0 && (
            <div className="space-y-1.5 pt-1">
              <span className="text-[11px] font-medium text-gray-400 block">
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
                      className={`p-2 rounded-md border text-left cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-blue-900/30 border-blue-500/50 text-white'
                          : 'bg-[#181d2a] border-[#252e42] hover:border-blue-500/40 text-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-mono text-gray-500 w-3">
                            #{idx + 1}
                          </span>
                          <span
                            className="text-xs font-medium tracking-wide"
                            style={{ fontFamily: cand.family, fontWeight: cand.weight }}
                          >
                            {cand.family}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded ${
                              matchPct >= 80
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                            }`}
                          >
                            {matchPct}%
                          </span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-blue-400" />}
                        </div>
                      </div>

                      {/* Progress Bar & Badges */}
                      <div className="mt-1.5 space-y-1">
                        <div className="w-full bg-[#10141f] h-1 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${
                              matchPct >= 80 ? 'bg-emerald-500' : 'bg-blue-500'
                            }`}
                            style={{ width: `${matchPct}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[9px] text-gray-400 font-mono">
                          <span>{cand.category}</span>
                          <span>w: {cand.weight}</span>
                          <span>
                            {cand.letterSpacing > 0 ? `+${cand.letterSpacing}` : cand.letterSpacing}px tracking
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
          <label className="text-xs font-medium text-gray-400">Content</label>
          <textarea
            value={layer.text}
            onChange={(e) => onChange({ text: e.target.value })}
            rows={3}
            className="w-full bg-[#181d2a] border border-[#273044] rounded-md px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        {/* Font Family & Weight */}
        <div className="space-y-3 pt-2 border-t border-[#212636]">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-400">Font Family</label>
            <div className="relative">
              <select
                value={layer.fontFamily}
                onChange={(e) => onChange({ fontFamily: e.target.value })}
                className="w-full bg-[#181d2a] border border-[#273044] rounded-md px-3 py-1.5 text-xs text-white appearance-none focus:outline-none focus:border-blue-500 cursor-pointer"
                style={{ fontFamily: layer.fontFamily }}
              >
                {FONT_FAMILIES.map((family) => (
                  <option key={family} value={family} style={{ fontFamily: family }}>
                    {family}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-3 top-2.5 pointer-events-none" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Weight */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-400">Weight</label>
              <div className="relative">
                <select
                  value={String(layer.fontWeight)}
                  onChange={(e) => onChange({ fontWeight: e.target.value })}
                  className="w-full bg-[#181d2a] border border-[#273044] rounded-md px-3 py-1.5 text-xs text-white appearance-none focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  {FONT_WEIGHTS.map((w) => (
                    <option key={w.value} value={w.value}>
                      {w.label} ({w.value})
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-3 top-2.5 pointer-events-none" />
              </div>
            </div>

            {/* Style (Italic) */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-400">Style</label>
              <button
                onClick={() =>
                  onChange({ fontStyle: layer.fontStyle === 'italic' ? 'normal' : 'italic' })
                }
                className={`w-full py-1.5 px-3 rounded-md text-xs font-medium flex items-center justify-center gap-1.5 border transition-colors ${
                  layer.fontStyle === 'italic'
                    ? 'bg-blue-600 border-blue-500 text-white'
                    : 'bg-[#181d2a] border-[#273044] text-gray-400 hover:text-white'
                }`}
              >
                <Italic className="w-3.5 h-3.5" />
                Italic
              </button>
            </div>
          </div>
        </div>

        {/* Font Size & Alignment */}
        <div className="space-y-3 pt-2 border-t border-[#212636]">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-gray-400">Font Size</label>
            <span className="text-xs font-mono text-gray-300">{Math.round(layer.fontSize)} px</span>
          </div>
          <input
            type="range"
            min="10"
            max="180"
            value={layer.fontSize}
            onChange={(e) => onChange({ fontSize: Number(e.target.value) })}
            className="w-full accent-blue-500 cursor-pointer h-1.5 bg-[#252c3e] rounded-lg"
          />

          {/* Text Alignment */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-400">Text Align</label>
            <div className="grid grid-cols-4 gap-1 bg-[#181d2a] p-1 border border-[#273044] rounded-md">
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
                    className={`p-1.5 flex justify-center rounded transition-colors ${
                      layer.textAlign === align
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-400 hover:text-white hover:bg-[#252c3e]'
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
        <div className="space-y-3 pt-2 border-t border-[#212636]">
          <h3 className="text-xs font-semibold tracking-wider uppercase text-gray-400 flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-blue-400" />
            Appearance
          </h3>

          <div className="grid grid-cols-2 gap-3">
            {/* Fill Color */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-400">Text Color</label>
              <div className="flex items-center gap-2 bg-[#181d2a] border border-[#273044] rounded-md p-1.5">
                <input
                  type="color"
                  value={layer.fill.startsWith('#') ? layer.fill : '#ffffff'}
                  onChange={(e) => onChange({ fill: e.target.value })}
                  className="w-6 h-6 rounded border-0 cursor-pointer bg-transparent"
                />
                <input
                  type="text"
                  value={layer.fill}
                  onChange={(e) => onChange({ fill: e.target.value })}
                  className="w-full bg-transparent text-xs font-mono text-white focus:outline-none"
                />
              </div>
            </div>

            {/* Opacity */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <label className="font-medium text-gray-400">Opacity</label>
                <span className="font-mono text-gray-300">{Math.round(layer.opacity * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.05"
                max="1"
                step="0.05"
                value={layer.opacity}
                onChange={(e) => onChange({ opacity: Number(e.target.value) })}
                className="w-full accent-blue-500 cursor-pointer h-1.5 bg-[#252c3e] rounded-lg mt-3"
              />
            </div>
          </div>

          {/* Stroke */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs">
              <label className="font-medium text-gray-400">Stroke Outline</label>
              <span className="font-mono text-gray-300">{layer.strokeWidth || 0} px</span>
            </div>
            <div className="grid grid-cols-3 gap-2 items-center">
              <div className="flex items-center gap-1.5 bg-[#181d2a] border border-[#273044] rounded p-1">
                <input
                  type="color"
                  value={layer.stroke || '#000000'}
                  onChange={(e) => onChange({ stroke: e.target.value })}
                  className="w-5 h-5 rounded border-0 cursor-pointer bg-transparent"
                />
                <span className="text-[10px] font-mono text-gray-400">Color</span>
              </div>
              <div className="col-span-2">
                <input
                  type="range"
                  min="0"
                  max="20"
                  value={layer.strokeWidth || 0}
                  onChange={(e) => onChange({ strokeWidth: Number(e.target.value) })}
                  className="w-full accent-blue-500 cursor-pointer h-1.5 bg-[#252c3e] rounded-lg"
                />
              </div>
            </div>
          </div>

          {/* Spacing & Line Height */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-gray-400">Tracking</label>
              <input
                type="number"
                min="-10"
                max="100"
                value={layer.letterSpacing || 0}
                onChange={(e) => onChange({ letterSpacing: Number(e.target.value) })}
                className="w-full bg-[#181d2a] border border-[#273044] rounded px-2 py-1 text-xs font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-gray-400">Line Height</label>
              <input
                type="number"
                step="0.1"
                min="0.5"
                max="3.0"
                value={layer.lineHeight || 1.2}
                onChange={(e) => onChange({ lineHeight: Number(e.target.value) })}
                className="w-full bg-[#181d2a] border border-[#273044] rounded px-2 py-1 text-xs font-mono"
              />
            </div>
          </div>
        </div>

        {/* Shadow */}
        <div className="space-y-3 pt-2 border-t border-[#212636]">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-gray-400">Drop Shadow</label>
            <input
              type="checkbox"
              checked={Boolean(layer.shadow && layer.shadow.blur > 0)}
              onChange={(e) => {
                if (e.target.checked) {
                  onChange({ shadow: { color: 'rgba(0,0,0,0.6)', blur: 8, offsetX: 3, offsetY: 3 } });
                } else {
                  onChange({ shadow: { color: 'transparent', blur: 0, offsetX: 0, offsetY: 0 } });
                }
              }}
              className="accent-blue-500 rounded cursor-pointer"
            />
          </div>

          {layer.shadow && layer.shadow.blur > 0 && (
            <div className="space-y-2 bg-[#181d2a] p-2.5 rounded-md border border-[#273044]">
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-400">Blur</span>
                <span className="font-mono text-gray-300">{layer.shadow.blur}px</span>
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
                className="w-full accent-blue-500 cursor-pointer h-1.5 bg-[#252c3e] rounded-lg"
              />
            </div>
          )}
        </div>

        {/* Layer Depth Ordering */}
        <div className="space-y-2 pt-2 border-t border-[#212636]">
          <label className="text-xs font-medium text-gray-400 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-blue-400" />
            Layer Stacking
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => onBringForward(layer.id)}
              className="py-1 px-2.5 text-xs bg-[#181d2a] hover:bg-[#252c3e] border border-[#273044] rounded text-gray-300 transition-colors"
            >
              Bring Forward
            </button>
            <button
              onClick={() => onSendBackward(layer.id)}
              className="py-1 px-2.5 text-xs bg-[#181d2a] hover:bg-[#252c3e] border border-[#273044] rounded text-gray-300 transition-colors"
            >
              Send Backward
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};
