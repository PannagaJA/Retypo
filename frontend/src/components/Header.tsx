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
    <header className="h-14 sm:h-16 bg-white/95 backdrop-blur-xl border-b border-slate-200 px-2 sm:px-4 md:px-6 flex items-center justify-between z-20 shrink-0 select-none gap-2 shadow-xs w-full max-w-full overflow-hidden">
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Left: Retypo Brand & Back to Home */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {onHome && (
          <button
            onClick={onHome}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 transition-colors text-xs font-semibold"
            title="Return to Landing Page"
          >
            ← Home
          </button>
        )}
        <div
          onClick={onHome}
          className={`flex items-center gap-1.5 sm:gap-2.5 shrink-0 ${onHome ? 'cursor-pointer hover:opacity-85 transition-opacity' : ''}`}
        >
          <div className="w-7.5 h-7.5 sm:w-9 sm:h-9 rounded-xl bg-slate-900 flex items-center justify-center shadow-xs shrink-0 ring-1 ring-slate-900/10 overflow-hidden">
            <svg viewBox="0 0 48 48" className="w-4.5 h-4.5 sm:w-5.5 sm:h-5.5" fill="none">
              <path d="M14 12C14 10.8954 14.8954 10 16 10H26C31.5228 10 36 14.4772 36 20C36 24.3427 33.2274 28.0378 29.3512 29.3879L36.4142 36.4509C37.1953 37.232 36.6409 38.5714 35.5355 38.5714H30.5C29.7044 38.5714 28.9413 38.2554 28.3787 37.6928L22 31.3142V37C22 37.5523 21.5523 38 21 38H15C14.4477 38 14 37.5523 14 37V12Z" fill="white"/>
              <path d="M22 17H25C26.6569 17 28 18.3431 28 20C28 21.6569 26.6569 23 25 23H22V17Z" fill="#0f172a"/>
              <circle cx="34" cy="14" r="2.5" fill="#38bdf8"/>
            </svg>
          </div>
          <div className="flex flex-col justify-center">
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-sm sm:text-base tracking-tight text-slate-900 leading-none">
                Retypo
              </span>
              <span className="hidden md:inline-flex px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 text-[9px] font-mono uppercase tracking-wider font-semibold leading-none">
                Studio
              </span>
            </div>
            <span className="text-[10px] text-slate-400 hidden lg:block leading-tight font-medium mt-0.5">
              AI Image Text Editor
            </span>
          </div>
        </div>
      </div>

      {/* Center: Desktop Undo/Redo & Zoom & Compare (lg+ only) */}
      {hasImage && (
        <div className="hidden lg:flex items-center gap-2">
          {/* History Segmented Capsule */}
          <div className="flex items-center bg-slate-100 rounded-full p-1 border border-slate-200 shadow-xs">
            <button
              onClick={onUndo}
              disabled={!canUndo}
              className={`w-7 h-7 flex items-center justify-center rounded-full transition-all ${
                canUndo ? 'text-slate-700 hover:text-slate-900 hover:bg-white' : 'text-slate-300 cursor-not-allowed'
              }`}
              title="Undo (Ctrl/Cmd + Z)"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onRedo}
              disabled={!canRedo}
              className={`w-7 h-7 flex items-center justify-center rounded-full transition-all ${
                canRedo ? 'text-slate-700 hover:text-slate-900 hover:bg-white' : 'text-slate-300 cursor-not-allowed'
              }`}
              title="Redo (Ctrl/Cmd + Shift + Z)"
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="h-4 w-px bg-slate-200" />

          {/* Zoom Segmented Capsule */}
          <div className="flex items-center bg-slate-100 rounded-full p-1 border border-slate-200 shadow-xs">
            <button
              onClick={onZoomOut}
              className="w-7 h-7 flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-white rounded-full transition-colors"
              title="Zoom out (-)"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onZoomReset}
              className="px-2 text-xs font-mono font-semibold text-slate-800 hover:text-slate-900 transition-colors"
              title="Click to reset zoom to 100%"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              onClick={onZoomIn}
              className="w-7 h-7 flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-white rounded-full transition-colors"
              title="Zoom in (+)"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <div className="h-3.5 w-px bg-slate-200 my-auto mx-0.5" />
            <button
              onClick={onZoomFit}
              className="w-7 h-7 flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-white rounded-full transition-colors"
              title="Fit to view"
            >
              <Maximize2 className="w-3 h-3" />
            </button>
          </div>

          <div className="h-4 w-px bg-slate-200" />

          {/* Compare Controls Capsule */}
          <div className="flex items-center bg-slate-100 rounded-full p-1 border border-slate-200 gap-1 shadow-xs">
            <button
              onClick={onToggleCompare}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-full transition-all ${
                isComparing
                  ? 'bg-amber-100 text-amber-900 border border-amber-300 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white'
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
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-white'
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
            className="flex items-center gap-1.5 px-3.5 sm:px-4 py-1.5 text-xs font-semibold rounded-full bg-slate-900 hover:bg-slate-800 text-white shadow-sm transition-all active:scale-95"
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
              className="w-8 h-8 sm:w-auto sm:px-2.5 sm:py-1.5 flex items-center justify-center gap-1.5 text-xs font-semibold rounded-full bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 shadow-xs transition-all active:scale-95 shrink-0"
              title="Upload another image"
            >
              <Upload className="w-3.5 h-3.5 text-slate-600" />
              <span className="hidden md:inline whitespace-nowrap">Upload</span>
            </button>

            {/* OCR Detect Button */}
            <button
              onClick={onRunOCR}
              disabled={isDetecting}
              className={`w-8 h-8 sm:w-auto sm:px-2.5 sm:py-1.5 flex items-center justify-center gap-1.5 text-xs font-semibold rounded-full border transition-all shrink-0 shadow-xs ${
                isDetecting
                  ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed pointer-events-none'
                  : 'bg-white text-slate-800 border-slate-200 hover:bg-slate-50 active:scale-95'
              }`}
              title={isDetecting ? 'Detection in progress...' : 'Detect text regions'}
            >
              {isDetecting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-500" />
                  <span className="hidden md:inline">Detecting...</span>
                </>
              ) : (
                <>
                  <ScanText className="w-3.5 h-3.5 text-slate-700" />
                  <span className="hidden md:inline">Detect Text</span>
                </>
              )}
            </button>

            {/* OCR Overlay Eye Button */}
            {detectedCount > 0 && (
              <button
                onClick={onToggleDetectionOverlay}
                className={`w-8 h-8 flex items-center justify-center text-xs rounded-full border transition-all shrink-0 shadow-xs ${
                  showDetectionOverlay
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-500 border-slate-200 hover:text-slate-900'
                }`}
                title={showDetectionOverlay ? 'Hide detected text boxes' : 'Show detected text boxes'}
              >
                <Eye className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Mobile-only Undo & Redo Capsule (< lg) */}
            <div className="flex lg:hidden items-center bg-slate-100 rounded-full p-0.5 border border-slate-200 shrink-0 shadow-xs">
              <button
                onClick={onUndo}
                disabled={!canUndo}
                className={`w-7 h-7 flex items-center justify-center rounded-full transition-colors ${
                  canUndo ? 'text-slate-700 hover:text-slate-900 hover:bg-white active:scale-90' : 'text-slate-300 cursor-not-allowed'
                }`}
                title="Undo (Ctrl/Cmd + Z)"
              >
                <Undo2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={onRedo}
                disabled={!canRedo}
                className={`w-7 h-7 flex items-center justify-center rounded-full transition-colors ${
                  canRedo ? 'text-slate-700 hover:text-slate-900 hover:bg-white active:scale-90' : 'text-slate-300 cursor-not-allowed'
                }`}
                title="Redo (Ctrl/Cmd + Shift + Z)"
              >
                <Redo2 className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* High-Contrast Export Button */}
            <button
              onClick={onOpenExport}
              className="flex items-center justify-center gap-1 px-2.5 sm:px-3.5 py-1.5 text-xs font-semibold rounded-full bg-slate-900 text-white hover:bg-slate-800 shadow-sm transition-all active:scale-95 shrink-0"
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
