import React from 'react';
import type { TextLayer, ImageMetadata } from '../types';
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
  onInpaintLayer?: (layer: TextLayer, strategy: string, padding: number) => Promise<void>;
  isInpainting?: boolean;
  hasInpaintPatch?: boolean;
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

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
  layer,
  onChange,
  onDuplicate,
  onDelete,
  onBringForward,
  onSendBackward,
  onClose,
}) => {

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
