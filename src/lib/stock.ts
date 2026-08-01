import { db } from '@/lib/db';
import type { Currency, StockMovement, StockMovementType } from '@/types';

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
   * Whether this price becomes the product's cost price from now on. Prices
   * move constantly, so a stale cost quietly makes every margin wrong.
   */
  updateCost?: boolean;
  notes?: string;
}

/** Goods arriving: more stock, and the record of what they cost. */
export async function recordEntry(input: EntryInput): Promise<MovementResult> {
  const { productId, quantity, unitCost, unitCurrency, updateCost, notes } = input;

  if (!Number.isFinite(quantity) || quantity <= 0) {
    return { ok: false, error: 'cantidad-invalida' };
  }

  const product = await db.products.get(productId);
  if (!product?.id) return { ok: false, error: 'sin-producto' };

  const stock = applyMovement(product.stock, 'entrada', quantity);

  await db.transaction('rw', db.products, db.stockMovements, async () => {
    await db.stockMovements.add({
      productId: product.id!,
      productName: product.name,
      type: 'entrada',
      quantity,
      unitCost: unitCost && unitCost > 0 ? unitCost : undefined,
      unitCurrency: unitCost && unitCost > 0 ? (unitCurrency ?? product.costCurrency) : undefined,
      notes: notes?.trim() || undefined,
      createdAt: new Date(),
    });

    await db.products.update(product.id!, {
      stock,
      ...(updateCost && unitCost && unitCost > 0
        ? { costPrice: unitCost, costCurrency: unitCurrency ?? product.costCurrency }
        : {}),
      updatedAt: new Date(),
    });
  });

  return { ok: true, stock };
}

export interface LossInput {
  productId: number;
  quantity: number;
  reason?: string;
  notes?: string;
}

/**
 * Goods written off: less stock, and the reason why.
 *
 * Refused outright when it asks for more than there is, rather than clamping to
 * zero: a count that does not add up is worth stopping on, not smoothing over.
 */
export async function recordLoss(input: LossInput): Promise<MovementResult> {
  const { productId, quantity, reason, notes } = input;

  if (!Number.isFinite(quantity) || quantity <= 0) {
    return { ok: false, error: 'cantidad-invalida' };
  }

  const product = await db.products.get(productId);
  if (!product?.id) return { ok: false, error: 'sin-producto' };

  if (quantity > product.stock) {
    return { ok: false, error: 'sin-stock', available: product.stock };
  }

  const stock = applyMovement(product.stock, 'merma', quantity);

  await db.transaction('rw', db.products, db.stockMovements, async () => {
    await db.stockMovements.add({
      productId: product.id!,
      productName: product.name,
      type: 'merma',
      quantity,
      reason: reason?.trim() || undefined,
      notes: notes?.trim() || undefined,
      createdAt: new Date(),
    });

    await db.products.update(product.id!, { stock, updatedAt: new Date() });
  });

  return { ok: true, stock };
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
