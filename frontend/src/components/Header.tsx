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
  onLoadSample?: () => void;
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
  onHome?: () => void;
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
  onHome,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onImageSelected(e.target.files[0]);
    }
  };

  return (
    <header className="h-14 sm:h-16 bg-[#f7f5f0]/95 backdrop-blur-xl border-b border-[#e8e4dc] px-2 sm:px-4 md:px-6 flex items-center justify-between z-20 shrink-0 select-none gap-2 shadow-xs w-full max-w-full overflow-hidden text-neutral-900">
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Left: Retypo Brand */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <div
          onClick={onHome}
          className={`flex items-center gap-2 sm:gap-2.5 shrink-0 ${onHome ? 'cursor-pointer hover:opacity-85 transition-opacity' : ''}`}
        >
          <img
            src="/Retypo Logo with Orange Accents.png"
            alt="Retypo"
            className="h-7 sm:h-8 w-auto object-contain"
          />
          <span className="hidden md:inline-flex px-2 py-0.5 rounded-full bg-[#ffefe8] text-[#ff6f42] border border-[#ff6f42]/20 text-[9px] font-mono uppercase tracking-wider font-bold leading-none">
            Studio
          </span>
        </div>
      </div>

      {/* Center: Desktop Undo/Redo & Zoom & Compare (lg+ only) */}
      {hasImage && (
        <div className="hidden lg:flex items-center gap-2">
          {/* History Segmented Capsule */}
          <div className="flex items-center bg-white rounded-full p-1 border border-[#e8e4dc] shadow-2xs">
            <button
              onClick={onUndo}
              disabled={!canUndo}
              className={`w-7 h-7 flex items-center justify-center rounded-full transition-all ${
                canUndo ? 'text-neutral-700 hover:text-[#ff6f42] hover:bg-[#ffefe8]' : 'text-neutral-300 cursor-not-allowed'
              }`}
              title="Undo (Ctrl/Cmd + Z)"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onRedo}
              disabled={!canRedo}
              className={`w-7 h-7 flex items-center justify-center rounded-full transition-all ${
                canRedo ? 'text-neutral-700 hover:text-[#ff6f42] hover:bg-[#ffefe8]' : 'text-neutral-300 cursor-not-allowed'
              }`}
              title="Redo (Ctrl/Cmd + Shift + Z)"
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="h-4 w-px bg-[#e8e4dc]" />

          {/* Zoom Segmented Capsule */}
          <div className="flex items-center bg-white rounded-full p-1 border border-[#e8e4dc] shadow-2xs">
            <button
              onClick={onZoomOut}
              className="w-7 h-7 flex items-center justify-center text-neutral-600 hover:text-[#ff6f42] hover:bg-[#ffefe8] rounded-full transition-colors"
              title="Zoom out (-)"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onZoomReset}
              className="px-2 text-xs font-mono font-semibold text-neutral-800 hover:text-[#ff6f42] transition-colors"
              title="Click to reset zoom to 100%"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              onClick={onZoomIn}
              className="w-7 h-7 flex items-center justify-center text-neutral-600 hover:text-[#ff6f42] hover:bg-[#ffefe8] rounded-full transition-colors"
              title="Zoom in (+)"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <div className="h-3.5 w-px bg-[#e8e4dc] my-auto mx-0.5" />
            <button
              onClick={onZoomFit}
              className="w-7 h-7 flex items-center justify-center text-neutral-600 hover:text-[#ff6f42] hover:bg-[#ffefe8] rounded-full transition-colors"
              title="Fit to view"
            >
              <Maximize2 className="w-3 h-3" />
            </button>
          </div>

          <div className="h-4 w-px bg-[#e8e4dc]" />

          {/* Compare Controls Capsule */}
          <div className="flex items-center bg-white rounded-full p-1 border border-[#e8e4dc] gap-1 shadow-2xs">
            <button
              onClick={onToggleCompare}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full transition-all ${
                isComparing
                  ? 'bg-[#ffefe8] text-[#ff6f42] border border-[#ff6f42]/30 shadow-xs'
                  : 'text-neutral-700 hover:text-[#ff6f42] hover:bg-[#ffefe8]/60'
              }`}
              title="Compare against original unedited image"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>{isComparing ? 'Showing Original' : 'Original'}</span>
            </button>

            <button
              onClick={() => onChangeCompareMode(compareMode === 'split' ? 'toggle' : 'split')}
              className={`w-7 h-7 flex items-center justify-center rounded-full transition-colors ${
                compareMode === 'split'
                  ? 'bg-[#ff6f42] text-white shadow-xs'
                  : 'text-neutral-600 hover:text-[#ff6f42] hover:bg-[#ffefe8]/60'
              }`}
              title={`Switch compare mode (${compareMode === 'split' ? 'Split View' : 'Toggle'})`}
            >
              <SplitSquareVertical className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Right: Actions */}
      <div className="flex items-center gap-1 sm:gap-2 shrink-0">
        {!hasImage ? (
          /* Initial Screen: Prominent Upload Image button */
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-full bg-[#ff6f42] hover:bg-[#ee6037] text-white shadow-md shadow-[#ff6f42]/20 transition-all active:scale-95"
            title="Upload image (PNG, JPG, WebP)"
          >
            <Upload className="w-3.5 h-3.5 text-white" />
            <span className="whitespace-nowrap">Upload Image</span>
          </button>
        ) : (
          /* Editor Active Screen: Compact responsive controls */
          <>
            {/* Upload / Replace Button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-8 h-8 sm:w-auto sm:px-3 sm:py-1.5 flex items-center justify-center gap-1.5 text-xs font-semibold rounded-full bg-white hover:bg-[#ffefe8] text-neutral-800 hover:text-[#ff6f42] border border-[#e8e4dc] shadow-2xs transition-all active:scale-95 shrink-0"
              title="Upload another image"
            >
              <Upload className="w-3.5 h-3.5 text-neutral-600" />
              <span className="hidden md:inline whitespace-nowrap">Upload</span>
            </button>

            {/* OCR Detect Button */}
            <button
              onClick={onRunOCR}
              disabled={isDetecting}
              className={`w-8 h-8 sm:w-auto sm:px-3 sm:py-1.5 flex items-center justify-center gap-1.5 text-xs font-semibold rounded-full border transition-all shrink-0 shadow-2xs ${
                isDetecting
                  ? 'bg-[#f7f5f0] text-neutral-400 border-[#e8e4dc] cursor-not-allowed pointer-events-none'
                  : 'bg-white text-neutral-800 border-[#e8e4dc] hover:bg-[#ffefe8] hover:border-[#ff6f42]/30 hover:text-[#ff6f42] active:scale-95'
              }`}
              title={isDetecting ? 'Detection in progress...' : 'Detect text regions'}
            >
              {isDetecting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#ff6f42]" />
                  <span className="hidden md:inline">Detecting...</span>
                </>
              ) : (
                <>
                  <ScanText className="w-3.5 h-3.5 text-[#ff6f42]" />
                  <span className="hidden md:inline">Detect Text</span>
                </>
              )}
            </button>

            {/* OCR Overlay Eye Button */}
            {detectedCount > 0 && (
              <button
                onClick={onToggleDetectionOverlay}
                className={`w-8 h-8 flex items-center justify-center text-xs rounded-full border transition-all shrink-0 shadow-2xs ${
                  showDetectionOverlay
                    ? 'bg-[#ff6f42] text-white border-[#ff6f42] shadow-xs'
                    : 'bg-white text-neutral-600 border-[#e8e4dc] hover:text-[#ff6f42] hover:bg-[#ffefe8]'
                }`}
                title={showDetectionOverlay ? 'Hide detected text boxes' : 'Show detected text boxes'}
              >
                <Eye className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Mobile-only Undo & Redo Capsule (< lg) */}
            <div className="flex lg:hidden items-center bg-white rounded-full p-0.5 border border-[#e8e4dc] shrink-0 shadow-2xs">
              <button
                onClick={onUndo}
                disabled={!canUndo}
                className={`w-7 h-7 flex items-center justify-center rounded-full transition-colors ${
                  canUndo ? 'text-neutral-700 hover:text-[#ff6f42] hover:bg-[#ffefe8] active:scale-90' : 'text-neutral-300 cursor-not-allowed'
                }`}
                title="Undo (Ctrl/Cmd + Z)"
              >
                <Undo2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={onRedo}
                disabled={!canRedo}
                className={`w-7 h-7 flex items-center justify-center rounded-full transition-colors ${
                  canRedo ? 'text-neutral-700 hover:text-[#ff6f42] hover:bg-[#ffefe8] active:scale-90' : 'text-neutral-300 cursor-not-allowed'
                }`}
                title="Redo (Ctrl/Cmd + Shift + Z)"
              >
                <Redo2 className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* High-Contrast Export Button matching Landing Page Orange */}
            <button
              onClick={onOpenExport}
              className="flex items-center justify-center gap-1.5 px-3.5 sm:px-4 py-1.5 text-xs font-semibold rounded-full bg-[#ff6f42] text-white hover:bg-[#ee6037] shadow-md shadow-[#ff6f42]/20 transition-all active:scale-95 shrink-0"
              title="Export image at full native resolution"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export Image</span>
              <span className="sm:hidden">Export</span>
            </button>
          </>
        )}
      </div>
    </header>
  );
};
