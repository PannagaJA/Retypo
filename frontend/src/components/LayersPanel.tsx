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
  Sparkles,
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
  // Inpaint all
  onInpaintAllDetected: () => Promise<void>;
  isInpaintingAll: boolean;
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
  onInpaintAllDetected,
  isInpaintingAll,
}) => {
  const [activeTab, setActiveTab] = useState<'layers' | 'detected'>('layers');

  // Auto-switch to detected tab when OCR finds regions
  useEffect(() => {
    if (detectedRegions.length > 0) {
      setActiveTab('detected');
    }
  }, [detectedRegions.length]);

  const unconvertedCount = detectedRegions.filter((r) => !r.isConverted).length;

  return (
    <aside className="w-72 bg-[#12151e] border-r border-[#212636] flex flex-col h-full select-none text-gray-200">
      {/* Navigation Tabs */}
      <div className="flex border-b border-[#212636] bg-[#0e1017]">
        <button
          onClick={() => setActiveTab('layers')}
          className={`flex-1 py-2.5 px-3 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors border-b-2 ${
            activeTab === 'layers'
              ? 'border-blue-500 text-white bg-[#141722]'
              : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-[#12141c]'
          }`}
        >
          <Layers className="w-3.5 h-3.5 text-blue-400" />
          Layers
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#1e2333] font-mono text-gray-300">
            {layers.length + patches.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('detected')}
          className={`flex-1 py-2.5 px-3 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors border-b-2 ${
            activeTab === 'detected'
              ? 'border-emerald-500 text-white bg-[#141722]'
              : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-[#12141c]'
          }`}
        >
          <ScanText className="w-3.5 h-3.5 text-emerald-400" />
          Detected OCR
          {unconvertedCount > 0 && (
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 font-mono">
              {unconvertedCount}
            </span>
          )}
        </button>
      </div>

      {/* Tab 1: Standard Layers Tree */}
      {activeTab === 'layers' && (
        <>
          <div className="p-3 border-b border-[#212636] flex items-center justify-between">
            <span className="text-xs text-gray-400 font-medium">Canvas Elements</span>
            <button
              onClick={onAddText}
              disabled={!image}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                image
                  ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-sm'
                  : 'bg-gray-800 text-gray-500 cursor-not-allowed'
              }`}
              title="Add new editable text layer"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Text
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {/* Render text layers in reverse order (top of stack first) */}
            {[...layers].reverse().map((layer) => {
              const isSelected = selectedLayerId === layer.id;

              return (
                <div
                  key={layer.id}
                  onClick={() => onSelectLayer(layer.id)}
                  className={`group flex items-center justify-between px-2.5 py-2 rounded-md border text-xs cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-blue-600/15 border-blue-500/50 text-white shadow-sm'
                      : 'bg-[#181d2a]/60 border-[#212636] hover:bg-[#1f2536] text-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
                    <Type className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-blue-400' : 'text-gray-400'}`} />
                    <span className="truncate font-medium">{layer.text || '(Empty Text)'}</span>
                    {layer.origin === 'ocr_detected' && (
                      <span className="shrink-0 text-[9px] px-1 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                        OCR
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleVisibility(layer.id);
                      }}
                      className={`p-1 rounded hover:bg-[#283046] transition-colors ${
                        !layer.isVisible ? 'text-red-400' : 'text-gray-400 group-hover:text-gray-200'
                      }`}
                      title={layer.isVisible ? 'Hide layer' : 'Show layer'}
                    >
                      {layer.isVisible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleLock(layer.id);
                      }}
                      className={`p-1 rounded hover:bg-[#283046] transition-colors ${
                        layer.isLocked ? 'text-amber-400' : 'text-gray-400 group-hover:text-gray-200'
                      }`}
                      title={layer.isLocked ? 'Unlock layer' : 'Lock layer'}
                    >
                      {layer.isLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteLayer(layer.id);
                      }}
                      className="p-1 rounded text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      title="Delete layer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Inpaint Patches Section */}
            {patches.length > 0 && (
              <div className="pt-2">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-purple-400/80 px-1 py-1 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-purple-400" />
                  Inpainted Background Patches ({patches.length})
                </div>
                {patches.map((patch, idx) => (
                  <div
                    key={patch.id}
                    className="flex items-center justify-between px-2.5 py-1.5 rounded-md bg-[#161a26] border border-[#273044] text-xs text-gray-300 mt-1"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2 h-2 rounded-full bg-purple-400 shrink-0" />
                      <span className="truncate text-xs font-medium">Patch #{idx + 1}</span>
                      <span className="text-[9px] px-1 py-0.5 rounded bg-purple-500/20 text-purple-300 uppercase font-mono">
                        {patch.strategy}
                      </span>
                    </div>

                    <button
                      onClick={() => onDeletePatch(patch.id)}
                      className="p-1 rounded text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      title="Remove inpaint patch"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Base Image Layer */}
            {image && (
              <div className="flex items-center justify-between px-2.5 py-2 rounded-md bg-[#131620] border border-[#212636] text-xs text-gray-400 mt-2">
                <div className="flex items-center gap-2 min-w-0">
                  <ImageIcon className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <div className="truncate flex flex-col">
                    <span className="truncate text-gray-300 font-medium">{image.fileName}</span>
                    <span className="text-[10px] text-gray-500 font-mono">
                      {image.width} × {image.height} px
                    </span>
                  </div>
                </div>
                <span title="Base image layer is locked">
                  <Lock className="w-3 h-3 text-gray-500 shrink-0" />
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
              <div className="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-3 border border-emerald-500/20">
                <ScanText className="w-5 h-5" />
              </div>
              <h3 className="text-xs font-medium text-gray-300">No Detected Text Yet</h3>
              <p className="text-[11px] text-gray-500 mt-1 max-w-[200px]">
                Run OCR on your image to automatically detect and transcribe all visible text.
              </p>
              {image && (
                <button
                  onClick={onRunOCR}
                  disabled={isDetecting}
                  className="mt-4 px-3 py-1.5 text-xs font-semibold rounded-md bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-all"
                >
                  {isDetecting ? 'Analyzing...' : 'Detect Text Now'}
                </button>
              )}
            </div>
          ) : (
            <div className="p-3 space-y-2">
              <div className="flex items-center justify-between pb-2 border-b border-[#212636]">
                <span className="text-xs text-gray-400">
                  {unconvertedCount} pending adoption
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={onInpaintAllDetected}
                    disabled={isInpaintingAll}
                    className="flex items-center gap-1 text-[11px] font-medium text-purple-400 hover:text-purple-300 transition-colors"
                    title="Inpaint background for all detected regions"
                  >
                    {isInpaintingAll ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Eraser className="w-3 h-3" />
                    )}
                    Erase All
                  </button>

                  {unconvertedCount > 0 && (
                    <button
                      onClick={onConvertAllRegions}
                      className="flex items-center gap-1 text-[11px] font-medium text-emerald-400 hover:text-emerald-300 transition-colors"
                      title="Convert all detected blocks to editable text layers"
                    >
                      <CheckCheck className="w-3.5 h-3.5" />
                      Convert All
                    </button>
                  )}
                </div>
              </div>

              {detectedRegions.map((region) => (
                <div
                  key={region.regionId}
                  className={`p-2.5 rounded-lg border text-xs space-y-2 transition-all ${
                    region.isConverted
                      ? 'bg-[#151822]/40 border-[#1f2433] opacity-60'
                      : 'bg-[#181d2a] border-[#252c3e] hover:border-emerald-500/40 shadow-sm'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        {Math.round(region.confidence * 100)}% match
                      </span>
                      {onDismissDetectedRegion && !region.isConverted && (
                        <button
                          onClick={() => onDismissDetectedRegion(region.regionId)}
                          className="p-0.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                          title="Dismiss this region"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span
                        className="w-3 h-3 rounded-full border border-white/20"
                        style={{ backgroundColor: region.estimatedColor }}
                        title={`Estimated color: ${region.estimatedColor}`}
                      />
                      <span className="text-[10px] font-mono text-gray-400">
                        {Math.round(region.estimatedFontSize)}px
                      </span>
                    </div>
                  </div>

                  {/* Editable Transcription Input */}
                  <input
                    type="text"
                    value={region.text}
                    onChange={(e) => onUpdateDetectedText(region.regionId, e.target.value)}
                    className="w-full bg-[#12151e] border border-[#273044] rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-emerald-500 font-sans"
                    title="Edit transcription text if needed"
                  />

                  <div className="flex justify-end">
                    {region.isConverted ? (
                      <span className="text-[10px] text-gray-500 font-medium italic">
                        Layer Active
                      </span>
                    ) : (
                      <button
                        onClick={() => onConvertRegion(region)}
                        className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 transition-colors"
                      >
                        <span>Edit on Canvas</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </aside>
  );
};
