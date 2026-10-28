import React, { useState, useEffect } from 'react';
import type { TextLayer, InpaintPatch, ImageMetadata, DetectedTextRegion } from '../types';
import {
  Layers,
  Plus,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Trash2,
  Image as ImageIcon,
  Type,
  ScanText,
  ArrowRight,
  CheckCheck,
  Eraser,
  Loader2,
  X
} from 'lucide-react';

interface LayersPanelProps {
  image: ImageMetadata | null;
  patches: InpaintPatch[];
  layers: TextLayer[];
  selectedLayerId: string | null;
  onSelectLayer: (id: string | null) => void;
  onAddText: () => void;
  onToggleVisibility: (id: string) => void;
  onToggleLock: (id: string) => void;
  onDeleteLayer: (id: string) => void;
  onDeletePatch: (id: string) => void;
  // OCR props
  detectedRegions: DetectedTextRegion[];
  onConvertRegion: (region: DetectedTextRegion) => void;
  onConvertAllRegions: () => void;
  onUpdateDetectedText: (regionId: string, newText: string) => void;
  onDismissDetectedRegion?: (regionId: string) => void;
  onRunOCR: () => void;
  isDetecting: boolean;
  onShowDetectionOverlay?: () => void;
  hoveredRegionId?: string | null;
  onHoverRegion?: (regionId: string | null) => void;
  // Inpaint all
  onInpaintAllDetected: () => Promise<void>;
  isInpaintingAll: boolean;
  onClose?: () => void;
}

