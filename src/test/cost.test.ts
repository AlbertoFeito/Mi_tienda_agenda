import { describe, it, expect } from 'vitest';
import {
  costRange,
  describeProduct,
  drawFromLots,
  lineCostCUP,
  lineProfitCUP,
  lotsFor,
  referenceCostCUP,
} from '@/lib/cost';
import type { Product, SaleItem, StockLot } from '@/types';

function lot(over: Partial<StockLot> = {}): StockLot {
  return {
    id: 1,
    productId: 1,
    productName: 'Aceite',
    quantity: 20,
    remaining: 20,
    unitCostCUP: 1000,
    createdAt: new Date('2026-07-01'),
    ...over,
  };
}

function product(over: Partial<Product> = {}): Product {
  return {
    id: 1,
    name: 'Aceite',
    category: 'Comida',
    type: 'own',
    costPrice: 900,
    salePrice: 1300,
    costCurrency: 'CUP',
    saleCurrency: 'CUP',
    stock: 40,
    minStock: 2,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  };
}

const cup = (amount: number) => amount; // CUP-only, rates untouched

describe('lotsFor', () => {
  it('gives the batches oldest first, skipping the spent ones', () => {
    const lots = [
      lot({ id: 3, createdAt: new Date('2026-07-20') }),
      lot({ id: 1, createdAt: new Date('2026-07-01') }),
      lot({ id: 2, createdAt: new Date('2026-07-10'), remaining: 0 }),
    ];
    expect(lotsFor(lots, 1).map((l) => l.id)).toEqual([1, 3]);
  });

  it('breaks ties on the id, for batches entered the same instant', () => {
    const same = new Date('2026-07-01');
    const lots = [lot({ id: 5, createdAt: same }), lot({ id: 4, createdAt: same })];
    expect(lotsFor(lots, 1).map((l) => l.id)).toEqual([4, 5]);
  });

  it('leaves other products alone', () => {
    expect(lotsFor([lot({ productId: 99 })], 1)).toHaveLength(0);
  });
});

describe('drawFromLots', () => {
  it('takes from a single batch when it covers the sale', () => {
    const res = drawFromLots([lot({ remaining: 20, unitCostCUP: 1000 })], 5, 0);
    expect(res.draws).toEqual([{ lotId: 1, quantity: 5, unitCostCUP: 1000 }]);
    expect(res.costCUP).toBe(5000);
    expect(res.uncovered).toBe(0);
  });

  it('spans batches, each unit at the price of its own batch', () => {
    // The point of the whole thing: 20 bought at 1.000, 20 more at 1.500.
    const lots = [
      lot({ id: 1, remaining: 20, unitCostCUP: 1000, createdAt: new Date('2026-07-01') }),
      lot({ id: 2, remaining: 20, unitCostCUP: 1500, createdAt: new Date('2026-08-01') }),
    ];
    const res = drawFromLots(lots, 25, 0);

    expect(res.draws).toEqual([
      { lotId: 1, quantity: 20, unitCostCUP: 1000 },
      { lotId: 2, quantity: 5, unitCostCUP: 1500 },
    ]);
    // 20 × 1.000 + 5 × 1.500 — not 25 × any average.
    expect(res.costCUP).toBe(27_500);
  });

  it('empties the oldest batch before touching the next', () => {
    const lots = [
      lot({ id: 1, remaining: 3, unitCostCUP: 1000, createdAt: new Date('2026-07-01') }),
      lot({ id: 2, remaining: 10, unitCostCUP: 1500, createdAt: new Date('2026-08-01') }),
    ];
    const res = drawFromLots(lots, 4, 0);
    expect(res.draws).toEqual([
      { lotId: 1, quantity: 3, unitCostCUP: 1000 },
      { lotId: 2, quantity: 1, unitCostCUP: 1500 },
    ]);
    expect(res.costCUP).toBe(4500);
  });

  it('values what no batch covers at the reference cost', () => {
    // Stock that was already there before batches existed.
    const res = drawFromLots([lot({ remaining: 2, unitCostCUP: 1000 })], 5, 900);
    expect(res.draws).toEqual([
      { lotId: 1, quantity: 2, unitCostCUP: 1000 },
      { quantity: 3, unitCostCUP: 900 },
    ]);
    expect(res.costCUP).toBe(4700);
    expect(res.uncovered).toBe(3);
  });

  it('falls back entirely when there are no batches at all', () => {
    const res = drawFromLots([], 4, 900);
    expect(res.draws).toEqual([{ quantity: 4, unitCostCUP: 900 }]);
    expect(res.costCUP).toBe(3600);
    expect(res.uncovered).toBe(4);
  });

  it('never draws anything for a quantity of zero', () => {
    expect(drawFromLots([lot()], 0, 900).draws).toEqual([]);
    expect(drawFromLots([lot()], 0, 900).costCUP).toBe(0);
  });
});

describe('lineCostCUP / lineProfitCUP', () => {
  const item = (over: Partial<SaleItem> = {}): SaleItem => ({
    productId: 1,
    productName: 'Aceite',
    quantity: 5,
    unitPrice: 1300,
    unitCurrency: 'CUP',
    subtotal: 6500,
    ...over,
  });

  it('uses the cost written down at the time of the sale', () => {
    const sold = item({ costCUP: 5200 });
    expect(lineCostCUP(sold, product(), cup)).toBe(5200);
    expect(lineProfitCUP(sold, product(), cup)).toBe(1300);
  });

  it('ignores what the product costs today', () => {
    const sold = item({ costCUP: 5200 });
    // The reference price tripling must not touch a sale already made.
    expect(lineCostCUP(sold, product({ costPrice: 3000 }), cup)).toBe(5200);
  });

  it('falls back to the reference cost for sales made before batches existed', () => {
    const old = item(); // no costCUP
    expect(lineCostCUP(old, product({ costPrice: 900 }), cup)).toBe(4500);
  });

  it('costs nothing it cannot value, rather than guessing', () => {
    expect(lineCostCUP(item(), undefined, cup)).toBe(0);
  });
});

describe('referenceCostCUP', () => {
  it('converts the reference price into CUP', () => {
    const toCUP = (amount: number, currency: string) => (currency === 'USD' ? amount * 320 : amount);
    expect(referenceCostCUP(product({ costPrice: 10, costCurrency: 'USD' }), toCUP)).toBe(3200);
  });
});

describe('costRange', () => {
  it('shows the spread still sitting in stock', () => {
    const lots = [lot({ unitCostCUP: 1000 }), lot({ id: 2, unitCostCUP: 1500 })];
    expect(costRange(lots)).toEqual({ min: 1000, max: 1500 });
  });

  it('is null once every batch is spent', () => {
    expect(costRange([lot({ remaining: 0 })])).toBeNull();
  });
});

describe('describeProduct', () => {
  it('adds the brand when there is one', () => {
    expect(describeProduct({ name: 'Aceite', brand: 'Sabroso' })).toBe('Aceite · Sabroso');
    expect(describeProduct({ name: 'Aceite' })).toBe('Aceite');
    expect(describeProduct({ name: 'Aceite', brand: '  ' })).toBe('Aceite');
  });
});
