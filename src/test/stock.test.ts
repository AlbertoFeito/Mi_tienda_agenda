import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/lib/db';
import { TABLE_NAMES } from '@/lib/store';
import {
  MERMA_REASONS,
  applyMovement,
  movementsFor,
  recordEntry,
  recordLoss,
  summarize,
} from '@/lib/stock';
import type { Currency, Product } from '@/types';

const cup = (amount: number, _c: Currency) => amount; // CUP-only

async function wipeAll() {
  for (const table of TABLE_NAMES) {
    // @ts-expect-error indexed access over the db table map
    await db[table].clear();
  }
}

async function seedProduct(over: Partial<Product> = {}): Promise<number> {
  return db.products.add({
    name: 'Chancletas',
    category: 'Ropa',
    type: 'own',
    costPrice: 1000,
    salePrice: 1200,
    costCurrency: 'CUP',
    saleCurrency: 'CUP',
    stock: 10,
    minStock: 2,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  } as Product);
}

describe('applyMovement', () => {
  it('adds on the way in and subtracts on the way out', () => {
    expect(applyMovement(10, 'entrada', 5)).toBe(15);
    expect(applyMovement(10, 'merma', 4)).toBe(6);
  });
});

describe('recordEntry', () => {
  beforeEach(async () => {
    localStorage.clear();
    await wipeAll();
  });

  it('raises the stock and leaves a movement behind', async () => {
    const id = await seedProduct();
    const res = await recordEntry({ productId: id, quantity: 20, unitCost: 1100 });

    expect(res.ok).toBe(true);
    expect(res.stock).toBe(30);
    expect((await db.products.get(id))!.stock).toBe(30);

    const [mv] = await db.stockMovements.toArray();
    expect(mv).toMatchObject({ productId: id, type: 'entrada', quantity: 20, unitCost: 1100 });
    // The name is copied onto the movement so the history outlives the product.
    expect(mv.productName).toBe('Chancletas');
  });

  it('updates the reference cost price only when asked', async () => {
    const id = await seedProduct();

    await recordEntry({ productId: id, quantity: 5, unitCost: 1500, updateCost: false, toCUP: cup });
    expect((await db.products.get(id))!.costPrice).toBe(1000);

    await recordEntry({ productId: id, quantity: 5, unitCost: 1500, updateCost: true, toCUP: cup });
    expect((await db.products.get(id))!.costPrice).toBe(1500);
  });

  it('opens a batch that keeps its own price', async () => {
    const id = await seedProduct({ stock: 0 });
    await recordEntry({ productId: id, quantity: 20, unitCost: 1000, toCUP: cup });
    await recordEntry({ productId: id, quantity: 20, unitCost: 1500, toCUP: cup });

    const lots = (await db.stockLots.toArray()).sort((a, b) => a.id! - b.id!);
    expect(lots).toHaveLength(2);
    // Two batches, two prices. Nothing merged into a single figure.
    expect(lots.map((l) => l.unitCostCUP)).toEqual([1000, 1500]);
    expect(lots.map((l) => l.remaining)).toEqual([20, 20]);
  });

  it('converts the batch price at the rate of the day it arrived', async () => {
    const id = await seedProduct({ stock: 0 });
    const julio = (amount: number, c: string) => (c === 'USD' ? amount * 320 : amount);
    const agosto = (amount: number, c: string) => (c === 'USD' ? amount * 400 : amount);

    await recordEntry({ productId: id, quantity: 5, unitCost: 10, unitCurrency: 'USD', toCUP: julio });
    await recordEntry({ productId: id, quantity: 5, unitCost: 10, unitCurrency: 'USD', toCUP: agosto });

    const lots = (await db.stockLots.toArray()).sort((a, b) => a.id! - b.id!);
    // Ten dollars in July is not ten dollars in August.
    expect(lots.map((l) => l.unitCostCUP)).toEqual([3200, 4000]);
  });

  it('records the entry even with no price given', async () => {
    const id = await seedProduct();
    const res = await recordEntry({ productId: id, quantity: 3 });
    expect(res.ok).toBe(true);
    const [mv] = await db.stockMovements.toArray();
    expect(mv.unitCost).toBeUndefined();
    expect((await db.products.get(id))!.costPrice).toBe(1000);
  });

  it('refuses zero, negatives and nonsense', async () => {
    const id = await seedProduct();
    for (const q of [0, -5, NaN]) {
      const res = await recordEntry({ productId: id, quantity: q });
      expect(res.ok).toBe(false);
      expect(res.error).toBe('cantidad-invalida');
    }
    expect((await db.products.get(id))!.stock).toBe(10);
    expect(await db.stockMovements.count()).toBe(0);
  });

  it('refuses a product that no longer exists', async () => {
    const res = await recordEntry({ productId: 999, quantity: 5 });
    expect(res).toMatchObject({ ok: false, error: 'sin-producto' });
  });
});

