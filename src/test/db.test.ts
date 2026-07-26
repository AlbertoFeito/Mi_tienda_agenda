import { describe, it, expect, beforeEach } from 'vitest';
import { db, initDatabase, exportData, importData, generateReceiptNumber } from '@/lib/db';
import { TABLE_NAMES } from '@/lib/store';

async function wipeAll() {
  for (const table of TABLE_NAMES) {
    // @ts-expect-error indexed access over the db table map
    await db[table].clear();
  }
}

describe('Database Functions (SQLite/local-store layer)', () => {
  beforeEach(async () => {
    localStorage.clear();
    await wipeAll();
  });

  describe('initDatabase', () => {
    it('should seed default settings when empty', async () => {
      await initDatabase();
      const settings = await db.settings.toArray();
      expect(settings).toHaveLength(1);
      expect(settings[0]).toMatchObject({
        storeName: 'Mi Tienda',
        primaryCurrency: 'CUP',
        usdRate: 320,
        eurRate: 350,
        mlcRate: 300,
      });
    });

    it('should not duplicate settings when data already exists', async () => {
      await initDatabase();
      await initDatabase();
      const settings = await db.settings.toArray();
      expect(settings).toHaveLength(1);
    });
  });

  describe('exportData', () => {
    it('should export all collections plus an export date', async () => {
      const parsed = JSON.parse(await exportData());
      expect(parsed).toHaveProperty('products');
      expect(parsed).toHaveProperty('sales');
      expect(parsed).toHaveProperty('customers');
      expect(parsed).toHaveProperty('installments');
      expect(parsed).toHaveProperty('installmentPayments');
      expect(parsed).toHaveProperty('settings');
      expect(parsed).toHaveProperty('exportDate');
    });
  });

  describe('importData', () => {
    it('should replace existing data and restore records with their ids', async () => {
      const payload = JSON.stringify({
        products: [
          {
            id: 1,
            name: 'Test Product',
            category: 'General',
            type: 'own',
            costPrice: 10,
            salePrice: 20,
            costCurrency: 'CUP',
            saleCurrency: 'CUP',
            stock: 5,
            minStock: 1,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        sales: [],
        customers: [],
        installments: [],
        installmentPayments: [],
        settings: [],
      });

      await importData(payload);

      const products = await db.products.toArray();
      expect(products).toHaveLength(1);
      expect(products[0].id).toBe(1);
      expect(products[0].name).toBe('Test Product');
      // Date fields are rehydrated into Date objects.
      expect(products[0].createdAt).toBeInstanceOf(Date);
    });
  });

  describe('generateReceiptNumber', () => {
    it('should produce a VT-YYYYMMDD-NNN receipt number', async () => {
      const receiptNumber = await generateReceiptNumber();
      expect(receiptNumber).toMatch(/^VT-\d{8}-\d{3}$/);
    });

    it('should increment the sequence for sales made today', async () => {
      const first = await generateReceiptNumber();
      expect(first.endsWith('-001')).toBe(true);

      await db.sales.add({
        items: [],
        total: 100,
        currency: 'CUP',
        paymentMethod: 'cash',
        discount: 0,
        createdAt: new Date(),
        receiptNumber: first,
      });

      const second = await generateReceiptNumber();
      expect(second.endsWith('-002')).toBe(true);
    });
  });
});