export const LayersPanel: React.FC<LayersPanelProps> = ({
  image,
  patches,
  layers,
  selectedLayerId,
  onSelectLayer,
  onAddText,
  onToggleVisibility,
  onToggleLock,
  onDeleteLayer,
  onDeletePatch,
  detectedRegions,
  onConvertRegion,
  onConvertAllRegions,
  onUpdateDetectedText,
  onDismissDetectedRegion,
  onRunOCR,
  isDetecting,
  onShowDetectionOverlay,
  hoveredRegionId,
  onHoverRegion,
  onInpaintAllDetected,
  isInpaintingAll,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'layers' | 'detected'>('layers');
  const itemRefs = React.useRef<Map<string, HTMLDivElement>>(new Map());

  // Automatically scroll pending adoption card into view when hovered on canvas
  useEffect(() => {
    if (hoveredRegionId) {
      setActiveTab('detected');
      const timer = setTimeout(() => {
        const el = itemRefs.current.get(hoveredRegionId);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [hoveredRegionId]);

  // Auto-switch to detected tab when OCR finds regions
  useEffect(() => {
    if (detectedRegions.length > 0) {
      setActiveTab('detected');
    }
  }, [detectedRegions.length]);

  const unconvertedCount = detectedRegions.filter((r) => !r.isConverted).length;

  return (
    <aside className="w-full lg:w-72 bg-[#fdfbf9] border-r-0 lg:border-r border-[#e8e4dc] flex flex-col h-full select-none text-neutral-800">
      {/* Modern Segmented Navigation Tabs */}
      <div className="p-2 border-b border-[#e8e4dc] bg-[#f7f5f0]">
        <div className="flex items-center bg-[#ede9df] p-1 rounded-full border border-[#e8e4dc]">
          <button
            onClick={() => setActiveTab('layers')}
            className={`flex-1 py-1.5 px-3 text-xs font-semibold rounded-full flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'layers'
                ? 'bg-white text-neutral-900 shadow-2xs'
                : 'text-neutral-600 hover:text-neutral-900 hover:bg-white/60'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Layers</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
              activeTab === 'layers' ? 'bg-[#ffefe8] text-[#ff6f42]' : 'bg-[#e2ddd1] text-neutral-700'
            }`}>
              {layers.length + patches.length}
            </span>
          </button>

          <button
            onClick={() => {
              setActiveTab('detected');
              onShowDetectionOverlay?.();
            }}
            className={`flex-1 py-1.5 px-3 text-xs font-semibold rounded-full flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'detected'
                ? 'bg-white text-neutral-900 shadow-2xs'
                : 'text-neutral-600 hover:text-neutral-900 hover:bg-white/60'
            }`}
          >
            <ScanText className="w-3.5 h-3.5" />
            <span>Detected</span>
            {unconvertedCount > 0 && (
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                activeTab === 'detected' ? 'bg-[#ff6f42] text-white shadow-2xs' : 'bg-[#e2ddd1] text-neutral-700'
              }`}>
                {unconvertedCount}
              </span>
            )}
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="lg:hidden w-7 h-7 rounded-full flex items-center justify-center text-neutral-400 hover:text-neutral-700 hover:bg-white/80 transition-colors ml-1"
              title="Close"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Tab 1: Standard Layers Tree */}
      {activeTab === 'layers' && (
        <>
          <div className="p-3 border-b border-[#e8e4dc] bg-[#fbf9f5] flex items-center justify-between">
            <span className="text-neutral-500 font-semibold tracking-wide uppercase text-[10px]">
              Canvas Elements
            </span>
            <button
              onClick={onAddText}
              disabled={!image}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full transition-all ${
                image
                  ? 'bg-[#ff6f42] hover:bg-[#ee6037] text-white shadow-xs active:scale-95'
                  : 'bg-[#ede9df] text-neutral-400 cursor-not-allowed'
              }`}
              title="Add new text layer"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Text
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5">
            {/* Render text layers in reverse order (top of stack first) */}
            {[...layers].reverse().map((layer) => {
              const isSelected = selectedLayerId === layer.id;

              return (
                <div
                  key={layer.id}
                  onClick={() => onSelectLayer(layer.id)}
                  className={`group flex items-center justify-between p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-[#fffbf8] border-2 border-[#ff6f42] text-neutral-900 shadow-xs ring-1 ring-[#ff6f42]/10'
                      : 'bg-white border-[#e8e4dc] hover:border-[#ff6f42]/40 text-neutral-700 shadow-2xs'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-2">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                      isSelected ? 'bg-[#ff6f42] text-white shadow-xs' : 'bg-[#ffefe8] text-[#ff6f42]'
                    }`}>
                      <Type className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-neutral-900 leading-tight">
                        {layer.text || '(Empty Text)'}
                      </p>
                      <p className="text-[10px] text-neutral-500 font-mono mt-0.5">
                        {layer.fontFamily} • {Math.round(layer.fontSize)}px
                      </p>
                    </div>
                    {layer.origin === 'ocr_detected' && (
                      <span className="shrink-0 text-[8px] px-1.5 py-0.5 rounded-full bg-[#ffefe8] text-[#ff6f42] border border-[#ff6f42]/20 font-mono font-semibold">
                        Detected
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleVisibility(layer.id);
                      }}
                      className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
                        !layer.isVisible ? 'text-rose-500 bg-rose-50' : 'text-neutral-400 hover:text-neutral-800 hover:bg-[#ffefe8]'
                      }`}
                      title={layer.isVisible ? 'Hide layer' : 'Show layer'}
                    >
                      {layer.isVisible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleLock(layer.id);
                      }}
                      className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
                        layer.isLocked ? 'text-amber-600 bg-amber-50' : 'text-neutral-400 hover:text-neutral-800 hover:bg-[#ffefe8]'
                      }`}
                      title={layer.isLocked ? 'Unlock layer' : 'Lock layer'}
                    >
                      {layer.isLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteLayer(layer.id);
                      }}
                      className="w-7 h-7 rounded-full flex items-center justify-center text-neutral-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      title="Delete layer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Inpaint Patches Section */}
            {patches.length > 0 && (
              <div className="pt-2">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 px-1 py-1 flex items-center gap-1">
                  <Eraser className="w-3 h-3 text-[#ff6f42]" />
                  Restored Background Patches ({patches.length})
                </div>
                {patches.map((patch, idx) => (
                  <div
                    key={patch.id}
                    className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-[#fbf9f5] border border-[#e8e4dc] text-xs text-neutral-700 mt-1"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2 h-2 rounded-full bg-[#ff6f42] shrink-0" />
                      <span className="truncate text-xs font-medium">Patch #{idx + 1}</span>
                      <span className="text-[9px] px-1 py-0.5 rounded bg-[#ede9df] text-neutral-700 uppercase font-mono">
                        {patch.strategy}
                      </span>
                    </div>

                    <button
                      onClick={() => onDeletePatch(patch.id)}
                      className="p-1 rounded text-neutral-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      title="Remove patch"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Base Image Layer */}
            {image && (
              <div className="flex items-center justify-between px-2.5 py-2 rounded-xl bg-[#fbf9f5] border border-[#e8e4dc] text-xs text-neutral-600 mt-2">
                <div className="flex items-center gap-2 min-w-0">
                  <ImageIcon className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                  <div className="truncate flex flex-col">
                    <span className="truncate text-neutral-800 font-medium">{image.fileName}</span>
                    <span className="text-[10px] text-neutral-500 font-mono">
                      {image.width} × {image.height} px
                    </span>
                  </div>
                </div>
                <span title="Base image layer is locked">
                  <Lock className="w-3 h-3 text-neutral-400 shrink-0" />
                </span>
              </div>
            )}
          </div>
        </>
      )}

      {/* Tab 2: Detected OCR Text Regions */}
      {activeTab === 'detected' && (
        <div className="flex-1 overflow-y-auto flex flex-col">
          {detectedRegions.length === 0 ? (
            <div className="p-6 text-center my-auto flex flex-col items-center">
              <div className="w-10 h-10 rounded-full bg-[#ffefe8] text-[#ff6f42] flex items-center justify-center mb-3 border border-[#ff6f42]/20">
                <ScanText className="w-5 h-5" />
              </div>
              <h3 className="text-xs font-medium text-neutral-800">No Detected Text Yet</h3>
              <p className="text-[11px] text-neutral-500 mt-1 max-w-[200px]">
                Scan your image to automatically detect and transcribe all visible text.
              </p>
              {image && (
                <button
                  onClick={onRunOCR}
                  disabled={isDetecting}
                  className={`mt-4 px-4 py-1.5 text-xs font-semibold rounded-full shadow-xs transition-all ${
                    isDetecting
                      ? 'bg-[#ede9df] text-neutral-400 cursor-not-allowed pointer-events-none'
                      : 'bg-[#ff6f42] hover:bg-[#ee6037] text-white active:scale-95 shadow-md shadow-[#ff6f42]/20'
                  }`}
                >
                  {isDetecting ? 'Analyzing...' : 'Detect Text Now'}
                </button>
              )}
            </div>
          ) : (
            <div className="p-3 space-y-2">
              <div className="flex items-center justify-between pb-2 border-b border-[#e8e4dc]">
                <span className="text-xs text-neutral-500 font-medium">
                  {unconvertedCount} pending adoption
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={onInpaintAllDetected}
                    disabled={isInpaintingAll}
                    className="flex items-center gap-1 text-[11px] font-medium text-neutral-600 hover:text-[#ff6f42] transition-colors"
                    title="Inpaint background for all detected regions"
                  >
                    {isInpaintingAll ? (
                      <Loader2 className="w-3 h-3 animate-spin text-[#ff6f42]" />
                    ) : (
                      <Eraser className="w-3 h-3" />
                    )}
                    Erase All
                  </button>

                  {unconvertedCount > 0 && (
                    <button
                      onClick={onConvertAllRegions}
                      className="flex items-center gap-1 text-[11px] font-semibold text-[#ff6f42] hover:text-[#ee6037] transition-colors"
                      title="Convert all detected blocks to editable text layers"
                    >
                      <CheckCheck className="w-3.5 h-3.5" />
                      Convert All
                    </button>
                  )}
                </div>
              </div>

              {detectedRegions.map((region) => {
                const isHovered = region.regionId === hoveredRegionId;
                return (
                  <div
                    key={region.regionId}
                    ref={(el) => {
                      if (el) itemRefs.current.set(region.regionId, el);
                      else itemRefs.current.delete(region.regionId);
                    }}
                    onMouseEnter={() => onHoverRegion?.(region.regionId)}
                    onMouseLeave={() => onHoverRegion?.(null)}
                    className={`p-2.5 rounded-xl border text-xs space-y-2 transition-all ${
                      isHovered
                        ? 'bg-[#fffbf8] border-[#ff6f42] ring-2 ring-[#ff6f42]/20 shadow-md scale-[1.01]'
                        : region.isConverted
                        ? 'bg-[#fbf9f5] border-[#e8e4dc] opacity-60'
                        : 'bg-white border-[#e8e4dc] hover:border-[#ff6f42]/40 shadow-2xs'
                    }`}
                  >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-[#ffefe8] text-[#ff6f42] border border-[#ff6f42]/20 font-medium">
                        {Math.round(region.confidence * 100)}% match
                      </span>
                      {onDismissDetectedRegion && !region.isConverted && (
                        <button
                          onClick={() => onDismissDetectedRegion(region.regionId)}
                          className="p-0.5 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                          title="Dismiss this region"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span
                        className="w-3 h-3 rounded-full border border-[#e8e4dc] shadow-2xs"
                        style={{ backgroundColor: region.estimatedColor }}
                        title={`Estimated color: ${region.estimatedColor}`}
                      />
                      <span className="text-[10px] font-mono text-neutral-500">
                        {Math.round(region.estimatedFontSize)}px
                      </span>
                    </div>
                  </div>

                  {/* Editable Transcription Input */}
                  <input
                    type="text"
                    value={region.text}
                    onChange={(e) => onUpdateDetectedText(region.regionId, e.target.value)}
                    className="w-full bg-[#fbf9f5] border border-[#e8e4dc] rounded-lg px-2 py-1 text-xs text-neutral-900 focus:outline-none focus:border-[#ff6f42] focus:bg-white font-sans transition-colors"
                    title="Edit transcription text if needed"
                  />

                  <div className="flex justify-end">
                    {region.isConverted ? (
                      <span className="text-[10px] text-neutral-400 font-medium italic">
                        Layer Active
                      </span>
                    ) : (
                      <button
                        onClick={() => onConvertRegion(region)}
                        className="flex items-center gap-1.5 px-3 py-1 text-[11px] font-semibold rounded-full bg-[#ff6f42] hover:bg-[#ee6037] text-white shadow-xs transition-colors"
                      >
                        <span>Edit on Canvas</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </aside>
  );
};
