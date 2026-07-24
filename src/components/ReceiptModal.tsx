import { CheckCircle, Share2, MessageCircle, MessageSquare, X } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { buildReceiptText, type ReceiptData } from '@/lib/receipt';
import { openSms, openWhatsApp } from '@/lib/messaging';
import { useBackHandler } from '@/lib/backHandler';
import { useApp } from '@/contexts/AppContext';

/** Shown after a sale so the receipt can be shared with the customer. */
export default function ReceiptModal({ data, onClose }: { data: ReceiptData; onClose: () => void }) {
  const { showToast } = useApp();
  useBackHandler(onClose);
  const text = buildReceiptText(data);
  const phone = data.customerPhone;

  const share = async () => {
    try {
      if (Capacitor.isNativePlatform()) {
        const { Share } = await import('@capacitor/share');
        await Share.share({ title: `Recibo ${data.receiptNumber}`, text });
      } else if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ text });
      } else {
        await navigator.clipboard?.writeText(text);
        showToast('Recibo copiado', 'success');
      }
    } catch {
      /* user cancelled the share sheet */
    }
  };

  const sendTo = async (kind: 'sms' | 'whatsapp') => {
    if (!phone) return;
    try {
      if (kind === 'sms') await openSms(phone, text);
      else await openWhatsApp(phone, text);
    } catch {
      showToast('No se pudo abrir la app de mensajes', 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-end justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-t-3xl w-full max-w-lg p-5 animate-slide-up max-h-[85vh] flex flex-col">
        <button onClick={onClose} className="absolute top-3 right-3 p-2 text-[#94A3B8]" aria-label="Cerrar">
          <X size={22} />
        </button>

        <div className="flex flex-col items-center pt-1 pb-3">
          <div className="w-12 h-12 rounded-full bg-[#D1FAE5] flex items-center justify-center mb-2">
            <CheckCircle size={26} className="text-[#059669]" />
          </div>
          <h3 className="text-lg font-semibold">Venta registrada</h3>
          <p className="text-xs text-[#94A3B8]">Recibo {data.receiptNumber}</p>
        </div>

        <pre className="flex-1 overflow-y-auto whitespace-pre-wrap break-words bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3 text-xs text-[#334155] font-mono">
          {text}
        </pre>

        <div className="mt-4 space-y-2">
          <button
            onClick={share}
            className="w-full h-12 flex items-center justify-center gap-2 rounded-xl bg-[#0F766E] text-white font-medium active:scale-[0.98] transition-transform"
          >
            <Share2 size={18} />
            Compartir recibo
          </button>
          {phone && (
            <div className="flex gap-2">
              <button
                onClick={() => sendTo('whatsapp')}
                className="flex-1 h-11 flex items-center justify-center gap-1.5 rounded-xl bg-[#25D366] text-white text-sm font-medium active:scale-[0.98] transition-transform"
              >
                <MessageCircle size={16} />
                WhatsApp
              </button>
              <button
                onClick={() => sendTo('sms')}
                className="flex-1 h-11 flex items-center justify-center gap-1.5 rounded-xl border border-[#0F766E] text-[#0F766E] text-sm font-medium active:scale-[0.98] transition-transform"
              >
                <MessageSquare size={16} />
                SMS
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
