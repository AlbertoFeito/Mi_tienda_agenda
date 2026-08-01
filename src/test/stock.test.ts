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
import type { Product } from '@/types';

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

  it('updates the cost price only when asked', async () => {
    const id = await seedProduct();

    await recordEntry({ productId: id, quantity: 5, unitCost: 1500, updateCost: false });
    expect((await db.products.get(id))!.costPrice).toBe(1000);

    await recordEntry({ productId: id, quantity: 5, unitCost: 1500, updateCost: true });
    expect((await db.products.get(id))!.costPrice).toBe(1500);
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
    const res = await recordLoss({ productId: id, quantity: 3, reason: 'Se rompió' });

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
    await recordEntry({ productId: id, quantity: 50 });
    await recordLoss({ productId: id, quantity: 6, reason: 'Se venció' });
    await recordEntry({ productId: id, quantity: 10 });

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
    await recordEntry({ productId: a, quantity: 5 });
    await recordLoss({ productId: b, quantity: 2 });

    const all = await db.stockMovements.toArray();
    expect(movementsFor(all, a)).toHaveLength(1);
    expect(movementsFor(all, b)).toHaveLength(1);
    expect((await db.products.get(a))!.stock).toBe(15);
    expect((await db.products.get(b))!.stock).toBe(8);
  });

  it('survives a backup and restore', async () => {
    const id = await seedProduct();
    await recordEntry({ productId: id, quantity: 7, unitCost: 1200 });
    const { exportData, importData } = await import('@/lib/db');

    const backup = await exportData();
    await wipeAll();
    await importData(backup);

    const restored = await db.stockMovements.toArray();
    expect(restored).toHaveLength(1);
    expect(restored[0]).toMatchObject({ type: 'entrada', quantity: 7, unitCost: 1200 });
  });
});
