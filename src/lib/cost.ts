import type { Currency, Product, SaleItem, StockLot } from '@/types';

/**
 * What a unit actually costs, when every batch came in different.
 *
 * A product carried one `costPrice` in one currency, which could not answer any
 * of the real questions: twenty bought at 1.000 and twenty more at 1.500 are
 * not the same cost, and ten dollars in July is not ten dollars in August.
 *
 * So each entry keeps its own batch, converted to CUP on the day it arrived,
 * and a sale draws from the oldest batch first — the goods that came in first
 * are the ones that leave first. No averaging: each unit is costed at what that
 * particular batch cost, and the sale writes that figure down for good.
 */

export type ToCUP = (amount: number, currency: Currency) => number;

/** Units taken out of one batch, and what they cost. */
export interface LotDraw {
  /** Undefined for stock that predates batches, valued at the reference cost. */
  lotId?: number;
  quantity: number;
  unitCostCUP: number;
}

export interface DrawResult {
  draws: LotDraw[];
  /** Total cost in CUP of everything drawn. */
  costCUP: number;
  /** Units that no batch could cover, valued at the fallback cost. */
  uncovered: number;
}

/** Batches of a product, oldest first — the order they get consumed in. */
export function lotsFor(lots: StockLot[], productId: number): StockLot[] {
  return lots
    .filter((l) => l.productId === productId && l.remaining > 0)
    .sort((a, b) => {
      const byTime = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return byTime !== 0 ? byTime : (a.id ?? 0) - (b.id ?? 0);
    });
}

/**
 * Take `quantity` units from the oldest batches first.
 *
 * Anything the batches cannot cover — stock that was already there before this
 * existed — is valued at `fallbackCostCUP`, so the figures never silently drop
 * to zero just because a batch is missing.
 */
export function drawFromLots(
  lots: StockLot[],
  quantity: number,
  fallbackCostCUP: number,
): DrawResult {
  const draws: LotDraw[] = [];
  let left = quantity;
  let costCUP = 0;

  for (const lot of lots) {
    if (left <= 0) break;
    const take = Math.min(lot.remaining, left);
    if (take <= 0) continue;
    draws.push({ lotId: lot.id, quantity: take, unitCostCUP: lot.unitCostCUP });
    costCUP += take * lot.unitCostCUP;
    left -= take;
  }

  if (left > 0) {
    draws.push({ quantity: left, unitCostCUP: fallbackCostCUP });
    costCUP += left * fallbackCostCUP;
  }

  return { draws, costCUP: round2(costCUP), uncovered: Math.max(0, left) };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** The reference cost in CUP, for stock with no batch behind it. */
export function referenceCostCUP(product: Product, toCUP: ToCUP): number {
  return toCUP(product.costPrice, product.costCurrency);
}

/**
 * What a sold line cost, in CUP.
 *
 * Uses the cost written down when the sale happened. Sales recorded before that
 * existed have none, so they fall back to today's figures — the rate of that day
 * was never stored and cannot be invented.
 */
export function lineCostCUP(item: SaleItem, product: Product | undefined, toCUP: ToCUP): number {
  if (item.costCUP !== undefined) return item.costCUP;
  if (!product) return 0;
  return referenceCostCUP(product, toCUP) * item.quantity;
}

/** Profit of a sold line in CUP: what came in, less what it cost. */
export function lineProfitCUP(item: SaleItem, product: Product | undefined, toCUP: ToCUP): number {
  return item.subtotal - lineCostCUP(item, product, toCUP);
}

/** Name plus brand, for the places where a bare name would be ambiguous. */
export function describeProduct(p: { name: string; brand?: string }): string {
  const brand = p.brand?.trim();
  return brand ? `${p.name} · ${brand}` : p.name;
}

/** The spread of costs still in stock, for showing what a product costs today. */
export function costRange(lots: StockLot[]): { min: number; max: number } | null {
  const open = lots.filter((l) => l.remaining > 0);
  if (!open.length) return null;
  const costs = open.map((l) => l.unitCostCUP);
  return { min: Math.min(...costs), max: Math.max(...costs) };
}
