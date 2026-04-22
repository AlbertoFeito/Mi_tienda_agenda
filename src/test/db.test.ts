import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db, initDatabase, exportData, importData, clearAllData, generateReceiptNumber } from '@/lib/db';
import type { Product, Sale, Customer, AppSettings } from '@/types';

describe('Database Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initDatabase', () => {
    it('should initialize database with default settings when empty', async () => {
      vi.spyOn(db.settings, 'count').mockResolvedValue(0);
      vi.spyOn(db.settings, 'add').mockResolvedValue(1);

      await initDatabase();

      expect(db.settings.add).toHaveBeenCalledWith(
        expect.objectContaining({
          storeName: 'Mi Tienda',
          primaryCurrency: 'CUP',
          usdRate: 320,
          eurRate: 350,
          mlcRate: 300,
        })
      );
    });

    it('should not add default settings when database already has data', async () => {
      vi.spyOn(db.settings, 'count').mockResolvedValue(1);

      await initDatabase();

      expect(db.settings.add).not.toHaveBeenCalled();
    });
  });

  describe('exportData', () => {
    it('should export all data as JSON string', async () => {
      vi.spyOn(db.products, 'toArray').mockResolvedValue([]);
      vi.spyOn(db.sales, 'toArray').mockResolvedValue([]);
      vi.spyOn(db.customers, 'toArray').mockResolvedValue([]);
      vi.spyOn(db.installments, 'toArray').mockResolvedValue([]);
      vi.spyOn(db.installmentPayments, 'toArray').mockResolvedValue([]);
      vi.spyOn(db.settings, 'toArray').mockResolvedValue([]);

      const result = await exportData();

      const parsed = JSON.parse(result);
      expect(parsed).toHaveProperty('products');
      expect(parsed).toHaveProperty('sales');
      expect(parsed).toHaveProperty('customers');
      expect(parsed).toHaveProperty('installments');
      expect(parsed).toHaveProperty('settings');
      expect(parsed).toHaveProperty('exportDate');
    });
  });

  describe('importData', () => {
    it('should clear all data and import new data', async () => {
      const mockData = JSON.stringify({
        products: [{ id: 1, name: 'Test Product' }],
        sales: [],
        customers: [],
        installments: [],
        installmentPayments: [],
        settings: [],
      });

      vi.spyOn(db.products, 'clear').mockResolvedValue(undefined);
      vi.spyOn(db.sales, 'clear').mockResolvedValue(undefined);
      vi.spyOn(db.customers, 'clear').mockResolvedValue(undefined);
      vi.spyOn(db.installments, 'clear').mockResolvedValue(undefined);
      vi.spyOn(db.installmentPayments, 'clear').mockResolvedValue(undefined);
      vi.spyOn(db.settings, 'clear').mockResolvedValue(undefined);
      vi.spyOn(db.products, 'bulkAdd').mockResolvedValue(undefined);
      vi.spyOn(db.sales, 'bulkAdd').mockResolvedValue(undefined);
      vi.spyOn(db.customers, 'bulkAdd').mockResolvedValue(undefined);
      vi.spyOn(db.installments, 'bulkAdd').mockResolvedValue(undefined);
      vi.spyOn(db.installmentPayments, 'bulkAdd').mockResolvedValue(undefined);
      vi.spyOn(db.settings, 'bulkAdd').mockResolvedValue(undefined);

      await importData(mockData);

      expect(db.products.clear).toHaveBeenCalled();
      expect(db.sales.clear).toHaveBeenCalled();
      expect(db.customers.clear).toHaveBeenCalled();
      expect(db.products.bulkAdd).toHaveBeenCalledWith([{ id: 1, name: 'Test Product' }]);
    });
  });

  describe('generateReceiptNumber', () => {
    it('should generate valid receipt number with date and sequence', async () => {
      vi.spyOn(db.sales, 'where').mockReturnThis() as any;
      vi.spyOn(db.sales, 'between').mockReturnThis() as any;
      vi.spyOn(db.sales, 'count').mockResolvedValue(0);

      const receiptNumber = await generateReceiptNumber();

      // Format: VT-YYYYMMDD-NNN
      expect(receiptNumber).toMatch(/^VT-\d{6}-\d{3}$/);
    });
  });
});