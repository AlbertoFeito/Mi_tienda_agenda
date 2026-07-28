import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db } from '@/lib/db';
import { TABLE_NAMES } from '@/lib/store';
import { activeSales, canCancel, cancelSale, isActive } from '@/lib/sales';
import { computeOwners } from '@/lib/owners';
import type { Currency, Product, Sale } from '@/types';

// The notifications reschedule is a no-op off-device, but stub it so the tests
// never depend on the Capacitor bridge.
vi.mock('@/lib/reminders', () => ({ syncReminders: vi.fn().mockResolvedValue(undefined) }));

const cup = (amount: number, _c: Currency) => amount;

async function wipeAll() {
  for (const table of TABLE_NAMES) {
    // @ts-expect-error indexed access over the db table map
    await db[table].clear();
  }
}

async function addProduct(over: Partial<Product> = {}): Promise<number> {
  return db.products.add({
    name: 'Chancletas',
    category: 'Ropa',
    type: 'consignment',
    costPrice: 1000,
    salePrice: 1200,
    costCurrency: 'CUP',
    saleCurrency: 'CUP',
    stock: 10,
    minStock: 2,
    ownerName: 'Yeni',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  } as Product);
}

/** Mirrors what the checkout does: record the sale and take the stock out. */
async function sell(productId: number, qty: number, over: Partial<Sale> = {}): Promise<number> {
  const product = await db.products.get(productId);
  const saleId = await db.sales.add({
    items: [
      {
        productId,
        productName: product!.name,
        quantity: qty,
        unitPrice: product!.salePrice,
        unitCurrency: 'CUP',
        subtotal: product!.salePrice * qty,
      },
    ],
    total: product!.salePrice * qty,
    currency: 'CUP',
    paymentMethod: 'cash',
    discount: 0,
    createdAt: new Date(),
    receiptNumber: `VT-TEST-${Date.now()}`,
    ...over,
  } as Sale);
  await db.products.update(productId, { stock: product!.stock - qty });
  return saleId;
}

describe('activeSales / isActive', () => {
  it('counts sales with no status, so old records keep working', () => {
    const legacy = { total: 100 } as Sale;
    expect(isActive(legacy)).toBe(true);
    expect(activeSales([legacy])).toHaveLength(1);
  });

  it('drops the cancelled ones', () => {
    const list = [{ total: 1 } as Sale, { total: 2, status: 'cancelled' } as Sale];
    expect(activeSales(list)).toHaveLength(1);
  });
});

describe('cancelSale', () => {
  beforeEach(async () => {
    localStorage.clear();
    await wipeAll();
  });

  it('gives back exactly the stock the sale took', async () => {
    const productId = await addProduct({ stock: 10 });
    const saleId = await sell(productId, 3);
    expect((await db.products.get(productId))!.stock).toBe(7);

    const res = await cancelSale(saleId);
    expect(res.ok).toBe(true);
    expect((await db.products.get(productId))!.stock).toBe(10);
  });

  it('marks the sale instead of deleting it', async () => {
    const productId = await addProduct();
    const saleId = await sell(productId, 1);

    await cancelSale(saleId, 'me equivoqué de producto');

    const sale = await db.sales.get(saleId);
    expect(sale).toBeDefined();
    expect(sale!.status).toBe('cancelled');
    expect(sale!.cancelledAt).toBeDefined();
    expect(sale!.cancelReason).toBe('me equivoqué de producto');
  });

  it('cancelling twice does not hand back the stock twice', async () => {
    const productId = await addProduct({ stock: 10 });
    const saleId = await sell(productId, 4);

    await cancelSale(saleId);
    const second = await cancelSale(saleId);

    expect(second.ok).toBe(false);
    expect(second.block).toBe('ya-anulada');
    expect((await db.products.get(productId))!.stock).toBe(10);
  });

  it('reports a deleted product instead of failing the whole cancellation', async () => {
    const keep = await addProduct({ name: 'Aceite', stock: 5 });
    const gone = await addProduct({ name: 'Borrado', stock: 5 });
    const saleId = await sell(keep, 2);
    // Second item, whose product is deleted before cancelling.
    const sale = await db.sales.get(saleId);
    sale!.items.push({
      productId: gone,
      productName: 'Borrado',
      quantity: 1,
      unitPrice: 100,
      unitCurrency: 'CUP',
      subtotal: 100,
    });
    await db.sales.update(saleId, { items: sale!.items });
    await db.products.delete(gone);

    const res = await cancelSale(saleId);

    expect(res.ok).toBe(true);
    expect(res.missingProducts).toBe(1);
    expect((await db.products.get(keep))!.stock).toBe(5); // el resto sí volvió
  });

  it('refuses a sale that does not exist', async () => {
    expect((await cancelSale(999)).block).toBe('no-existe');
  });
});

