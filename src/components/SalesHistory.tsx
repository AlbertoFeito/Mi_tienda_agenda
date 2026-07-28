import { useMemo, useState } from 'react';
import { Search, X, ShoppingCart, ChevronRight, Receipt } from 'lucide-react';
import { useLiveQuery } from '@/lib/live';
import { db } from '@/lib/db';
import { useApp } from '@/contexts/AppContext';
import { useBackHandler } from '@/lib/backHandler';
import { moneyClass } from '@/lib/format';
import ReceiptModal from '@/components/ReceiptModal';
import type { ReceiptData } from '@/lib/receipt';
import type { Sale, Customer, PeriodFilter } from '@/types';

const METHOD = {
  cash: { icon: '💵', label: 'Efectivo' },
  transfer: { icon: '💳', label: 'Transferencia' },
  installment: { icon: '📅', label: 'A plazos' },
} as const;

const PERIODS: { key: PeriodFilter | 'all'; label: string }[] = [
  { key: 'today', label: 'Hoy' },
  { key: 'week', label: 'Semana' },
  { key: 'month', label: 'Mes' },
  { key: 'year', label: 'Año' },
  { key: 'all', label: 'Todas' },
];

/** Start of the window for a period, or null for "everything". */
export function since(period: PeriodFilter | 'all'): Date | null {
  const now = new Date();
  switch (period) {
    case 'today':
      return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    case 'week': {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      d.setDate(d.getDate() - 7);
      return d;
    }
    case 'month':
      return new Date(now.getFullYear(), now.getMonth(), 1);
    case 'year':
      return new Date(now.getFullYear(), 0, 1);
    default:
      return null;
  }
}

function dayKey(d: Date): string {
  return new Date(d).toLocaleDateString('es-CU', { weekday: 'long', day: '2-digit', month: 'long' });
}

/**
 * Every sale made, newest first, grouped by day with a daily total.
 *
 * The dashboard only ever showed today's last few, and Análisis only totals, so
 * until now there was no way to answer "what did I sell on Tuesday?".
 */
