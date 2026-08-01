import { db } from '@/lib/db';
import { drawFromLots, lotsFor, referenceCostCUP, type ToCUP } from '@/lib/cost';
import type { Currency, SaleItemLot, StockMovement, StockMovementType } from '@/types';

/**
 * Stock that moves without a sale behind it.
 *
 * Two things were missing and both made the inventory lie. Restocking meant
 * typing a new number over the old one, so there was no record of what came in,
 * when, or at what price. And a broken or expired item had no way out of the
 * count at all — the only way to remove it was to fake a sale, which then
 * showed up as income that never existed.
 *
 * Every change goes through here, so the stock figure always has a movement
 * explaining it.
 */

/** The usual reasons something leaves the shelf without being sold. */
export const MERMA_REASONS = [
  'Se rompió',
  'Se venció',
  'Se perdió',
  'Uso personal',
  'Regalo',
  'Otro',
] as const;

export interface MovementResult {
  ok: boolean;
  /** Why it was refused, when it was. */
  error?: 'sin-producto' | 'cantidad-invalida' | 'sin-stock';
  /** Stock the product ended up with. */
  stock?: number;
  /** The batch this entry opened. */
  lotId?: number;
  /** What a write-off cost, from the batches it consumed. */
  costCUP?: number;
  /** Stock available, when the write-off asked for more than there is. */
  available?: number;
}

/** Where the stock lands after a movement. Entries add, write-offs subtract. */
export function applyMovement(stock: number, type: StockMovementType, quantity: number): number {
  return type === 'entrada' ? stock + quantity : stock - quantity;
}

export interface EntryInput {
  productId: number;
  quantity: number;
  /** What each unit cost this time. Left out when she does not want to record it. */
  unitCost?: number;
  unitCurrency?: Currency;
  /**
   * Whether this price also becomes the product's reference cost price, used
   * for stock that has no batch behind it.
   */
  updateCost?: boolean;
  notes?: string;
  /** Converts the entry cost to CUP at today's rate. */
  toCUP?: ToCUP;
}

/** Goods arriving: more stock, and the record of what they cost. */
export async function recordEntry(input: EntryInput): Promise<MovementResult> {
  const { productId, quantity, unitCost, unitCurrency, updateCost, notes, toCUP } = input;

  if (!Number.isFinite(quantity) || quantity <= 0) {
    return { ok: false, error: 'cantidad-invalida' };
  }

  const product = await db.products.get(productId);
  if (!product?.id) return { ok: false, error: 'sin-producto' };

  const stock = applyMovement(product.stock, 'entrada', quantity);
  const currency = unitCurrency ?? product.costCurrency;
  const hasCost = Boolean(unitCost && unitCost > 0);

  // Converted here and now: the rate of the day this batch arrived is the only
  // one that describes what it cost, and tomorrow's would rewrite history.
  const unitCostCUP =
    hasCost && toCUP
      ? toCUP(unitCost!, currency)
      : toCUP
        ? referenceCostCUP(product, toCUP)
        : product.costPrice;

  let lotId: number | undefined;

  await db.transaction('rw', db.products, db.stockMovements, db.stockLots, async () => {
    // Its own batch, with its own price: this is what keeps twenty bought
    // before the dollar moved apart from twenty bought after.
    lotId = await db.stockLots.add({
      productId: product.id!,
      productName: product.name,
      quantity,
      remaining: quantity,
      unitCost: hasCost ? unitCost : undefined,
      unitCurrency: hasCost ? currency : undefined,
      unitCostCUP,
      notes: notes?.trim() || undefined,
      createdAt: new Date(),
    });

    await db.stockMovements.add({
      productId: product.id!,
      productName: product.name,
      type: 'entrada',
      quantity,
      unitCost: hasCost ? unitCost : undefined,
      unitCurrency: hasCost ? currency : undefined,
      unitCostCUP,
      lotId,
      notes: notes?.trim() || undefined,
      createdAt: new Date(),
    });

    await db.products.update(product.id!, {
      stock,
      ...(updateCost && hasCost ? { costPrice: unitCost, costCurrency: currency } : {}),
      updatedAt: new Date(),
    });
  });

  return { ok: true, stock, lotId };
}

export interface LossInput {
  productId: number;
  quantity: number;
  reason?: string;
  notes?: string;
  /** Values the units that no batch covers. */
  toCUP?: ToCUP;
}

/**
 * Goods written off: less stock, and the reason why.
 *
 * Refused outright when it asks for more than there is, rather than clamping to
 * zero: a count that does not add up is worth stopping on, not smoothing over.
 */
export async function recordLoss(input: LossInput): Promise<MovementResult> {
  const { productId, quantity, reason, notes, toCUP } = input;

  if (!Number.isFinite(quantity) || quantity <= 0) {
    return { ok: false, error: 'cantidad-invalida' };
  }

  const product = await db.products.get(productId);
  if (!product?.id) return { ok: false, error: 'sin-producto' };

  if (quantity > product.stock) {
    return { ok: false, error: 'sin-stock', available: product.stock };
  }

  const stock = applyMovement(product.stock, 'merma', quantity);

  // A write-off comes out of the oldest batches too, so what was lost is
  // costed at what those particular units cost.
  const open = lotsFor(await db.stockLots.toArray(), product.id);
  const fallback = toCUP ? referenceCostCUP(product, toCUP) : product.costPrice;
  const { draws, costCUP } = drawFromLots(open, quantity, fallback);

  await db.transaction('rw', db.products, db.stockMovements, db.stockLots, async () => {
    await consumeDraws(draws);

    await db.stockMovements.add({
      productId: product.id!,
      productName: product.name,
      type: 'merma',
      quantity,
      reason: reason?.trim() || undefined,
      notes: notes?.trim() || undefined,
      lots: draws,
      costCUP,
      createdAt: new Date(),
    });

    await db.products.update(product.id!, { stock, updatedAt: new Date() });
  });

  return { ok: true, stock, costCUP };
}

/** Subtract the drawn units from each batch they came out of. */
export async function consumeDraws(draws: SaleItemLot[]): Promise<void> {
  for (const d of draws) {
    if (d.lotId == null) continue;
    const lot = await db.stockLots.get(d.lotId);
    if (!lot?.id) continue;
    await db.stockLots.update(lot.id, { remaining: Math.max(0, lot.remaining - d.quantity) });
  }
}

/** Put units back into the batches they came from, when a sale is undone. */
export async function restoreDraws(draws: SaleItemLot[]): Promise<void> {
  for (const d of draws) {
    if (d.lotId == null) continue;
    const lot = await db.stockLots.get(d.lotId);
    if (!lot?.id) continue;
    await db.stockLots.update(lot.id, {
      remaining: Math.min(lot.quantity, lot.remaining + d.quantity),
    });
  }
}

/**
 * A product's movements, newest first.
 *
 * Two movements registered in the same millisecond carry the same timestamp, so
 * ties fall back to the id — the later insert has the higher one.
 */
export function movementsFor(movements: StockMovement[], productId: number): StockMovement[] {
  return movements
    .filter((m) => m.productId === productId)
    .sort((a, b) => {
      const byTime = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return byTime !== 0 ? byTime : (b.id ?? 0) - (a.id ?? 0);
    });
}

/** Units in and units written off over a set of movements. */
export function summarize(movements: StockMovement[]): { entradas: number; mermas: number } {
  return movements.reduce(
    (acc, m) => {
      if (m.type === 'entrada') acc.entradas += m.quantity;
      else acc.mermas += m.quantity;
      return acc;
    },
    { entradas: 0, mermas: 0 },
  );
}
