import React, { useEffect } from 'react';
import { AlertTriangle, X, RefreshCw } from 'lucide-react';

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
      className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl border border-[#e8e4dc] max-w-md w-full overflow-hidden p-6 animate-in zoom-in-95 duration-150 relative text-neutral-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[#ffefe8] border border-[#ff6f42]/30 flex items-center justify-center shrink-0 text-[#ff6f42] shadow-xs">
            <AlertTriangle className="w-6 h-6 stroke-[2.2]" />
          </div>

          <div className="flex-1 min-w-0 pt-0.5">
            <div className="flex items-center justify-between gap-2">
              <h3
                id="discard-modal-title"
                className="text-base sm:text-lg font-bold text-neutral-950 tracking-tight"
              >
                {title}
              </h3>
              <button
                type="button"
                onClick={onClose}
                className="text-neutral-400 hover:text-neutral-700 hover:bg-[#ffefe8] rounded-full p-1 transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="mt-2 text-xs sm:text-sm text-neutral-600 leading-relaxed font-normal">
              {message}
            </p>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2.5 sm:gap-3 pt-3 border-t border-[#e8e4dc]">
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
            className="inline-flex items-center gap-1.5 px-5 py-2 text-xs sm:text-sm font-semibold text-white bg-[#ff6f42] hover:bg-[#ee6037] rounded-full shadow-md shadow-[#ff6f42]/20 transition-all active:scale-95 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