export default function SalesHistory() {
  const { formatPrice } = useApp();
  const sales = useLiveQuery(() => db.sales.toArray(), []) || [];
  const customers = useLiveQuery(() => db.customers.toArray(), []) || [];
  const [period, setPeriod] = useState<PeriodFilter | 'all'>('month');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Sale | null>(null);

  const filtered = useMemo(() => {
    const from = since(period);
    const q = query.trim().toLowerCase();
    return sales
      .filter((s) => (from ? new Date(s.createdAt) >= from : true))
      .filter((s) => {
        if (!q) return true;
        return (
          s.receiptNumber?.toLowerCase().includes(q) ||
          s.customerName?.toLowerCase().includes(q) ||
          s.items.some((it) => it.productName.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [sales, period, query]);

  // Grouped by day so the list reads like a ledger, with each day's takings.
  const days = useMemo(() => {
    const map = new Map<string, { label: string; sales: Sale[]; total: number }>();
    for (const s of filtered) {
      const key = new Date(s.createdAt).toDateString();
      const entry = map.get(key) || { label: dayKey(new Date(s.createdAt)), sales: [], total: 0 };
      entry.sales.push(s);
      entry.total += s.total;
      map.set(key, entry);
    }
    return Array.from(map.values());
  }, [filtered]);

  const periodTotal = filtered.reduce((sum, s) => sum + s.total, 0);

  if (selected) {
    return (
      <SaleDetail
        sale={selected}
        customer={customers.find((c) => c.id === selected.customerId)}
        onBack={() => setSelected(null)}
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              period === p.key ? 'bg-[#0F766E] text-white' : 'bg-white text-gray-600 border border-[#E2E8F0]'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por producto, cliente o recibo..."
          className="w-full h-12 pl-10 pr-10 rounded-xl border border-[#E2E8F0] bg-white text-base focus:border-[#0F766E] outline-none"
        />
        {query && (
          <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl p-3 shadow-sm flex items-center justify-between">
        <span className="text-sm text-[#475569]">
          {filtered.length} {filtered.length === 1 ? 'venta' : 'ventas'}
        </span>
        <span className={`font-bold text-[#0F766E] ${moneyClass(formatPrice(periodTotal, 'CUP'), 'lg')}`}>
          {formatPrice(periodTotal, 'CUP')}
        </span>
      </div>

      {days.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-14 text-gray-400 text-center px-6">
          <ShoppingCart className="w-12 h-12 mb-3" />
          <p className="font-medium text-gray-500">
            {query ? 'Sin resultados' : 'No hay ventas en este período'}
          </p>
          {!query && <p className="text-sm mt-1">Prueba con un período más largo.</p>}
        </div>
      ) : (
        days.map((day) => (
          <div key={day.label}>
            <div className="flex items-center justify-between px-1 mb-1.5 mt-3">
              <span className="text-xs font-semibold text-[#475569] capitalize">{day.label}</span>
              <span className="text-xs font-medium text-[#94A3B8] tabular-nums">
                {formatPrice(day.total, 'CUP')}
              </span>
            </div>
            <div className="bg-white rounded-xl shadow-sm divide-y divide-[#F1F5F9]">
              {day.sales.map((sale) => {
                const m = METHOD[sale.paymentMethod] ?? METHOD.cash;
                const units = sale.items.reduce((n, it) => n + it.quantity, 0);
                return (
                  <button
                    key={sale.id}
                    onClick={() => setSelected(sale)}
                    className="w-full flex items-center gap-3 p-3 text-left active:bg-[#F1F5F9] transition-colors"
                  >
                    <span className="w-10 h-10 rounded-full bg-[#F1F5F9] flex items-center justify-center text-lg flex-shrink-0">
                      {m.icon}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-semibold text-[#0F172A]">
                        {new Date(sale.createdAt).toLocaleTimeString('es-CU', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                        {sale.customerName ? ` · ${sale.customerName}` : ''}
                      </span>
                      <span className="block text-xs text-[#94A3B8] truncate">
                        {m.label} · {units} {units === 1 ? 'artículo' : 'artículos'}
                        {sale.receiptNumber ? ` · ${sale.receiptNumber}` : ''}
                      </span>
                    </span>
                    <span className="flex items-center gap-1 flex-shrink-0 max-w-[45%]">
                      <span className={`font-bold text-[#0F172A] ${moneyClass(formatPrice(sale.total, 'CUP'))}`}>
                        {formatPrice(sale.total, 'CUP')}
                      </span>
                      <ChevronRight size={16} className="text-[#CBD5E1]" />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function SaleDetail({
  sale,
  customer,
  onBack,
}: {
  sale: Sale;
  customer?: Customer;
  onBack: () => void;
}) {
  const { formatPrice, settings } = useApp();
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);

  useBackHandler(onBack);

  const m = METHOD[sale.paymentMethod] ?? METHOD.cash;
  const subtotal = sale.items.reduce((sum, it) => sum + it.subtotal, 0);

  const openReceipt = () => {
    setReceipt({
      storeName: settings?.storeName || 'Mi Tienda',
      receiptNumber: sale.receiptNumber,
      date: new Date(sale.createdAt),
      items: sale.items.map((it) => ({
        productName: it.productName,
        quantity: it.quantity,
        subtotal: it.subtotal,
      })),
      discount: sale.discount,
      total: sale.total,
      customerName: sale.customerName ?? customer?.name,
      customerPhone: customer?.phone,
      paymentMethod: sale.paymentMethod,
    });
  };

  return (
    <div className="space-y-4 animate-fade-in-up">
      <div>
        <h3 className="text-lg font-semibold">Venta {sale.receiptNumber}</h3>
        <p className="text-sm text-[#475569]">
          {new Date(sale.createdAt).toLocaleString('es-CU')}
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-[#475569]">Total cobrado</span>
          <span className={`font-bold text-[#0F766E] ${moneyClass(formatPrice(sale.total, 'CUP'), 'xl')}`}>
            {formatPrice(sale.total, 'CUP')}
          </span>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-[#475569]">
          <span>{m.icon} {m.label}</span>
          {(sale.customerName || customer?.name) && (
            <span>Cliente: {sale.customerName || customer?.name}</span>
          )}
        </div>
      </div>

      <div>
        <h4 className="text-sm font-semibold text-[#0F172A] mb-2">Artículos</h4>
        <div className="bg-white rounded-xl shadow-sm divide-y divide-[#F1F5F9]">
          {sale.items.map((it, i) => (
            <div key={i} className="flex items-center justify-between gap-3 p-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-[#0F172A] truncate">{it.productName}</p>
                <p className="text-xs text-[#94A3B8]">
                  {it.quantity} × {formatPrice(it.unitPrice, it.unitCurrency)}
                </p>
              </div>
              <span className={`font-semibold text-[#0F172A] flex-shrink-0 ${moneyClass(formatPrice(it.subtotal, 'CUP'))}`}>
                {formatPrice(it.subtotal, 'CUP')}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-4 space-y-1.5">
        <div className="flex justify-between text-sm text-[#475569]">
          <span>Subtotal</span>
          <span className="tabular-nums">{formatPrice(subtotal, 'CUP')}</span>
        </div>
        {sale.discount > 0 && (
          <div className="flex justify-between text-sm text-[#DC2626]">
            <span>Descuento</span>
            <span className="tabular-nums">− {formatPrice(sale.discount, 'CUP')}</span>
          </div>
        )}
        <div className="flex justify-between font-semibold text-[#0F172A] pt-1.5 border-t border-[#F1F5F9]">
          <span>Total</span>
          <span className={moneyClass(formatPrice(sale.total, 'CUP'))}>
            {formatPrice(sale.total, 'CUP')}
          </span>
        </div>
      </div>

      <button
        onClick={openReceipt}
        className="w-full h-12 flex items-center justify-center gap-2 border-2 border-[#0F766E] text-[#0F766E] rounded-xl font-medium active:scale-[0.98] transition-transform"
      >
        <Receipt size={18} />
        Ver y compartir recibo
      </button>

      {receipt && <ReceiptModal data={receipt} onClose={() => setReceipt(null)} />}
    </div>
  );
}
