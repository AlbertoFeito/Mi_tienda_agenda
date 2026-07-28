import { AlertTriangle } from 'lucide-react';
import { useBackHandler } from '@/lib/backHandler';

/**
 * In-app confirmation for actions that cannot be undone.
 *
 * Replaces the browser's `confirm()`, which inside the WebView shows a system
 * dialog stamped with the local origin — fine while developing, out of place
 * in an app someone paid for.
 */
export default function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Eliminar',
  cancelLabel = 'Cancelar',
  danger = true,
  onConfirm,
  onCancel,
}: {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useBackHandler(onCancel);

  return (
    <div className="fixed inset-0 z-[450] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl p-5 w-full max-w-sm animate-scale-in">
        <div className="flex items-start gap-3">
          {danger && (
            <div className="w-10 h-10 rounded-full bg-[#FEE2E2] flex items-center justify-center flex-shrink-0">
              <AlertTriangle size={20} className="text-[#DC2626]" />
            </div>
          )}
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-[#0F172A]">{title}</h3>
            {message && <p className="text-sm text-[#475569] mt-1">{message}</p>}
          </div>
        </div>

        <div className="flex gap-2 mt-5">
          <button
            onClick={onCancel}
            className="flex-1 h-12 border border-[#E2E8F0] rounded-xl font-medium text-[#475569] active:scale-[0.98] transition-transform"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 h-12 rounded-xl font-semibold text-white active:scale-[0.98] transition-transform ${
              danger ? 'bg-[#DC2626]' : 'bg-[#0F766E]'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