describe('recordLoss', () => {
  beforeEach(async () => {
    localStorage.clear();
    await wipeAll();
  });

  it('lowers the stock and keeps the reason', async () => {
    const id = await seedProduct();
    const res = await recordLoss({ productId: id, quantity: 3, reason: 'Se rompió', toCUP: cup });

    expect(res.ok).toBe(true);
    expect(res.stock).toBe(7);
    expect((await db.products.get(id))!.stock).toBe(7);
    expect((await db.stockMovements.toArray())[0]).toMatchObject({
      type: 'merma',
      quantity: 3,
      reason: 'Se rompió',
    });
  });

  it('refuses to write off more than there is, and changes nothing', async () => {
    const id = await seedProduct({ stock: 4 });
    const res = await recordLoss({ productId: id, quantity: 5 });

    expect(res).toMatchObject({ ok: false, error: 'sin-stock', available: 4 });
    // A count that does not add up is stopped on, not smoothed over.
    expect((await db.products.get(id))!.stock).toBe(4);
    expect(await db.stockMovements.count()).toBe(0);
  });

  it('allows writing off everything that is left', async () => {
    const id = await seedProduct({ stock: 4 });
    const res = await recordLoss({ productId: id, quantity: 4 });
    expect(res.ok).toBe(true);
    expect((await db.products.get(id))!.stock).toBe(0);
  });

  it('offers reasons that cover the usual cases', () => {
    expect(MERMA_REASONS).toContain('Se rompió');
    expect(MERMA_REASONS).toContain('Se venció');
    expect(MERMA_REASONS).toContain('Uso personal');
  });
});

