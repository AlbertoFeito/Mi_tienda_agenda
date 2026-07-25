import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ChevronRight, Rocket } from 'lucide-react';
import { useLiveQuery } from '@/lib/live';
import { db } from '@/lib/db';
import { useApp } from '@/contexts/AppContext';
import { shareBackup } from '@/lib/backup';

interface Step {
  id: string;
  label: string;
  hint: string;
  done: boolean;
  action: () => void | Promise<void>;
}

/**
 * Setup checklist on the home screen. Disappears on its own once everything is
 * done, so it never becomes furniture.
 *
 * Each item checks something the user actually did. In particular the backup
 * item looks at `lastSharedBackupAt`, not `lastBackupAt`: the daily automatic
 * backup writes a file on the same phone, which is no help at all if the phone
 * is the thing that gets lost.
 */
export default function FirstSteps() {
  const navigate = useNavigate();
  const { settings, openSettings, showToast } = useApp();
  const products = useLiveQuery(() => db.products.toArray(), []);
  const [busy, setBusy] = useState(false);

  const steps: Step[] = useMemo(() => {
    const storeName = (settings?.storeName || '').trim();
    return [
      {
        id: 'store',
        label: 'Ponle el nombre a tu tienda',
        hint: 'Sale en los recibos que le mandas a los clientes.',
        done: storeName !== '' && storeName !== 'Mi Tienda',
        action: () => openSettings('store'),
      },
      {
        id: 'rates',
        label: 'Revisa las tasas de cambio',
        hint: 'Con ellas se calculan tus ganancias.',
        done: Boolean(settings?.ratesReviewedAt),
        action: () => openSettings('rates'),
      },
      {
        id: 'products',
        label: 'Entra tu primer producto',
        hint: 'Propio si es tuyo, ajeno si te lo dieron a vender.',
        done: (products?.length ?? 0) > 0,
        action: () => navigate('/productos'),
      },
      {
        id: 'backup',
        label: 'Guarda una copia fuera del teléfono',
        hint: 'Mándatela por WhatsApp o correo. Si se pierde el teléfono, es lo único que te salva.',
        done: Boolean(settings?.lastSharedBackupAt),
        action: async () => {
          setBusy(true);
          try {
            await shareBackup();
          } catch {
            showToast('No se pudo crear la copia', 'error');
          } finally {
            setBusy(false);
          }
        },
      },
    ];
  }, [settings, products, navigate, openSettings, showToast]);

  const doneCount = steps.filter((s) => s.done).length;

  // Wait for both reads before deciding, so the card doesn't flash on launch.
  if (settings === undefined || products === undefined) return null;
  if (doneCount === steps.length) return null;

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 p-4 pb-3">
        <div className="w-9 h-9 rounded-full bg-[#CCFBF1] flex items-center justify-center flex-shrink-0">
          <Rocket size={18} className="text-[#0F766E]" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[#0F172A]">Primeros pasos</p>
          <p className="text-xs text-[#94A3B8]">
            {doneCount} de {steps.length} listos
          </p>
        </div>
      </div>

      <div className="h-1 bg-[#F1F5F9]">
        <div
          className="h-full bg-[#0F766E] transition-all"
          style={{ width: `${(doneCount / steps.length) * 100}%` }}
        />
      </div>

      <div className="divide-y divide-[#F1F5F9]">
        {steps.map((step) => (
          <button
            key={step.id}
            onClick={() => step.action()}
            disabled={step.done || busy}
            className="w-full flex items-center gap-3 p-3 text-left active:bg-[#F1F5F9] transition-colors disabled:active:bg-transparent"
          >
            <span
              className={`w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center border-2 ${
                step.done ? 'bg-[#059669] border-[#059669]' : 'border-[#CBD5E1]'
              }`}
            >
              {step.done && <Check size={12} className="text-white" strokeWidth={3} />}
            </span>
            <span className="min-w-0 flex-1">
              <span
                className={`block text-sm ${
                  step.done ? 'text-[#94A3B8] line-through' : 'text-[#0F172A] font-medium'
                }`}
              >
                {step.label}
              </span>
              {!step.done && <span className="block text-xs text-[#94A3B8] mt-0.5">{step.hint}</span>}
            </span>
            {!step.done && <ChevronRight size={16} className="text-[#94A3B8] flex-shrink-0" />}
          </button>
        ))}
      </div>
    </div>
  );
}
