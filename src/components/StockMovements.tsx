import { useState } from 'react';
import { PackagePlus, PackageMinus, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';
import { useLiveQuery } from '@/lib/live';
import { db } from '@/lib/db';
import { useApp } from '@/contexts/AppContext';
import { useBackHandler } from '@/lib/backHandler';
import NumberField from '@/components/NumberField';
import { MERMA_REASONS, movementsFor, recordEntry, recordLoss, summarize } from '@/lib/stock';
import type { Currency, Product } from '@/types';

/**
 * Stock in and stock written off, from inside the product being edited —
 * which is where the question "why does it say 12?" actually comes up.
 */
export default function StockMovements({
  product: initial,
  onStockChange,
}: {
  product: Product;
  /** Keeps the form's stock field in step, so saving cannot undo a movement. */
  onStockChange: (stock: number) => void;
}) {
  const { formatPrice, showToast } = useApp();
  const all = useLiveQuery(() => db.stockMovements.toArray(), []) || [];
  const [sheet, setSheet] = useState<'entrada' | 'merma' | null>(null);

  // Read the product back from the database: the one handed in is a snapshot
  // from when the form opened, and every movement makes it stale.
  const live = useLiveQuery(() => db.products.get(initial.id!), [initial.id]);
  const product = live ?? initial;

  const mine = movementsFor(all, product.id!);
  const totals = summarize(mine);

  return (
    <div className="space-y-3 pt-2 border-t border-gray-100">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-[#475569]">Movimientos de inventario</p>
        <span className="text-xs text-[#94A3B8] tabular-nums">Stock: {product.stock}</span>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setSheet('entrada')}
          className="flex-1 h-11 flex items-center justify-center gap-1.5 border-2 border-[#059669] text-[#059669] rounded-lg text-sm font-medium active:scale-[0.98] transition-transform"
        >
          <PackagePlus size={16} />
          Entrada
        </button>
        <button
          type="button"
          onClick={() => setSheet('merma')}
          className="flex-1 h-11 flex items-center justify-center gap-1.5 border-2 border-[#D97706] text-[#D97706] rounded-lg text-sm font-medium active:scale-[0.98] transition-transform"
        >
          <PackageMinus size={16} />
          Merma
        </button>
      </div>

      {(totals.entradas > 0 || totals.mermas > 0) && (
        <div className="flex gap-4 text-xs text-[#475569]">
          <span>Entró: <strong className="tabular-nums">{totals.entradas}</strong></span>
          <span>Merma: <strong className="tabular-nums">{totals.mermas}</strong></span>
        </div>
      )}

      {mine.length > 0 && (
        <div className="bg-white rounded-xl border border-[#E2E8F0] divide-y divide-[#F1F5F9] max-h-56 overflow-y-auto">
          {mine.slice(0, 20).map((m) => (
            <div key={m.id} className="flex items-center gap-2.5 p-2.5">
              {m.type === 'entrada' ? (
                <ArrowDownCircle size={18} className="text-[#059669] flex-shrink-0" />
              ) : (
                <ArrowUpCircle size={18} className="text-[#D97706] flex-shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-[#0F172A]">
                  {m.type === 'entrada' ? '+' : '−'}
                  {m.quantity} {m.type === 'entrada' ? 'entraron' : 'de merma'}
                  {m.reason ? ` · ${m.reason}` : ''}
                </p>
                <p className="text-xs text-[#94A3B8]">
                  {new Date(m.createdAt).toLocaleDateString('es-CU')}
                  {m.unitCost ? ` · ${formatPrice(m.unitCost, m.unitCurrency || 'CUP')} c/u` : ''}
                  {m.notes ? ` · ${m.notes}` : ''}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {sheet === 'entrada' && (
        <EntrySheet
          product={product}
          onClose={() => setSheet(null)}
          onDone={(msg, stock) => { showToast(msg, 'success'); onStockChange(stock); setSheet(null); }}
        />
      )}
      {sheet === 'merma' && (
        <LossSheet
          product={product}
          onClose={() => setSheet(null)}
          onDone={(msg, stock) => { showToast(msg, 'success'); onStockChange(stock); setSheet(null); }}
          onError={(msg) => showToast(msg, 'error')}
        />
      )}
    </div>
  );
}

function Sheet({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="relative bg-white rounded-t-3xl w-full max-w-lg p-5 animate-slide-up max-h-[85vh] overflow-y-auto">
      <div className="flex justify-center mb-3">
        <div className="w-10 h-1 bg-gray-300 rounded-full" />
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      {subtitle && <p className="text-xs text-[#94A3B8] mt-0.5 mb-4">{subtitle}</p>}
      {children}
    </div>
  );
}

function EntrySheet({
  product,
  onClose,
  onDone,
}: {
  product: Product;
  onClose: () => void;
  onDone: (message: string, stock: number) => void;
}) {
  const [quantity, setQuantity] = useState(1);
  const [unitCost, setUnitCost] = useState(product.costPrice || 0);
  const [currency, setCurrency] = useState<Currency>(product.costCurrency || 'CUP');
  const [updateCost, setUpdateCost] = useState(true);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  useBackHandler(onClose);

  const costChanged = unitCost > 0 && unitCost !== product.costPrice;

  const save = async () => {
    setBusy(true);
    const res = await recordEntry({
      productId: product.id!,
      quantity,
      unitCost,
      unitCurrency: currency,
      updateCost: updateCost && costChanged,
      notes,
    });
    setBusy(false);
    if (!res.ok) return;
    onDone(`Entraron ${quantity}. Stock: ${res.stock}`, res.stock!);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <Sheet
        title="Entrada de mercancía"
        subtitle={
          product.type === 'consignment'
            ? 'El dueño te trajo más de este artículo.'
            : 'Compraste más de este producto.'
        }
      >
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-[#475569] block mb-1">¿Cuántas entraron?</label>
            <NumberField value={quantity} onChange={setQuantity} min={1} />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium text-[#475569]">
                {product.type === 'consignment' ? 'Precio que pide el dueño' : 'Precio de costo'}
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value as Currency)}
                className="h-8 px-2 rounded-lg border border-[#E2E8F0] text-sm outline-none bg-white"
              >
                {(['CUP', 'USD', 'EUR', 'MLC'] as Currency[]).map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <NumberField value={unitCost} onChange={setUnitCost} decimals placeholder="0.00" />
          </div>

          {costChanged && (
            <label className="flex items-start gap-3 p-3 bg-[#F0FDFA] rounded-xl border border-[#0F766E]/20">
              <input
                type="checkbox"
                checked={updateCost}
                onChange={(e) => setUpdateCost(e.target.checked)}
                className="w-5 h-5 mt-0.5 flex-shrink-0"
              />
              <span className="text-sm text-[#475569]">
                Este pasa a ser el precio de costo del producto.
                <span className="block text-xs text-[#94A3B8] mt-0.5">
                  Cambia cómo se calcula la ganancia de aquí en adelante.
                </span>
              </span>
            </label>
          )}

          <div>
            <label className="text-sm font-medium text-[#475569] block mb-1">Nota (opcional)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej. compradas en la shopping"
              className="w-full h-12 px-3 rounded-lg border border-[#E2E8F0] text-base focus:border-[#0F766E] outline-none"
            />
          </div>

          <div className="text-sm text-[#475569] bg-[#F1F5F9] rounded-lg px-3 py-2 flex justify-between">
            <span>Stock después</span>
            <strong className="tabular-nums">{product.stock + (quantity || 0)}</strong>
          </div>

          <button
            onClick={save}
            disabled={busy || quantity <= 0}
            className="w-full h-12 bg-[#059669] text-white rounded-xl font-semibold active:scale-[0.98] transition-transform disabled:opacity-40"
          >
            Registrar entrada
          </button>
        </div>
      </Sheet>
    </div>
  );
}

function LossSheet({
  product,
  onClose,
  onDone,
  onError,
}: {
  product: Product;
  onClose: () => void;
  onDone: (message: string, stock: number) => void;
  onError: (message: string) => void;
}) {
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState<string>(MERMA_REASONS[0]);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  useBackHandler(onClose);

  const save = async () => {
    setBusy(true);
    const res = await recordLoss({ productId: product.id!, quantity, reason, notes });
    setBusy(false);
    if (!res.ok) {
      if (res.error === 'sin-stock') {
        onError(`Solo quedan ${res.available}. No puedes dar de baja más de lo que hay.`);
      } else {
        onError('No se pudo registrar la merma');
      }
      return;
    }
    onDone(`Merma registrada. Stock: ${res.stock}`, res.stock!);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <Sheet title="Registrar merma" subtitle="Mercancía que sale del inventario sin venderse.">
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-[#475569] block mb-1">¿Cuántas?</label>
            <NumberField value={quantity} onChange={setQuantity} min={1} max={product.stock} />
            <p className="text-xs text-[#94A3B8] mt-1">Hay {product.stock} en existencia.</p>
          </div>

          <div>
            <label className="text-sm font-medium text-[#475569] block mb-1">¿Qué pasó?</label>
            <div className="flex flex-wrap gap-2">
              {MERMA_REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setReason(r)}
                  className={`px-3 py-2 rounded-full text-sm font-medium transition-colors ${
                    reason === r ? 'bg-[#D97706] text-white' : 'bg-white text-gray-600 border border-[#E2E8F0]'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-[#475569] block mb-1">Nota (opcional)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej. se mojó con la lluvia"
              className="w-full h-12 px-3 rounded-lg border border-[#E2E8F0] text-base focus:border-[#0F766E] outline-none"
            />
          </div>

          {product.type === 'consignment' && (
            <p className="text-xs text-[#92400E] bg-[#FEF3C7] border border-[#FDE68A] rounded-lg px-3 py-2">
              Este artículo es de {product.ownerName || 'un dueño'}. La merma no le cobra nada
              automáticamente: si acuerdan que se lo pagas, regístralo como pago en Dueños.
            </p>
          )}

          <div className="text-sm text-[#475569] bg-[#F1F5F9] rounded-lg px-3 py-2 flex justify-between">
            <span>Stock después</span>
            <strong className="tabular-nums">{Math.max(0, product.stock - (quantity || 0))}</strong>
          </div>

          <button
            onClick={save}
            disabled={busy || quantity <= 0 || quantity > product.stock}
            className="w-full h-12 bg-[#D97706] text-white rounded-xl font-semibold active:scale-[0.98] transition-transform disabled:opacity-40"
          >
            Registrar merma
          </button>
        </div>
      </Sheet>
    </div>
  );
}
