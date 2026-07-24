import { useEffect, useMemo } from 'react';
import { MessageSquare, MessageCircle, BellRing, AlertTriangle } from 'lucide-react';
import { useLiveQuery } from '@/lib/live';
import { db } from '@/lib/db';
import { useApp } from '@/contexts/AppContext';
import { getDueSoon } from '@/lib/installments';
import { syncReminders } from '@/lib/reminders';
import { buildReminderMessage, openSms, openWhatsApp } from '@/lib/messaging';

/**
 * "Cobros próximos": active installments overdue or due within two days, each
 * with one-tap SMS / WhatsApp reminders. Also (re)schedules the local
 * notifications that fire two days before each due date.
 */
export default function UpcomingCollections() {
  const { showToast, formatPrice } = useApp();
  const installments = useLiveQuery(() => db.installments.toArray(), []);
  const payments = useLiveQuery(() => db.installmentPayments.toArray(), []);
  const customers = useLiveQuery(() => db.customers.toArray(), []);
  const settings = useLiveQuery(() => db.settings.toArray().then((s) => s[0]), []);

  const storeName = settings?.storeName || 'NayadeStore';

  const dueSoon = useMemo(() => {
    if (!installments || !payments) return [];
    return getDueSoon(installments, payments, 2);
  }, [installments, payments]);

  // (Re)schedule the 2-days-before notifications whenever the data changes.
  useEffect(() => {
    if (installments && payments) syncReminders(installments, payments);
  }, [installments, payments]);

  if (dueSoon.length === 0) return null;

  const dueLabel = (daysUntil: number, overdue: boolean) => {
    if (overdue || daysUntil < 0) return 'Vencido';
    if (daysUntil === 0) return 'Vence hoy';
    if (daysUntil === 1) return 'Vence mañana';
    return `Vence en ${daysUntil} días`;
  };

  const contact = async (kind: 'sms' | 'whatsapp', phone: string | undefined, name: string, amount: number, dueDate: Date, overdue: boolean) => {
    if (!phone) {
      showToast('Este cliente no tiene teléfono guardado', 'warning');
      return;
    }
    const text = buildReminderMessage({ customerName: name, amount, dueDate, storeName, overdue });
    try {
      if (kind === 'sms') await openSms(phone, text);
      else await openWhatsApp(phone, text);
    } catch {
      showToast(kind === 'sms' ? 'No se pudo abrir Mensajes' : 'No se pudo abrir WhatsApp', 'error');
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-[#FDE68A] overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 bg-[#FFFBEB] border-b border-[#FDE68A]">
        <BellRing size={18} className="text-[#B45309]" />
        <h3 className="text-sm font-semibold text-[#92400E]">Cobros próximos</h3>
        <span className="ml-auto text-xs font-medium text-[#B45309] bg-[#FEF3C7] px-2 py-0.5 rounded-full">
          {dueSoon.length}
        </span>
      </div>

      <div className="divide-y divide-[#F1F5F9]">
        {dueSoon.map(({ installment, dueDate, amount, overdue, daysUntil }) => {
          const customer = customers?.find((c) => c.id === installment.customerId);
          const phone = customer?.phone;
          return (
            <div key={installment.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-[#0F172A] truncate">{installment.customerName}</p>
                  <p className="text-lg font-semibold text-[#0F766E]">{formatPrice(amount, 'CUP')}</p>
                </div>
                <span
                  className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap ${
                    overdue ? 'bg-[#FEE2E2] text-[#B91C1C]' : 'bg-[#FEF3C7] text-[#B45309]'
                  }`}
                >
                  {overdue && <AlertTriangle size={12} />}
                  {dueLabel(daysUntil, overdue)}
                </span>
              </div>

              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => contact('sms', phone, installment.customerName, amount, dueDate, overdue)}
                  className="flex-1 h-10 flex items-center justify-center gap-1.5 rounded-lg bg-[#0F766E] text-white text-sm font-medium active:scale-[0.98] transition-transform disabled:opacity-40"
                  disabled={!phone}
                >
                  <MessageSquare size={16} />
                  SMS
                </button>
                <button
                  onClick={() => contact('whatsapp', phone, installment.customerName, amount, dueDate, overdue)}
                  className="flex-1 h-10 flex items-center justify-center gap-1.5 rounded-lg bg-[#25D366] text-white text-sm font-medium active:scale-[0.98] transition-transform disabled:opacity-40"
                  disabled={!phone}
                >
                  <MessageCircle size={16} />
                  WhatsApp
                </button>
              </div>
              {!phone && (
                <p className="text-xs text-[#94A3B8] mt-2">Agrega un teléfono al cliente para enviarle recordatorios.</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
