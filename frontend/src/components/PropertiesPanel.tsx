import React, { useState, useRef, useMemo, useEffect } from 'react';
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
  X,
  Search,
  Check,
  Minus,
  Plus
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

export interface FontOption {
  name: string;
  category: 'popular' | 'default' | 'mono' | 'serif';
  keywords: string[];
}

export const FONT_CATALOG: FontOption[] = [
  // --- POPULAR / COMMONLY USED ---
  {
    name: 'Roboto',
    category: 'popular',
    keywords: ['google pay', 'gpay', 'android', 'upi', 'receipt', 'payment', 'roboto']
  },
  {
    name: 'Inter',
    category: 'popular',
    keywords: ['phonepe', 'upi', 'payment', 'clean', 'modern', 'interface', 'inter']
  },
  {
    name: 'Poppins',
    category: 'popular',
    keywords: ['phonepe', 'numbers', 'digits', 'rounded', 'banner', 'heading', 'upi', 'poppins']
  },
  {
    name: 'Rubik',
    category: 'popular',
    keywords: ['bhim', 'npci', 'government', 'upi', 'numbers', 'rounded', 'rubik']
  },
  {
    name: 'Plus Jakarta Sans',
    category: 'popular',
    keywords: ['phonepe', 'fintech', 'upi', 'cred', 'payment slip', 'wallet', 'jakarta']
  },
  {
    name: 'Noto Sans',
    category: 'popular',
    keywords: ['bhim', 'npci', 'sbi', 'national', 'banking', 'upi', 'noto']
  },
  {
    name: 'Montserrat',
    category: 'popular',
    keywords: ['paytm', 'hdfc', 'icici', 'axis', 'banking', 'payment', 'card', 'montserrat']
  },
  {
    name: 'Open Sans',
    category: 'popular',
    keywords: ['gpay', 'google pay', 'transaction', 'statement', 'upi', 'open sans']
  },
  {
    name: 'Outfit',
    category: 'popular',
    keywords: ['google sans', 'product sans', 'gpay', 'modern', 'geometric', 'outfit']
  },
  {
    name: 'DM Sans',
    category: 'popular',
    keywords: ['hdfc', 'icici', 'banking', 'upi', 'receipt', 'dm sans']
  },
  {
    name: 'Manrope',
    category: 'popular',
    keywords: ['cred', 'axis', 'fintech', 'upi', 'modern', 'manrope']
  },
  {
    name: 'Urbanist',
    category: 'popular',
    keywords: ['fintech', 'wallet', 'crypto', 'payment', 'urbanist']
  },
  {
    name: 'Lato',
    category: 'popular',
    keywords: ['sbi', 'state bank', 'banking', 'challan', 'statement', 'lato']
  },
  {
    name: 'Work Sans',
    category: 'popular',
    keywords: ['invoice', 'bill', 'receipt', 'bank', 'work sans']
  },
  {
    name: 'Nunito Sans',
    category: 'popular',
    keywords: ['wallet', 'balance', 'numbers', 'upi', 'nunito']
  },

  // --- NUMBERS, UTR, TRANSACTION ID & MONO ---
  {
    name: 'Roboto Mono',
    category: 'mono',
    keywords: ['utr', 'ref id', 'transaction id', 'reference', 'numbers', 'mono', 'roboto mono']
  },
  {
    name: 'Space Grotesk',
    category: 'mono',
    keywords: ['amount', 'price', 'rupees', 'inr', 'numbers', 'grotesk', 'space']
  },
  {
    name: 'JetBrains Mono',
    category: 'mono',
    keywords: ['code', 'hash', 'monospace', 'txn', 'id', 'jetbrains']
  },
  {
    name: 'Courier Prime',
    category: 'mono',
    keywords: ['atm', 'pos', 'slip', 'thermal', 'courier', 'receipt', 'prime']
  },
  {
    name: 'Courier New',
    category: 'mono',
    keywords: ['courier', 'mono', 'typewriter', 'default mono']
  },

  // --- COMMON DEFAULTS & WEB SAFE ---
  {
    name: 'Arial',
    category: 'default',
    keywords: ['default', 'standard', 'clean', 'system', 'web safe', 'arial']
  },
  {
    name: 'Helvetica',
    category: 'default',
    keywords: ['ios', 'iphone', 'apple', 'system', 'clean', 'default', 'helvetica']
  },
  {
    name: 'Verdana',
    category: 'default',
    keywords: ['screen', 'readable', 'default', 'wide', 'verdana']
  },
  {
    name: 'Times New Roman',
    category: 'default',
    keywords: ['formal', 'document', 'classic', 'standard', 'times']
  },
  {
    name: 'Georgia',
    category: 'serif',
    keywords: ['georgia', 'serif', 'reading', 'classic']
  },

  // --- EDITORIAL & DISPLAY SERIF ---
  {
    name: 'Playfair Display',
    category: 'serif',
    keywords: ['luxury', 'certificate', 'elegant', 'serif', 'playfair']
  },
  {
    name: 'Merriweather',
    category: 'serif',
    keywords: ['editorial', 'newspaper', 'serif', 'body', 'merriweather']
  },
  {
    name: 'Lora',
    category: 'serif',
    keywords: ['contemporary', 'calligraphic', 'serif', 'lora']
  }
];

