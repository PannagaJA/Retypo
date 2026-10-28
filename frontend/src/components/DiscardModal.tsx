import React, { useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';

export interface DiscardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
}

export const DiscardModal: React.FC<DiscardModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Discard changes & refresh?',
  message = 'You have unsaved changes in your editor. If you refresh, all your text edits, inpainting, and modifications will be discarded.',
  confirmText = 'Discard & Refresh',
  cancelText = 'Keep Editing',
}) => {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="discard-modal-title"
      className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150 select-none"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl border border-[#e8e4dc] max-w-md w-full p-6 animate-in zoom-in-95 duration-150 relative text-neutral-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button anchored to top right */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 w-8 h-8 rounded-full flex items-center justify-center text-neutral-400 hover:text-neutral-700 hover:bg-[#ede9df] transition-colors cursor-pointer"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Content with aligned icon and text */}
        <div className="flex items-start gap-3.5 pr-8">
          <div className="w-10 h-10 rounded-2xl bg-[#ffefe8] border border-[#ff6f42]/20 flex items-center justify-center shrink-0 text-[#ff6f42] shadow-2xs mt-0.5">
            <AlertTriangle className="w-5 h-5 stroke-[2.2]" />
          </div>

          <div className="flex-1 min-w-0">
            <h3
              id="discard-modal-title"
              className="text-base sm:text-lg font-bold text-neutral-950 tracking-tight leading-snug"
            >
              {title}
            </h3>
            <p className="mt-2 text-xs sm:text-sm text-neutral-600 leading-relaxed font-normal">
              {message}
            </p>
          </div>
        </div>

        {/* Footer actions */}
        <div className="mt-6 pt-4 border-t border-[#e8e4dc] flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs sm:text-sm font-semibold text-neutral-800 bg-[#ede9df] hover:bg-[#e2ddd1] rounded-full transition-all active:scale-95 cursor-pointer"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-5 py-2 text-xs sm:text-sm font-semibold text-white bg-[#ff6f42] hover:bg-[#ee6037] rounded-full shadow-md shadow-[#ff6f42]/20 transition-all active:scale-95 cursor-pointer"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
