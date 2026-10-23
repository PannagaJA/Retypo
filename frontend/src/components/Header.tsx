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
    <header className="h-14 sm:h-16 bg-white/95 backdrop-blur-xl border-b border-slate-200 px-3 sm:px-5 flex items-center justify-between z-20 shrink-0 select-none gap-2 overflow-x-auto no-scrollbar shadow-xs">
      {/* Brand & Upload */}
      <div className="flex items-center gap-2.5 sm:gap-3.5 shrink-0">
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-8 h-8 rounded-xl bg-slate-900 flex items-center justify-center shadow-xs shrink-0">
            <span className="font-bold text-sm text-white font-mono">T</span>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-sm sm:text-base tracking-tight text-slate-900 leading-none">
                Starlight
              </span>
              <span className="hidden md:inline-flex items-center px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 text-[9px] font-mono uppercase tracking-wider font-semibold">
                Canvas
              </span>
            </div>
            <span className="text-[10px] text-slate-500 hidden sm:block leading-tight font-medium">
              Image Typography Studio
            </span>
          </div>
        </div>

        <div className="hidden sm:block h-6 w-px bg-slate-200 mx-1" />

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
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full bg-slate-100 hover:bg-slate-200/80 text-slate-800 border border-slate-200 transition-all shadow-xs shrink-0 active:scale-95"
          title="Upload image (PNG, JPG, WebP)"
        >
          <Upload className="w-3.5 h-3.5 text-slate-600" />
          <span className="hidden sm:inline">Upload Image</span>
          <span className="sm:hidden">Upload</span>
        </button>

        {!hasImage && (
          <button
            onClick={onLoadSample}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 transition-all shrink-0 active:scale-95"
            title="Load sample typography poster"
          >
            <ImageIcon className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">Try Sample</span>
            <span className="sm:hidden">Sample</span>
          </button>
        )}

        {/* OCR Analyze Button */}
        {hasImage && (
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="flex items-center bg-slate-100 border border-slate-200 rounded-full p-0.5 shadow-xs">
              <button
                onClick={onRunOCR}
                disabled={isDetecting}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full transition-all ${
                  isDetecting
                    ? 'bg-slate-200 text-slate-500 cursor-wait'
                    : 'bg-white text-slate-800 hover:bg-slate-50 shadow-xs'
                }`}
                title="Detect text regions"
              >
                {isDetecting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-600" />
                    <span className="hidden sm:inline">Detecting...</span>
                  </>
                ) : (
                  <>
                    <ScanText className="w-3.5 h-3.5 text-slate-700" />
                    <span className="hidden sm:inline">Detect Text</span>
                    <span className="sm:hidden">Detect</span>
                  </>
                )}
              </button>

              {onChangeOcrLang && (
                <select
                  value={ocrLang}
                  onChange={(e) => onChangeOcrLang(e.target.value)}
                  className="bg-transparent text-slate-700 hover:text-slate-900 px-2 py-1 text-[11px] font-mono cursor-pointer focus:outline-none rounded-r-full"
                  title="OCR Language Model"
                >
                  <option value="en">EN</option>
                  <option value="ka">KA</option>
                  <option value="hi">HI</option>
                </select>
              )}
            </div>

            {detectedCount > 0 && (
              <button
                onClick={onToggleDetectionOverlay}
                className={`w-7 h-7 flex items-center justify-center text-xs rounded-full border transition-all ${
                  showDetectionOverlay
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-500 border-slate-200 hover:text-slate-900'
                }`}
                title={showDetectionOverlay ? 'Hide detected text boxes' : 'Show detected text boxes'}
              >
                <Eye className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Center Toolset: Desktop Undo/Redo & Zoom & Compare */}
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

      {/* Right Actions: Mobile Undo/Redo & High-Contrast Dark Export */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Mobile Undo & Redo Capsule */}
        {hasImage && (
          <div className="flex lg:hidden items-center bg-slate-100 rounded-full p-1 border border-slate-200 shrink-0 shadow-xs">
            <button
              onClick={onUndo}
              disabled={!canUndo}
              className={`w-7 h-7 flex items-center justify-center rounded-full transition-colors ${
                canUndo ? 'text-slate-700 hover:text-slate-900 hover:bg-white' : 'text-slate-300 cursor-not-allowed'
              }`}
              title="Undo"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onRedo}
              disabled={!canRedo}
              className={`w-7 h-7 flex items-center justify-center rounded-full transition-colors ${
                canRedo ? 'text-slate-700 hover:text-slate-900 hover:bg-white' : 'text-slate-300 cursor-not-allowed'
              }`}
              title="Redo"
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {hasImage && (
          <button
            onClick={onOpenExport}
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-full bg-slate-900 text-white hover:bg-slate-800 shadow-sm transition-all active:scale-95 shrink-0"
            title="Export image at full native resolution"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export Image</span>
            <span className="sm:hidden">Export</span>
          </button>
        )}
      </div>
    </header>
  );
};
