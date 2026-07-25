import { describe, it, expect } from 'vitest';
import { computeOwners } from '@/lib/owners';
import type { Product, Sale, OwnerPayment, Currency } from '@/types';

const cup = (amount: number, _currency: Currency) => amount; // CUP-only test

function product(over: Partial<Product> = {}): Product {
  return {
    id: 1,
    name: 'Artículo',
    category: 'General',
    type: 'consignment',
    costPrice: 100,
    salePrice: 150,
    costCurrency: 'CUP',
    saleCurrency: 'CUP',
    stock: 3,
    minStock: 0,
    ownerName: 'Juan',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  };
}

function sale(items: Sale['items']): Sale {
  return {
    id: 1,
    items,
    total: items.reduce((s, i) => s + i.subtotal, 0),
    currency: 'CUP',
    paymentMethod: 'cash',
    discount: 0,
    createdAt: new Date(),
    receiptNumber: 'VT-1',
  };
}

describe('computeOwners (consignment settlement)', () => {
  it('computes owed, profit and balance for an owner', () => {
    const products = [product({ id: 1, stock: 1 })]; // 1 remaining
    const sales = [
      sale([{ productId: 1, productName: 'Artículo', quantity: 2, unitPrice: 150, unitCurrency: 'CUP', subtotal: 300 }]),
    ];
    const payments: OwnerPayment[] = [{ ownerName: 'Juan', amount: 100, createdAt: new Date() }];

    const [owner] = computeOwners(products, sales, payments, cup);
    expect(owner.ownerName).toBe('Juan');
    expect(owner.totalOwed).toBe(200); // 100 cost * 2 sold
    expect(owner.profit).toBe(100); // (150-100) * 2
    expect(owner.totalPaid).toBe(100);
    expect(owner.balance).toBe(100); // 200 owed - 100 paid
    expect(owner.activeProducts).toBe(1); // 1 still in stock
  });

  it('ignores own (non-consignment) products', () => {
    const products = [product({ id: 1, type: 'own' })];
    expect(computeOwners(products, [], [], cup)).toHaveLength(0);
  });

  it('groups consignment products without an owner under "Sin dueño"', () => {
    const products = [product({ id: 1, ownerName: undefined })];
    const [owner] = computeOwners(products, [], [], cup);
    expect(owner.ownerName).toBe('Sin dueño');
  });
});