describe('cancelSale with instalments', () => {
  beforeEach(async () => {
    localStorage.clear();
    await wipeAll();
  });

  async function sellOnCredit(productId: number, qty: number) {
    const saleId = await sell(productId, qty, { paymentMethod: 'installment', customerId: 1 });
    const instId = await db.installments.add({
      saleId,
      customerId: 1,
      customerName: 'Ana',
      totalAmount: 1200 * qty,
      paidAmount: 0,
      remainingAmount: 1200 * qty,
      numberOfPayments: 4,
      frequency: 'weekly',
      startDate: new Date(),
      status: 'active',
      createdAt: new Date(),
    });
    return { saleId, instId };
  }

  it('cancels the debt when nothing has been collected yet', async () => {
    const productId = await addProduct({ stock: 10 });
    const { saleId, instId } = await sellOnCredit(productId, 2);

    const res = await cancelSale(saleId);

    expect(res.ok).toBe(true);
    expect((await db.installments.get(instId))!.status).toBe('cancelled');
    expect((await db.products.get(productId))!.stock).toBe(10);
  });

  it('refuses once any payment has come in — that money was real', async () => {
    const productId = await addProduct({ stock: 10 });
    const { saleId, instId } = await sellOnCredit(productId, 2);
    await db.installmentPayments.add({
      installmentId: instId,
      amount: 600,
      paymentDate: new Date(),
      paymentMethod: 'cash',
      createdAt: new Date(),
    });

    const res = await cancelSale(saleId);

    expect(res.ok).toBe(false);
    expect(res.block).toBe('tiene-cobros');
    expect(res.collected).toBe(600);
  });

  it('touches absolutely nothing when it refuses', async () => {
    const productId = await addProduct({ stock: 10 });
    const { saleId, instId } = await sellOnCredit(productId, 2);
    await db.installmentPayments.add({
      installmentId: instId,
      amount: 600,
      paymentDate: new Date(),
      paymentMethod: 'cash',
      createdAt: new Date(),
    });

    await cancelSale(saleId);

    expect((await db.products.get(productId))!.stock).toBe(8); // sin devolver
    expect((await db.installments.get(instId))!.status).toBe('active');
    expect((await db.sales.get(saleId))!.status).toBeUndefined();
  });
});

describe('canCancel', () => {
  it('reports how much was already collected', () => {
    const sale = { id: 1 } as Sale;
    const installments = [{ id: 7, saleId: 1 }] as never;
    const payments = [
      { installmentId: 7, amount: 300 },
      { installmentId: 7, amount: 200 },
    ] as never;
    const check = canCancel(sale, installments, payments);
    expect(check.ok).toBe(false);
    expect(check.collected).toBe(500);
  });

  it('lets a cash sale through', () => {
    expect(canCancel({ id: 1 } as Sale, [], []).ok).toBe(true);
  });
});

describe('a cancelled sale stops counting everywhere', () => {
  const product: Product = {
    id: 1,
    name: 'Chancletas',
    category: 'Ropa',
    type: 'consignment',
    costPrice: 1000,
    salePrice: 1200,
    costCurrency: 'CUP',
    saleCurrency: 'CUP',
    stock: 8,
    minStock: 0,
    ownerName: 'Yeni',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const sale = (over: Partial<Sale>): Sale =>
    ({
      id: 1,
      items: [
        { productId: 1, productName: 'Chancletas', quantity: 2, unitPrice: 1200, unitCurrency: 'CUP', subtotal: 2400 },
      ],
      total: 2400,
      currency: 'CUP',
      paymentMethod: 'cash',
      discount: 0,
      createdAt: new Date(),
      receiptNumber: 'VT-1',
      ...over,
    }) as Sale;

  it('the owner is no longer owed for it', () => {
    const [before] = computeOwners([product], [sale({})], [], cup);
    expect(before.totalOwed).toBe(2000);

    const [after] = computeOwners([product], [sale({ status: 'cancelled' })], [], cup);
    expect(after.totalOwed).toBe(0);
    expect(after.balance).toBe(0);
  });

  it('an owner already paid ends up in credit, not "all square"', () => {
    // She settled 2,000 with Yeni and then cancelled the sale behind it.
    const payments = [{ ownerName: 'Yeni', amount: 2000, createdAt: new Date() }];
    const [owner] = computeOwners([product], [sale({ status: 'cancelled' })], payments, cup);
    expect(owner.totalPaid).toBe(2000);
    expect(owner.balance).toBe(-2000);
  });

  it('drops out of the day totals', () => {
    const list = [sale({}), sale({ id: 2, status: 'cancelled' })];
    const total = activeSales(list).reduce((sum, s) => sum + s.total, 0);
    expect(total).toBe(2400);
  });
});

describe('receipt numbers', () => {
  beforeEach(async () => {
    localStorage.clear();
    await wipeAll();
  });

  it('are not reused after a cancellation', async () => {
    const { generateReceiptNumber } = await import('@/lib/db');
    const productId = await addProduct();
    const saleId = await sell(productId, 1);
    const first = await db.sales.get(saleId);

    await cancelSale(saleId);
    const next = await generateReceiptNumber();

    // The cancelled sale still occupies its number, so the next one moves on.
    expect(next).not.toBe(first!.receiptNumber);
    expect(next).toMatch(/^VT-\d{8}-\d{3}$/);
  });
});
