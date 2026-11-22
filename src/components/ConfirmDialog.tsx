import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'warning';
  theme?: 'light' | 'dark';
  isProcessing?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'पुष्टि करें',
  cancelLabel = 'रद्द करें',
  tone = 'danger',
  theme = 'light',
  isProcessing = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  const isDark = theme === 'dark';

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 font-hindi-brand"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-message"
    >
      <div
        className={`w-full max-w-md rounded-2xl border shadow-2xl overflow-hidden ${
          isDark
            ? 'bg-zinc-950 border-zinc-800 text-zinc-100'
            : 'bg-white border-zinc-200 text-zinc-900'
        }`}
      >
        <div
          className={`px-5 py-4 border-b flex items-center justify-between gap-3 ${
            isDark ? 'border-zinc-800 bg-zinc-900/70' : 'border-zinc-200 bg-zinc-50'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                tone === 'danger'
                  ? 'bg-red-600/15 text-red-600 border border-red-500/30'
                  : 'bg-amber-500/15 text-amber-600 border border-amber-500/30'
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
            </div>
            <h3 id="confirm-dialog-title" className="text-sm font-bold leading-snug">
              {title}
            </h3>
          </div>

          <button
            type="button"
            onClick={onCancel}
            disabled={isProcessing}
            aria-label="Close confirmation dialog"
            className={`p-1.5 rounded-lg transition-colors cursor-pointer disabled:opacity-50 ${
              isDark
                ? 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200/70'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4">
          <p
            id="confirm-dialog-message"
            className={`text-xs leading-relaxed ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}
          >
            {message}
          </p>
        </div>

        <div
          className={`px-5 py-3.5 border-t flex items-center justify-end gap-2.5 ${
            isDark ? 'border-zinc-800 bg-zinc-900/40' : 'border-zinc-200 bg-zinc-50'
          }`}
        >
          <button
            type="button"
            onClick={onCancel}
            disabled={isProcessing}
            className={`px-4 py-2 text-xs font-bold rounded-xl border transition-colors cursor-pointer disabled:opacity-50 ${
              isDark
                ? 'bg-zinc-900 border-zinc-700 text-zinc-200 hover:bg-zinc-800'
                : 'bg-white border-zinc-300 text-zinc-700 hover:bg-zinc-100'
            }`}
          >
            {cancelLabel}
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={isProcessing}
            className={`px-4 py-2 text-xs font-bold rounded-xl text-white transition-colors cursor-pointer disabled:opacity-50 ${
              tone === 'danger'
                ? 'bg-red-700 hover:bg-red-600'
                : 'bg-amber-600 hover:bg-amber-500'
            }`}
          >
            {isProcessing ? 'प्रक्रिया जारी है...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
