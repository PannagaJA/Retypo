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
    <aside className="w-full lg:w-72 bg-white border-r-0 lg:border-r border-slate-200 flex flex-col h-full select-none text-slate-800">
      {/* Modern Segmented Navigation Tabs */}
      <div className="p-2 border-b border-slate-200 bg-slate-50/70">
        <div className="flex items-center bg-slate-200/60 p-1 rounded-full border border-slate-200">
          <button
            onClick={() => setActiveTab('layers')}
            className={`flex-1 py-1.5 px-3 text-xs font-semibold rounded-full flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'layers'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Layers</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
              activeTab === 'layers' ? 'bg-slate-100 text-slate-900' : 'bg-slate-300 text-slate-700'
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
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <ScanText className="w-3.5 h-3.5" />
            <span>Detected</span>
            {unconvertedCount > 0 && (
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                activeTab === 'detected' ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-700'
              }`}>
                {unconvertedCount}
              </span>
            )}
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="lg:hidden w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors ml-1"
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
          <div className="p-3 border-b border-slate-200 flex items-center justify-between">
            <span className="text-xs text-slate-500 font-semibold tracking-wide uppercase text-[10px]">
              Canvas Elements
            </span>
            <button
              onClick={onAddText}
              disabled={!image}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full transition-all ${
                image
                  ? 'bg-slate-900 hover:bg-slate-800 text-white shadow-xs active:scale-95'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
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
                      ? 'bg-slate-50 border-2 border-slate-900 text-slate-900 shadow-xs'
                      : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700 shadow-2xs'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-2">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                      isSelected ? 'bg-slate-900 text-white shadow-xs' : 'bg-slate-100 text-slate-700'
                    }`}>
                      <Type className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-slate-900 leading-tight">
                        {layer.text || '(Empty Text)'}
                      </p>
                      <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                        {layer.fontFamily} • {Math.round(layer.fontSize)}px
                      </p>
                    </div>
                    {layer.origin === 'ocr_detected' && (
                      <span className="shrink-0 text-[8px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 font-mono font-semibold">
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
                        !layer.isVisible ? 'text-red-500 bg-red-50' : 'text-slate-400 hover:text-slate-800 hover:bg-slate-100'
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
                        layer.isLocked ? 'text-amber-600 bg-amber-50' : 'text-slate-400 hover:text-slate-800 hover:bg-slate-100'
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
                      className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
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
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 px-1 py-1 flex items-center gap-1">
                  <Eraser className="w-3 h-3 text-slate-500" />
                  Restored Background Patches ({patches.length})
                </div>
                {patches.map((patch, idx) => (
                  <div
                    key={patch.id}
                    className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 mt-1"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2 h-2 rounded-full bg-slate-400 shrink-0" />
                      <span className="truncate text-xs font-medium">Patch #{idx + 1}</span>
                      <span className="text-[9px] px-1 py-0.5 rounded bg-slate-200 text-slate-700 uppercase font-mono">
                        {patch.strategy}
                      </span>
                    </div>

                    <button
                      onClick={() => onDeletePatch(patch.id)}
                      className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
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
              <div className="flex items-center justify-between px-2.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 mt-2">
                <div className="flex items-center gap-2 min-w-0">
                  <ImageIcon className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <div className="truncate flex flex-col">
                    <span className="truncate text-slate-800 font-medium">{image.fileName}</span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {image.width} × {image.height} px
                    </span>
                  </div>
                </div>
                <span title="Base image layer is locked">
                  <Lock className="w-3 h-3 text-slate-400 shrink-0" />
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
              <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center mb-3 border border-slate-200">
                <ScanText className="w-5 h-5" />
              </div>
              <h3 className="text-xs font-medium text-slate-800">No Detected Text Yet</h3>
              <p className="text-[11px] text-slate-500 mt-1 max-w-[200px]">
                Scan your image to automatically detect and transcribe all visible text.
              </p>
              {image && (
                <button
                  onClick={onRunOCR}
                  disabled={isDetecting}
                  className={`mt-4 px-3 py-1.5 text-xs font-semibold rounded-full shadow-xs transition-all ${
                    isDetecting
                      ? 'bg-slate-300 text-slate-500 cursor-not-allowed pointer-events-none'
                      : 'bg-slate-900 hover:bg-slate-800 text-white active:scale-95'
                  }`}
                >
                  {isDetecting ? 'Analyzing...' : 'Detect Text Now'}
                </button>
              )}
            </div>
          ) : (
            <div className="p-3 space-y-2">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <span className="text-xs text-slate-500">
                  {unconvertedCount} pending adoption
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={onInpaintAllDetected}
                    disabled={isInpaintingAll}
                    className="flex items-center gap-1 text-[11px] font-medium text-slate-600 hover:text-slate-900 transition-colors"
                    title="Inpaint background for all detected regions"
                  >
                    {isInpaintingAll ? (
                      <Loader2 className="w-3 h-3 animate-spin text-slate-600" />
                    ) : (
                      <Eraser className="w-3 h-3" />
                    )}
                    Erase All
                  </button>

                  {unconvertedCount > 0 && (
                    <button
                      onClick={onConvertAllRegions}
                      className="flex items-center gap-1 text-[11px] font-semibold text-slate-900 hover:text-slate-700 transition-colors"
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
                        ? 'bg-slate-50 border-slate-900 ring-2 ring-slate-900/10 shadow-md scale-[1.01]'
                        : region.isConverted
                        ? 'bg-slate-50/70 border-slate-200 opacity-60'
                        : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
                    }`}
                  >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 font-medium">
                        {Math.round(region.confidence * 100)}% match
                      </span>
                      {onDismissDetectedRegion && !region.isConverted && (
                        <button
                          onClick={() => onDismissDetectedRegion(region.regionId)}
                          className="p-0.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Dismiss this region"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span
                        className="w-3 h-3 rounded-full border border-slate-300 shadow-2xs"
                        style={{ backgroundColor: region.estimatedColor }}
                        title={`Estimated color: ${region.estimatedColor}`}
                      />
                      <span className="text-[10px] font-mono text-slate-500">
                        {Math.round(region.estimatedFontSize)}px
                      </span>
                    </div>
                  </div>

                  {/* Editable Transcription Input */}
                  <input
                    type="text"
                    value={region.text}
                    onChange={(e) => onUpdateDetectedText(region.regionId, e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-900 focus:outline-none focus:border-slate-900 focus:bg-white font-sans transition-colors"
                    title="Edit transcription text if needed"
                  />

                  <div className="flex justify-end">
                    {region.isConverted ? (
                      <span className="text-[10px] text-slate-400 font-medium italic">
                        Layer Active
                      </span>
                    ) : (
                      <button
                        onClick={() => onConvertRegion(region)}
                        className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-full bg-slate-900 hover:bg-slate-800 text-white shadow-xs transition-colors"
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
