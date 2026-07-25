import { useMemo, useState } from 'react';
import { useLiveQuery } from '@/lib/live';
import { HandCoins, CheckCircle, MessageSquare, MessageCircle } from 'lucide-react';
import { db } from '@/lib/db';
import { useApp } from '@/contexts/AppContext';
import { useBackHandler } from '@/lib/backHandler';
import { openSms, openWhatsApp } from '@/lib/messaging';
import { normalizeCubanPhone } from '@/components/PhoneField';
import NumberField from '@/components/NumberField';
import { computeOwners, type OwnerSummary } from '@/lib/owners';
import type { OwnerPayment } from '@/types';

function money(n: number): string {
  return new Intl.NumberFormat('es-CU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function buildOwnerSummary(owner: OwnerSummary, storeName: string): string {
  const lines: string[] = [];
  lines.push(`Hola ${owner.ownerName}, resumen de tu liquidación en ${storeName}:`);
  lines.push(`• Vendido: ${money(owner.totalOwed)} CUP`);
  lines.push(`• Ya pagado: ${money(owner.totalPaid)} CUP`);
  lines.push(`• Saldo a pagar: ${money(owner.balance)} CUP`);
  const sold = owner.products.filter((p) => p.soldQty > 0);
  if (sold.length) {
    lines.push('');
    lines.push('Vendidos:');
    for (const p of sold) lines.push(`- ${p.product.name}: ${p.soldQty} u. (${money(p.owedCUP)} CUP)`);
  }
  return lines.join('\n');
}

export default function Duenos() {
  const { formatPrice, convertToCUP } = useApp();
  const products = useLiveQuery(() => db.products.toArray(), []) || [];
  const sales = useLiveQuery(() => db.sales.toArray(), []) || [];
  const ownerPayments = useLiveQuery(() => db.ownerPayments.toArray(), []) || [];
  const [selectedOwner, setSelectedOwner] = useState<string | null>(null);

  const owners = useMemo(
    () => computeOwners(products, sales, ownerPayments, convertToCUP),
    [products, sales, ownerPayments, convertToCUP],
  );

  const owner = selectedOwner ? owners.find((o) => o.ownerName === selectedOwner) : null;

  if (owner) {
    const payments = ownerPayments.filter(
      (p) => ((p.ownerName || '').trim() || 'Sin dueño') === owner.ownerName,
    );
    return <OwnerDetail owner={owner} payments={payments} onBack={() => setSelectedOwner(null)} />;
  }

  return (
    <div className="space-y-4 animate-fade-in-up">
      <h2 className="text-xl font-bold">Dueños</h2>
      <p className="text-sm text-[#475569] -mt-2">Liquidación de artículos ajenos que te dieron a vender.</p>

      {owners.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400 text-center px-6">
          <HandCoins className="w-12 h-12 mb-3" />
          <p className="font-medium text-gray-500">Aún no hay dueños</p>
          <p className="text-sm mt-1">Marca un producto como “Ajeno” y ponle el nombre del dueño; aquí verás cuánto le debes.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {owners.map((o) => (
            <button
              key={o.ownerName}
              onClick={() => setSelectedOwner(o.ownerName)}
              className="w-full bg-white rounded-xl p-4 shadow-sm text-left active:bg-[#F1F5F9] transition-colors"
            >
              <div className="flex justify-between items-start gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-[#0F172A] truncate">{o.ownerName}</p>
                  <p className="text-xs text-[#94A3B8] mt-0.5">
                    {o.activeProducts} en venta · {o.products.length} en total
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-[10px] text-[#94A3B8]">Le debes</p>
                  <p className={`font-bold ${o.balance > 0.005 ? 'text-[#DC2626]' : 'text-[#059669]'}`}>
                    {formatPrice(o.balance, 'CUP')}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[11px] text-[#475569]">
                <span>Vendido: {formatPrice(o.totalOwed, 'CUP')}</span>
                <span>Pagado: {formatPrice(o.totalPaid, 'CUP')}</span>
                <span className="text-[#0F766E] font-medium">Tu ganancia: {formatPrice(o.profit, 'CUP')}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function OwnerDetail({
  owner,
  payments,
  onBack,
}: {
  owner: OwnerSummary;
  payments: OwnerPayment[];
  onBack: () => void;
}) {
  const { formatPrice, showToast, settings } = useApp();
  const [showPay, setShowPay] = useState(false);

  useBackHandler(onBack);

  const sendSummary = async (kind: 'sms' | 'whatsapp') => {
    const text = buildOwnerSummary(owner, settings?.storeName || 'NayadeStore');
    const phone = normalizeCubanPhone(owner.contact || '');
    try {
      if (kind === 'sms') await openSms(phone, text);
      else await openWhatsApp(phone, text);
    } catch {
      showToast('No se pudo abrir la app de mensajes', 'error');
    }
  };

  const registerPayment = async (amount: number, notes: string) => {
    if (amount <= 0) {
      showToast('Ingresa un monto mayor a 0', 'error');
      return;
    }
    await db.ownerPayments.add({
      ownerName: owner.ownerName,
      amount,
      notes: notes.trim() || undefined,
      createdAt: new Date(),
    });
    showToast('Pago al dueño registrado', 'success');
    setShowPay(false);
  };

  return (
    <div className="animate-fade-in-up">
      <div className="flex items-center gap-2 mb-4 px-4 pt-4">
        <h2 className="text-lg font-semibold truncate">{owner.ownerName}</h2>
      </div>

      <div className="px-4 pb-8 space-y-4">
        {owner.contact && <p className="text-sm text-[#475569] -mt-2">Contacto: {owner.contact}</p>}

        {/* Resumen */}
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-[#475569]">Saldo a pagar</span>
            <span className={`text-2xl font-bold ${owner.balance > 0.005 ? 'text-[#DC2626]' : 'text-[#059669]'}`}>
              {formatPrice(owner.balance, 'CUP')}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-3 text-center">
            <div>
              <p className="text-[10px] text-[#94A3B8]">Vendido (suyo)</p>
              <p className="text-sm font-semibold">{formatPrice(owner.totalOwed, 'CUP')}</p>
            </div>
            <div>
              <p className="text-[10px] text-[#94A3B8]">Ya pagado</p>
              <p className="text-sm font-semibold text-[#059669]">{formatPrice(owner.totalPaid, 'CUP')}</p>
            </div>
            <div>
              <p className="text-[10px] text-[#94A3B8]">Tu ganancia</p>
              <p className="text-sm font-semibold text-[#0F766E]">{formatPrice(owner.profit, 'CUP')}</p>
            </div>
          </div>
        </div>

        <button
          onClick={() => setShowPay(true)}
          className="w-full h-12 flex items-center justify-center gap-2 bg-[#0F766E] text-white rounded-xl font-medium active:scale-[0.98] transition-transform"
        >
          <HandCoins size={18} />
          Registrar pago al dueño
        </button>

        <div className="flex gap-2">
          <button
            onClick={() => sendSummary('whatsapp')}
            className="flex-1 h-11 flex items-center justify-center gap-1.5 rounded-xl bg-[#25D366] text-white text-sm font-medium active:scale-[0.98] transition-transform"
          >
            <MessageCircle size={16} />
            Resumen WhatsApp
          </button>
          <button
            onClick={() => sendSummary('sms')}
            className="flex-1 h-11 flex items-center justify-center gap-1.5 rounded-xl border border-[#0F766E] text-[#0F766E] text-sm font-medium active:scale-[0.98] transition-transform"
          >
            <MessageSquare size={16} />
            SMS
          </button>
        </div>

        {/* Productos entregados */}
        <div>
          <h3 className="text-sm font-semibold text-[#0F172A] mb-2">Artículos entregados</h3>
          <div className="space-y-2">
            {owner.products.map(({ product, soldQty, remaining, owedCUP, profitCUP }) => (
              <div key={product.id} className="bg-white rounded-xl p-3 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-[#0F172A] truncate">{product.name}</p>
                  <span className="text-xs text-[#94A3B8] flex-shrink-0">
                    {remaining > 0 ? `${remaining} en venta` : 'Agotado'}
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-[11px] text-[#475569]">
                  <span>Vendidos: {soldQty}</span>
                  <span>Le debes: {formatPrice(owedCUP, 'CUP')}</span>
                  <span className="text-[#0F766E]">Ganancia: {formatPrice(profitCUP, 'CUP')}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Historial de pagos */}
        {payments.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-[#0F172A] mb-2">Pagos realizados</h3>
            <div className="bg-white rounded-xl shadow-sm divide-y divide-[#F1F5F9]">
              {payments
                .slice()
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .map((p) => (
                  <div key={p.id} className="flex items-center justify-between p-3">
                    <div>
                      <p className="text-sm font-medium">{formatPrice(p.amount, 'CUP')}</p>
                      <p className="text-xs text-[#94A3B8]">
                        {new Date(p.createdAt).toLocaleDateString('es-CU')}
                        {p.notes ? ` · ${p.notes}` : ''}
                      </p>
                    </div>
                    <CheckCircle size={18} className="text-[#059669]" />
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>

      {showPay && (
        <OwnerPaymentForm balance={owner.balance} onClose={() => setShowPay(false)} onPay={registerPayment} />
      )}
    </div>
  );
}

function OwnerPaymentForm({
  balance,
  onClose,
  onPay,
}: {
  balance: number;
  onClose: () => void;
  onPay: (amount: number, notes: string) => void;
}) {
  const { formatPrice } = useApp();
  const [amount, setAmount] = useState(Math.max(0, Math.round(balance * 100) / 100));
  const [notes, setNotes] = useState('');

  useBackHandler(onClose);

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-t-3xl w-full max-w-lg p-5 animate-slide-up">
        <div className="flex justify-center mb-3">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>
        <h3 className="text-lg font-semibold mb-1">Pago al dueño</h3>
        <p className="text-xs text-[#94A3B8] mb-4">Saldo actual: {formatPrice(balance, 'CUP')}</p>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-[#475569] block mb-1">Monto (CUP)</label>
            <NumberField value={amount} onChange={setAmount} decimals />
            <div className="flex gap-2 mt-2">
              <button
                type="button"
                onClick={() => setAmount(Math.max(0, Math.round(balance * 100) / 100))}
                className="text-xs font-medium text-[#0F766E] border border-[#0F766E] rounded-lg px-3 py-1.5 active:scale-95"
              >
                Liquidar saldo ({formatPrice(balance, 'CUP')})
              </button>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-[#475569] block mb-1">Nota (opcional)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej. entregado en efectivo"
              className="w-full h-12 px-3 rounded-lg border border-[#E2E8F0] text-base focus:border-[#0F766E] outline-none"
            />
          </div>
          <button
            onClick={() => onPay(amount, notes)}
            className="w-full h-12 bg-[#0F766E] text-white rounded-xl font-semibold active:scale-[0.98] transition-transform"
          >
            Guardar pago
          </button>
        </div>
      </div>
    </div>
  );
}
