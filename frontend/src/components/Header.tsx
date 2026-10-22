import React, { useRef } from 'react';
import {
  Upload,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Download,
  SplitSquareVertical,
  Eye,
  Sparkles,
  Image as ImageIcon,
  ScanText,
  Loader2
} from 'lucide-react';

interface HeaderProps {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomFit: () => void;
  onZoomReset: () => void;
  onImageSelected: (file: File) => void;
  onLoadSample: () => void;
  isComparing: boolean;
  onToggleCompare: () => void;
  compareMode: 'toggle' | 'split';
  onChangeCompareMode: (mode: 'toggle' | 'split') => void;
  onOpenExport: () => void;
  hasImage: boolean;
  // OCR props
  isDetecting: boolean;
  onRunOCR: () => void;
  showDetectionOverlay: boolean;
  onToggleDetectionOverlay: () => void;
  detectedCount: number;
  ocrLang?: string;
  onChangeOcrLang?: (lang: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  zoom,
  onZoomIn,
  onZoomOut,
  onZoomFit,
  onZoomReset,
  onImageSelected,
  onLoadSample,
  isComparing,
  onToggleCompare,
  compareMode,
  onChangeCompareMode,
  onOpenExport,
  hasImage,
  isDetecting,
  onRunOCR,
  showDetectionOverlay,
  onToggleDetectionOverlay,
  detectedCount,
  ocrLang = 'en',
  onChangeOcrLang,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onImageSelected(e.target.files[0]);
    }
  };

  return (
    <header className="h-14 bg-[#12151e] border-b border-[#212636] px-4 flex items-center justify-between z-20 shrink-0 select-none">
      {/* Brand & Upload */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-base tracking-tight text-white flex items-center gap-1.5">
            PhoText <span className="text-xs px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono">STUDIO</span>
          </span>
        </div>

        <div className="h-5 w-px bg-[#262c3d] mx-1" />

        {/* Upload Controls */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={handleFileChange}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md bg-[#1c2232] hover:bg-[#252c40] text-gray-200 border border-[#2e374d] transition-colors shadow-sm"
          title="Upload new image (PNG, JPG, WebP)"
        >
          <Upload className="w-3.5 h-3.5 text-blue-400" />
          Upload Image
        </button>

        {!hasImage && (
          <button
            onClick={onLoadSample}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 border border-blue-500/30 transition-colors"
            title="Load sample typography poster for instant testing"
          >
            <ImageIcon className="w-3.5 h-3.5" />
            Try Sample
          </button>
        )}

        {/* OCR Analyze Button */}
        {hasImage && (
          <div className="flex items-center gap-1.5">
            <div className="flex items-center bg-[#141926] border border-[#27364f] rounded-md p-0.5">
              <button
                onClick={onRunOCR}
                disabled={isDetecting}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded transition-all shadow-sm ${
                  isDetecting
                    ? 'bg-blue-600/30 text-blue-300 border border-blue-500/40 cursor-wait'
                    : 'bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300'
                }`}
                title="Run PaddleOCR to detect and extract all text regions"
              >
                {isDetecting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
                    Detecting...
                  </>
                ) : (
                  <>
                    <ScanText className="w-3.5 h-3.5 text-emerald-400" />
                    Detect Text
                  </>
                )}
              </button>

              {onChangeOcrLang && (
                <select
                  value={ocrLang}
                  onChange={(e) => onChangeOcrLang(e.target.value)}
                  className="bg-[#181d2a] border-l border-[#27364f] text-gray-300 hover:text-white px-2 py-1 text-[11px] font-mono cursor-pointer focus:outline-none"
                  title="OCR Language Model"
                >
                  <option value="en">EN</option>
                  <option value="ka">ಕನ್ನಡ (KA)</option>
                  <option value="hi">हिन्दी (HI)</option>
                </select>
              )}
            </div>

            {detectedCount > 0 && (
              <button
                onClick={onToggleDetectionOverlay}
                className={`p-1.5 text-xs rounded border transition-colors ${
                  showDetectionOverlay
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-[#181d2a] text-gray-400 border-[#252c3e] hover:text-white'
                }`}
                title={showDetectionOverlay ? 'Hide detected OCR boxes' : 'Show detected OCR boxes'}
              >
                <Eye className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Center Toolset: Undo/Redo & Zoom & Compare */}
      {hasImage && (
        <div className="flex items-center gap-2">
          {/* History */}
          <div className="flex items-center bg-[#181d2a] rounded-md p-0.5 border border-[#252c3e]">
            <button
              onClick={onUndo}
              disabled={!canUndo}
              className={`p-1.5 rounded transition-colors ${
                canUndo ? 'text-gray-300 hover:text-white hover:bg-[#262d40]' : 'text-gray-600 cursor-not-allowed'
              }`}
              title="Undo (Ctrl/Cmd + Z)"
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button
              onClick={onRedo}
              disabled={!canRedo}
              className={`p-1.5 rounded transition-colors ${
                canRedo ? 'text-gray-300 hover:text-white hover:bg-[#262d40]' : 'text-gray-600 cursor-not-allowed'
              }`}
              title="Redo (Ctrl/Cmd + Shift + Z)"
            >
              <Redo2 className="w-4 h-4" />
            </button>
          </div>

          <div className="h-4 w-px bg-[#262c3d]" />

          {/* Zoom */}
          <div className="flex items-center bg-[#181d2a] rounded-md p-0.5 border border-[#252c3e]">
            <button
              onClick={onZoomOut}
              className="p-1.5 text-gray-300 hover:text-white hover:bg-[#262d40] rounded transition-colors"
              title="Zoom out (-)"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={onZoomReset}
              className="px-2 text-xs font-mono font-medium text-gray-300 hover:text-white transition-colors"
              title="Click to reset zoom to 100%"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              onClick={onZoomIn}
              className="p-1.5 text-gray-300 hover:text-white hover:bg-[#262d40] rounded transition-colors"
              title="Zoom in (+)"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <div className="h-3 w-px bg-[#262c3d] my-auto mx-0.5" />
            <button
              onClick={onZoomFit}
              className="p-1.5 text-gray-300 hover:text-white hover:bg-[#262d40] rounded transition-colors"
              title="Fit to view"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="h-4 w-px bg-[#262c3d]" />

          {/* Compare Controls */}
          <div className="flex items-center bg-[#181d2a] rounded-md p-0.5 border border-[#252c3e] gap-1">
            <button
              onClick={onToggleCompare}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded transition-all ${
                isComparing
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                  : 'text-gray-300 hover:text-white hover:bg-[#262d40]'
              }`}
              title="Compare against original unedited image"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>{isComparing ? 'Showing Original' : 'Original'}</span>
            </button>

            <button
              onClick={() => onChangeCompareMode(compareMode === 'split' ? 'toggle' : 'split')}
              className={`p-1.5 rounded transition-colors ${
                compareMode === 'split'
                  ? 'bg-blue-600/30 text-blue-300 border border-blue-500/40'
                  : 'text-gray-400 hover:text-white hover:bg-[#262d40]'
              }`}
              title={`Switch compare mode (Currently: ${compareMode === 'split' ? 'Split View' : 'Toggle'})`}
            >
              <SplitSquareVertical className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Right Actions */}
      <div className="flex items-center gap-3">
        {hasImage && (
          <button
            onClick={onOpenExport}
            className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-md bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-md shadow-blue-500/20 transition-all active:scale-95"
            title="Export non-destructive composited image at full native resolution"
          >
            <Download className="w-4 h-4" />
            Export High-Res
          </button>
        )}
      </div>
    </header>
  );
};