describe('entries and losses together', () => {
  beforeEach(async () => {
    localStorage.clear();
    await wipeAll();
  });

  it('leaves the stock where the movements say it should be', async () => {
    const id = await seedProduct({ stock: 0 });
    await recordEntry({ productId: id, quantity: 50, toCUP: cup });
    await recordLoss({ productId: id, quantity: 6, reason: 'Se venció', toCUP: cup });
    await recordEntry({ productId: id, quantity: 10, toCUP: cup });

    expect((await db.products.get(id))!.stock).toBe(54);

    const mine = movementsFor(await db.stockMovements.toArray(), id);
    expect(mine).toHaveLength(3);
    // Newest first, so the history reads top-down.
    expect(mine[0].quantity).toBe(10);
    expect(summarize(mine)).toEqual({ entradas: 60, mermas: 6 });
  });

  it('keeps the movements of each product apart', async () => {
    const a = await seedProduct({ name: 'A' });
    const b = await seedProduct({ name: 'B' });
    await recordEntry({ productId: a, quantity: 5, toCUP: cup });
    await recordLoss({ productId: b, quantity: 2, toCUP: cup });

    const all = await db.stockMovements.toArray();
    expect(movementsFor(all, a)).toHaveLength(1);
    expect(movementsFor(all, b)).toHaveLength(1);
    expect((await db.products.get(a))!.stock).toBe(15);
    expect((await db.products.get(b))!.stock).toBe(8);
  });

  it('survives a backup and restore', async () => {
    const id = await seedProduct();
    await recordEntry({ productId: id, quantity: 7, unitCost: 1200, toCUP: cup });
    const { exportData, importData } = await import('@/lib/db');

    const backup = await exportData();
    await wipeAll();
    await importData(backup);

    const restored = await db.stockMovements.toArray();
    expect(restored).toHaveLength(1);
    expect(restored[0]).toMatchObject({ type: 'entrada', quantity: 7, unitCost: 1200 });
    // The batches must come back too, or every cost would be lost on restore.
    expect(await db.stockLots.toArray()).toHaveLength(1);
  });

  it('writes off the oldest batch first, at the price of that batch', async () => {
    const id = await seedProduct({ stock: 0 });
    await recordEntry({ productId: id, quantity: 4, unitCost: 1000, toCUP: cup });
    await recordEntry({ productId: id, quantity: 4, unitCost: 1500, toCUP: cup });

    const res = await recordLoss({ productId: id, quantity: 6, reason: 'Se venció', toCUP: cup });

    // 4 at 1.000 plus 2 at 1.500.
    expect(res.costCUP).toBe(7000);
    const lots = (await db.stockLots.toArray()).sort((a, b) => a.id! - b.id!);
    expect(lots.map((l) => l.remaining)).toEqual([0, 2]);
  });
});

describe('a sale drawing on batches, and undoing it', () => {
  beforeEach(async () => {
    localStorage.clear();
    await wipeAll();
  });

  it('puts every unit back in the batch it came from', async () => {
    const { drawFromLots, lotsFor } = await import('@/lib/cost');
    const { cancelSale } = await import('@/lib/sales');
    const { consumeDraws } = await import('@/lib/stock');

    const id = await seedProduct({ stock: 0 });
    await recordEntry({ productId: id, quantity: 4, unitCost: 1000, toCUP: cup });
    await recordEntry({ productId: id, quantity: 4, unitCost: 1500, toCUP: cup });

    // Sell 6: four out of the old batch, two out of the new one.
    const open = lotsFor(await db.stockLots.toArray(), id);
    const { draws, costCUP } = drawFromLots(open, 6, 0);
    expect(costCUP).toBe(7000);

    await consumeDraws(draws);
    await db.products.update(id, { stock: 2 });
    const saleId = await db.sales.add({
      items: [{
        productId: id, productName: 'Chancletas', quantity: 6,
        unitPrice: 2000, unitCurrency: 'CUP', subtotal: 12_000,
        costCUP, lots: draws,
      }],
      total: 12_000, currency: 'CUP', paymentMethod: 'cash', discount: 0,
      createdAt: new Date(), receiptNumber: 'VT-1',
    });

    const spent = (await db.stockLots.toArray()).sort((a, b) => a.id! - b.id!);
    expect(spent.map((l) => l.remaining)).toEqual([0, 2]);

    const res = await cancelSale(saleId);
    expect(res.ok).toBe(true);

    const back = (await db.stockLots.toArray()).sort((a, b) => a.id! - b.id!);
    // Each batch whole again — not four units dumped into whichever came first.
    expect(back.map((l) => l.remaining)).toEqual([4, 4]);
    expect((await db.products.get(id))!.stock).toBe(8);
  });

  it('never puts back more than a batch ever held', async () => {
    const { restoreDraws } = await import('@/lib/stock');
    const id = await seedProduct({ stock: 0 });
    await recordEntry({ productId: id, quantity: 3, unitCost: 1000, toCUP: cup });
    const lotId = (await db.stockLots.toArray())[0].id!;

    await restoreDraws([{ lotId, quantity: 99, unitCostCUP: 1000 }]);
    expect((await db.stockLots.get(lotId))!.remaining).toBe(3);
  });
});