export const FONT_FAMILIES = FONT_CATALOG.map((f) => f.name);

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
  const [isFontPickerOpen, setIsFontPickerOpen] = useState(false);
  const [fontSearch, setFontSearch] = useState('');
  const [fontCategory, setFontCategory] = useState<'all' | 'popular' | 'default' | 'mono' | 'serif'>('all');
  const fontPickerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!isFontPickerOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (fontPickerRef.current && !fontPickerRef.current.contains(e.target as Node)) {
        setIsFontPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isFontPickerOpen]);

  // Filtered fonts based on search & category tab
  const filteredFonts = useMemo(() => {
    const q = fontSearch.trim().toLowerCase();
    return FONT_CATALOG.filter((item) => {
      if (fontCategory !== 'all') {
        if (fontCategory === 'popular' && item.category !== 'popular') return false;
        if (fontCategory === 'default' && item.category !== 'default' && item.name !== 'Roboto' && item.name !== 'Inter') return false;
        if (fontCategory === 'mono' && item.category !== 'mono') return false;
        if (fontCategory === 'serif' && item.category !== 'serif') return false;
      }
      if (!q) return true;
      const nameMatch = item.name.toLowerCase().includes(q);
      const keywordMatch = item.keywords?.some((k) => k.toLowerCase().includes(q));
      return nameMatch || keywordMatch;
    });
  }, [fontSearch, fontCategory]);

  if (!layer) {
    return (
      <aside className="w-full lg:w-80 bg-[#fdfbf9] border-l-0 lg:border-l border-[#e8e4dc] flex flex-col p-6 items-center justify-center text-center select-none text-neutral-500 relative h-full">
        {onClose && (
          <button
            onClick={onClose}
            className="lg:hidden absolute top-4 right-4 p-1.5 rounded-full text-neutral-400 hover:text-neutral-700 hover:bg-white/80 transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        )}
        <div className="w-12 h-12 rounded-full bg-[#ffefe8] flex items-center justify-center mb-3 text-[#ff6f42] border border-[#ff6f42]/20 shadow-xs">
          <Type className="w-6 h-6" />
        </div>
        <h3 className="text-sm font-bold text-neutral-900">No Layer Selected</h3>
        <p className="text-xs text-neutral-600 mt-1 max-w-[200px]">
          Click on any text on the canvas or add a new text layer to inspect and customize typography.
        </p>
      </aside>
    );
  }



  return (
    <aside className="w-full lg:w-80 bg-[#fdfbf9] border-l-0 lg:border-l border-[#e8e4dc] flex flex-col h-full overflow-y-auto select-none text-neutral-800">
      {/* Panel Header */}
      <div className="p-3 sm:p-3.5 border-b border-[#e8e4dc] flex items-center justify-between bg-[#fbf9f5] shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#ffefe8] text-[#ff6f42] flex items-center justify-center shrink-0 border border-[#ff6f42]/20">
            <Type className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-900">Typography</h2>
            <p className="text-[10px] text-neutral-500 font-mono leading-none mt-0.5">Inspector</p>
          </div>
          {layer.origin === 'ocr_detected' && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#ffefe8] text-[#ff6f42] border border-[#ff6f42]/20 font-mono font-bold ml-1">
              Detected
            </span>
          )}
        </div>

        {/* Quick Toolbar */}
        <div className="flex items-center gap-1 bg-white border border-[#e8e4dc] rounded-full p-1 shadow-2xs">
          <button
            onClick={() => onChange({ isLocked: !layer.isLocked })}
            className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
              layer.isLocked ? 'text-amber-700 bg-amber-100' : 'text-neutral-500 hover:text-[#ff6f42] hover:bg-[#ffefe8]'
            }`}
            title={layer.isLocked ? 'Unlock layer' : 'Lock layer'}
          >
            {layer.isLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={() => onChange({ isVisible: !layer.isVisible })}
            className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
              !layer.isVisible ? 'text-rose-700 bg-rose-100' : 'text-neutral-500 hover:text-[#ff6f42] hover:bg-[#ffefe8]'
            }`}
            title={layer.isVisible ? 'Hide layer' : 'Show layer'}
          >
            {layer.isVisible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={() => onDuplicate(layer.id)}
            className="w-7 h-7 rounded-full flex items-center justify-center text-neutral-500 hover:text-[#ff6f42] hover:bg-[#ffefe8] transition-colors"
            title="Duplicate layer (Ctrl/Cmd + D)"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDelete(layer.id)}
            className="w-7 h-7 rounded-full flex items-center justify-center text-neutral-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
            title="Delete layer (Delete/Backspace)"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="lg:hidden w-7 h-7 rounded-full flex items-center justify-center text-neutral-500 hover:text-neutral-900 hover:bg-[#ffefe8] transition-colors ml-0.5"
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
          <label className="text-xs font-semibold text-neutral-700">Content</label>
          <textarea
            value={layer.text}
            onChange={(e) => onChange({ text: e.target.value })}
            rows={3}
            className="w-full bg-[#fbf9f5] border border-[#e8e4dc] rounded-lg px-3 py-2 text-xs font-mono text-neutral-900 focus:outline-none focus:border-[#ff6f42] focus:bg-white transition-colors"
          />
        </div>

        {/* Font Family & Weight */}
        <div className="space-y-3 pt-2 border-t border-[#e8e4dc]">
          {/* Searchable Font Family Picker */}
          <div className="space-y-1.5" ref={fontPickerRef}>
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-neutral-700">Font Family</label>
              <span className="text-[10px] text-neutral-400 font-medium">{filteredFonts.length} fonts</span>
            </div>

            {/* Font Picker Trigger Button */}
            <button
              type="button"
              onClick={() => setIsFontPickerOpen((prev) => !prev)}
              className={`w-full bg-[#fbf9f5] border rounded-lg px-3 py-2 text-xs flex items-center justify-between transition-all text-left ${
                isFontPickerOpen
                  ? 'border-[#ff6f42] ring-2 ring-[#ff6f42]/15 bg-white'
                  : 'border-[#e8e4dc] hover:border-[#ff6f42]/40 hover:bg-white'
              }`}
            >
              <span
                className="text-xs font-semibold text-neutral-900 truncate"
                style={{ fontFamily: layer.fontFamily }}
              >
                {layer.fontFamily}
              </span>
              <ChevronDown
                className={`w-3.5 h-3.5 text-neutral-400 shrink-0 transition-transform duration-150 ${
                  isFontPickerOpen ? 'rotate-180 text-[#ff6f42]' : ''
                }`}
              />
            </button>

            {/* Searchable Dropdown Popover */}
            {isFontPickerOpen && (
              <div className="mt-1.5 border border-[#e8e4dc] rounded-xl bg-white shadow-xl overflow-hidden animate-in fade-in-50 duration-150">
                {/* Search Bar */}
                <div className="p-2 border-b border-[#e8e4dc] bg-[#fbf9f5] space-y-1.5">
                  <div className="relative flex items-center">
                    <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 pointer-events-none" />
                    <input
                      type="text"
                      value={fontSearch}
                      onChange={(e) => setFontSearch(e.target.value)}
                      placeholder="Search fonts (e.g. Roboto, Inter, Arial)..."
                      className="w-full bg-white border border-[#e8e4dc] rounded-lg pl-8 pr-7 py-1.5 text-xs text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-[#ff6f42]"
                      autoFocus
                    />
                    {fontSearch && (
                      <button
                        type="button"
                        onClick={() => setFontSearch('')}
                        className="absolute right-2 p-0.5 text-neutral-400 hover:text-neutral-600 rounded-full"
                        title="Clear search"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  {/* Category Pills */}
                  <div className="flex items-center gap-1 overflow-x-auto pb-0.5 text-[10px] no-scrollbar">
                    {[
                      { id: 'all', label: 'All' },
                      { id: 'popular', label: 'Popular' },
                      { id: 'default', label: 'Standard' },
                      { id: 'mono', label: 'Monospace' },
                      { id: 'serif', label: 'Serif' },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setFontCategory(tab.id as any)}
                        className={`px-2 py-0.5 rounded-full whitespace-nowrap transition-colors font-medium ${
                          fontCategory === tab.id
                            ? 'bg-[#ff6f42] text-white shadow-2xs font-semibold'
                            : 'bg-[#ede9df] text-neutral-700 hover:bg-[#e2ddd1]'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Font Items List */}
                <div className="max-h-56 overflow-y-auto divide-y divide-[#e8e4dc]/60 overscroll-contain">
                  {filteredFonts.length === 0 ? (
                    <div className="p-4 text-center">
                      <p className="text-xs text-neutral-500">No matching fonts found</p>
                      <button
                        type="button"
                        onClick={() => {
                          setFontSearch('');
                          setFontCategory('all');
                        }}
                        className="mt-1 text-[11px] text-[#ff6f42] hover:underline font-semibold"
                      >
                        Reset filters
                      </button>
                    </div>
                  ) : (
                    filteredFonts.map((font) => {
                      const isSelected = layer.fontFamily.toLowerCase() === font.name.toLowerCase();
                      return (
                        <button
                          key={font.name}
                          type="button"
                          onClick={() => {
                            onChange({ fontFamily: font.name });
                            setIsFontPickerOpen(false);
                          }}
                          className={`w-full text-left px-3 py-2 flex items-center justify-between hover:bg-[#ffefe8]/40 transition-colors ${
                            isSelected ? 'bg-[#ffefe8]/70 text-[#ff6f42]' : ''
                          }`}
                        >
                          <div className="min-w-0 flex-1 pr-2">
                            <div className="flex items-center justify-between">
                              <span
                                className={`text-xs font-semibold truncate ${isSelected ? 'text-[#ff6f42]' : 'text-neutral-900'}`}
                                style={{ fontFamily: font.name }}
                              >
                                {font.name}
                              </span>
                              {isSelected && <Check className="w-3.5 h-3.5 text-[#ff6f42] shrink-0 ml-2" />}
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span
                                className="text-[10px] text-neutral-400 truncate"
                                style={{ fontFamily: font.name }}
                              >
                                {font.category === 'mono'
                                  ? '0123456789 • ABCDEF'
                                  : 'The quick brown fox jumps'}
                              </span>
                            </div>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Weight */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-700">Weight</label>
              <div className="relative">
                <select
                  value={String(layer.fontWeight)}
                  onChange={(e) => onChange({ fontWeight: e.target.value })}
                  className="w-full bg-[#fbf9f5] border border-[#e8e4dc] rounded-lg px-3 py-1.5 text-xs text-neutral-900 appearance-none focus:outline-none focus:border-[#ff6f42] focus:bg-white cursor-pointer"
                >
                  {FONT_WEIGHTS.map((w) => (
                    <option key={w.value} value={w.value}>
                      {w.label} ({w.value})
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-neutral-400 absolute right-3 top-2.5 pointer-events-none" />
              </div>
            </div>

            {/* Style (Italic) */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-700">Style</label>
              <button
                onClick={() =>
                  onChange({ fontStyle: layer.fontStyle === 'italic' ? 'normal' : 'italic' })
                }
                className={`w-full py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 border transition-all ${
                  layer.fontStyle === 'italic'
                    ? 'bg-[#ff6f42] border-[#ff6f42] text-white shadow-xs'
                    : 'bg-[#fbf9f5] border-[#e8e4dc] text-neutral-700 hover:bg-[#ffefe8] hover:text-[#ff6f42]'
                }`}
              >
                <Italic className="w-3.5 h-3.5" />
                Italic
              </button>
            </div>
          </div>
        </div>

        {/* Font Size & Alignment */}
        <div className="space-y-3 pt-2 border-t border-[#e8e4dc]">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-neutral-700">Font Size</label>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onChange({ fontSize: Math.max(6, Math.round(layer.fontSize - 1)) })}
                className="w-6 h-6 rounded bg-[#ede9df] hover:bg-[#e2ddd1] text-neutral-800 flex items-center justify-center transition-colors shadow-2xs active:scale-95"
                title="Decrease font size (-1px)"
              >
                <Minus className="w-3 h-3" />
              </button>
              <div className="relative flex items-center">
                <input
                  type="number"
                  min="6"
                  max="250"
                  value={Math.round(layer.fontSize)}
                  onChange={(e) => onChange({ fontSize: Math.max(6, Number(e.target.value) || 6) })}
                  className="w-14 px-1 py-0.5 text-center font-mono text-xs font-semibold bg-[#fbf9f5] border border-[#e8e4dc] rounded text-neutral-900 focus:outline-none focus:border-[#ff6f42]"
                />
                <span className="text-[10px] text-neutral-400 font-mono absolute right-1 pointer-events-none">px</span>
              </div>
              <button
                type="button"
                onClick={() => onChange({ fontSize: Math.min(250, Math.round(layer.fontSize + 1)) })}
                className="w-6 h-6 rounded bg-[#ede9df] hover:bg-[#e2ddd1] text-neutral-800 flex items-center justify-center transition-colors shadow-2xs active:scale-95"
                title="Increase font size (+1px)"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Quick preset size buttons */}
          <div className="flex items-center gap-1 overflow-x-auto pb-0.5 no-scrollbar">
            {[12, 14, 16, 18, 24, 32, 48, 64].map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => onChange({ fontSize: size })}
                className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors font-medium ${
                  Math.round(layer.fontSize) === size
                    ? 'bg-[#ff6f42] text-white font-semibold shadow-2xs'
                    : 'bg-[#ede9df] text-neutral-700 hover:bg-[#e2ddd1] hover:text-neutral-950'
                }`}
              >
                {size}
              </button>
            ))}
          </div>

          <input
            type="range"
            min="8"
            max="180"
            value={layer.fontSize}
            onChange={(e) => onChange({ fontSize: Number(e.target.value) })}
            className="w-full accent-[#ff6f42] cursor-pointer h-1.5 bg-[#e8e4dc] rounded-lg"
          />

          {/* Text Alignment */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-700">Text Align</label>
            <div className="grid grid-cols-4 gap-1 bg-[#ede9df] p-1 border border-[#e8e4dc] rounded-lg">
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
                    className={`p-1.5 flex justify-center rounded-md transition-all ${
                      layer.textAlign === align
                        ? 'bg-white text-[#ff6f42] shadow-xs'
                        : 'text-neutral-600 hover:text-neutral-900 hover:bg-white/60'
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
        <div className="space-y-3 pt-2 border-t border-[#e8e4dc]">
          <h3 className="text-xs font-semibold tracking-wider uppercase text-neutral-500 flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-[#ff6f42]" />
            Appearance
          </h3>

          <div className="grid grid-cols-2 gap-3">
            {/* Fill Color */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-700">Text Color</label>
              <div className="flex items-center gap-2 bg-[#fbf9f5] border border-[#e8e4dc] rounded-lg p-1.5">
                <input
                  type="color"
                  value={layer.fill.startsWith('#') ? layer.fill : '#0a0a0a'}
                  onChange={(e) => onChange({ fill: e.target.value })}
                  className="w-6 h-6 rounded border border-[#e8e4dc] cursor-pointer bg-transparent"
                />
                <input
                  type="text"
                  value={layer.fill}
                  onChange={(e) => onChange({ fill: e.target.value })}
                  className="w-full bg-transparent text-xs font-mono text-neutral-900 focus:outline-none"
                />
              </div>
            </div>

            {/* Opacity */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <label className="font-semibold text-neutral-700">Opacity</label>
                <span className="font-mono text-neutral-800 font-medium">{Math.round(layer.opacity * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.05"
                max="1"
                step="0.05"
                value={layer.opacity}
                onChange={(e) => onChange({ opacity: Number(e.target.value) })}
                className="w-full accent-[#ff6f42] cursor-pointer h-1.5 bg-[#e8e4dc] rounded-lg mt-3"
              />
            </div>

            {/* Edge Softness / Natural Blur */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <label className="font-semibold text-neutral-700">Edge Softness</label>
                <span className="font-mono text-neutral-800 font-medium">{(layer.blur ?? 0.6).toFixed(1)}px</span>
              </div>
              <input
                type="range"
                min="0"
                max="2.5"
                step="0.1"
                value={layer.blur ?? 0.6}
                onChange={(e) => onChange({ blur: Number(e.target.value) })}
                className="w-full accent-[#ff6f42] cursor-pointer h-1.5 bg-[#e8e4dc] rounded-lg mt-3"
              />
            </div>
          </div>

          {/* Stroke */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs">
              <label className="font-semibold text-neutral-700">Stroke Outline</label>
              <span className="font-mono text-neutral-800 font-medium">{layer.strokeWidth || 0} px</span>
            </div>
            <div className="grid grid-cols-3 gap-2 items-center">
              <div className="flex items-center gap-1.5 bg-[#fbf9f5] border border-[#e8e4dc] rounded-lg p-1">
                <input
                  type="color"
                  value={layer.stroke || '#000000'}
                  onChange={(e) => onChange({ stroke: e.target.value })}
                  className="w-5 h-5 rounded border border-[#e8e4dc] cursor-pointer bg-transparent"
                />
                <span className="text-[10px] font-mono text-neutral-500">Color</span>
              </div>
              <div className="col-span-2">
                <input
                  type="range"
                  min="0"
                  max="20"
                  value={layer.strokeWidth || 0}
                  onChange={(e) => onChange({ strokeWidth: Number(e.target.value) })}
                  className="w-full accent-[#ff6f42] cursor-pointer h-1.5 bg-[#e8e4dc] rounded-lg"
                />
              </div>
            </div>
          </div>

          {/* Spacing & Line Height */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold text-neutral-700">Tracking</label>
                <span className="text-[10px] font-mono text-neutral-800 font-bold">{layer.letterSpacing || 0}px</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onChange({ letterSpacing: Math.round(((layer.letterSpacing || 0) - 0.5) * 10) / 10 })}
                  className="w-6 h-6 rounded bg-[#ede9df] hover:bg-[#e2ddd1] text-neutral-800 flex items-center justify-center shrink-0 active:scale-95 transition-colors"
                  title="Decrease tracking (-0.5px)"
                >
                  <Minus className="w-2.5 h-2.5" />
                </button>
                <input
                  type="number"
                  step="0.5"
                  min="-10"
                  max="50"
                  value={layer.letterSpacing || 0}
                  onChange={(e) => onChange({ letterSpacing: Number(e.target.value) })}
                  className="w-full bg-[#fbf9f5] border border-[#e8e4dc] rounded px-1 py-0.5 text-xs font-mono text-center text-neutral-900 focus:outline-none focus:border-[#ff6f42]"
                />
                <button
                  type="button"
                  onClick={() => onChange({ letterSpacing: Math.round(((layer.letterSpacing || 0) + 0.5) * 10) / 10 })}
                  className="w-6 h-6 rounded bg-[#ede9df] hover:bg-[#e2ddd1] text-neutral-800 flex items-center justify-center shrink-0 active:scale-95 transition-colors"
                  title="Increase tracking (+0.5px)"
                >
                  <Plus className="w-2.5 h-2.5" />
                </button>
              </div>
              <input
                type="range"
                min="-5"
                max="30"
                step="0.5"
                value={layer.letterSpacing || 0}
                onChange={(e) => onChange({ letterSpacing: Number(e.target.value) })}
                className="w-full accent-[#ff6f42] cursor-pointer h-1.5 bg-[#e8e4dc] rounded-lg"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold text-neutral-700">Line Height</label>
                <span className="text-[10px] font-mono text-neutral-800 font-bold">{layer.lineHeight || 1.2}</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onChange({ lineHeight: Math.max(0.5, Math.round(((layer.lineHeight || 1.2) - 0.1) * 10) / 10) })}
                  className="w-6 h-6 rounded bg-[#ede9df] hover:bg-[#e2ddd1] text-neutral-800 flex items-center justify-center shrink-0 active:scale-95 transition-colors"
                  title="Decrease line height (-0.1)"
                >
                  <Minus className="w-2.5 h-2.5" />
                </button>
                <input
                  type="number"
                  step="0.1"
                  min="0.5"
                  max="3.0"
                  value={layer.lineHeight || 1.2}
                  onChange={(e) => onChange({ lineHeight: Number(e.target.value) })}
                  className="w-full bg-[#fbf9f5] border border-[#e8e4dc] rounded px-1 py-0.5 text-xs font-mono text-center text-neutral-900 focus:outline-none focus:border-[#ff6f42]"
                />
                <button
                  type="button"
                  onClick={() => onChange({ lineHeight: Math.min(3.0, Math.round(((layer.lineHeight || 1.2) + 0.1) * 10) / 10) })}
                  className="w-6 h-6 rounded bg-[#ede9df] hover:bg-[#e2ddd1] text-neutral-800 flex items-center justify-center shrink-0 active:scale-95 transition-colors"
                  title="Increase line height (+0.1)"
                >
                  <Plus className="w-2.5 h-2.5" />
                </button>
              </div>
              <input
                type="range"
                min="0.8"
                max="2.5"
                step="0.05"
                value={layer.lineHeight || 1.2}
                onChange={(e) => onChange({ lineHeight: Number(e.target.value) })}
                className="w-full accent-[#ff6f42] cursor-pointer h-1.5 bg-[#e8e4dc] rounded-lg"
              />
            </div>
          </div>
        </div>

        {/* Shadow */}
        <div className="space-y-3 pt-2 border-t border-[#e8e4dc]">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-neutral-700">Drop Shadow</label>
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
              className="accent-[#ff6f42] rounded cursor-pointer"
            />
          </div>

          {layer.shadow && layer.shadow.blur > 0 && (
            <div className="space-y-2 bg-[#fbf9f5] p-2.5 rounded-lg border border-[#e8e4dc]">
              <div className="flex justify-between items-center text-xs">
                <span className="text-neutral-600 font-medium">Blur</span>
                <span className="font-mono text-neutral-800 font-bold">{layer.shadow.blur}px</span>
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
                className="w-full accent-[#ff6f42] cursor-pointer h-1.5 bg-[#e8e4dc] rounded-lg"
              />
            </div>
          )}
        </div>

        {/* Layer Depth Ordering */}
        <div className="space-y-2 pt-2 border-t border-[#e8e4dc]">
          <label className="text-xs font-semibold text-neutral-700 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-[#ff6f42]" />
            Layer Stacking
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => onBringForward(layer.id)}
              className="py-1.5 px-3 text-xs bg-white hover:bg-[#ffefe8] hover:text-[#ff6f42] border border-[#e8e4dc] rounded-lg text-neutral-800 transition-colors font-semibold shadow-2xs"
            >
              Bring Forward
            </button>
            <button
              onClick={() => onSendBackward(layer.id)}
              className="py-1.5 px-3 text-xs bg-white hover:bg-[#ffefe8] hover:text-[#ff6f42] border border-[#e8e4dc] rounded-lg text-neutral-800 transition-colors font-semibold shadow-2xs"
            >
              Send Backward
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};
