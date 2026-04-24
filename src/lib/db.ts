import Dexie, { type Table } from 'dexie';
import type { Product, Sale, Customer, Installment, InstallmentPayment, AppSettings } from '@/types';

export class MiVentaDB extends Dexie {
  products!: Table<Product>;
  sales!: Table<Sale>;
  customers!: Table<Customer>;
  installments!: Table<Installment>;
  installmentPayments!: Table<InstallmentPayment>;
  settings!: Table<AppSettings>;

  constructor() {
    super('MiVentaDB');
    this.version(1).stores({
      products: '++id, name, category, type, stock, createdAt',
      sales: '++id, paymentMethod, customerId, createdAt, receiptNumber',
      customers: '++id, name, phone, createdAt',
      installments: '++id, saleId, customerId, status, createdAt',
      installmentPayments: '++id, installmentId, createdAt',
      settings: '++id',
    });
  }
}

export const db = new MiVentaDB();

export async function initDatabase(): Promise<void> {
  const count = await db.settings.count();
  if (count === 0) {
    await db.settings.add({
      storeName: 'Mi Tienda',
      address: '',
      phone: '',
      primaryCurrency: 'CUP',
      usdRate: 320,
      eurRate: 350,
      mlcRate: 300,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
}

export async function exportData(): Promise<string> {
  const data = {
    products: await db.products.toArray(),
    sales: await db.sales.toArray(),
    customers: await db.customers.toArray(),
    installments: await db.installments.toArray(),
    installmentPayments: await db.installmentPayments.toArray(),
    settings: await db.settings.toArray(),
    exportDate: new Date().toISOString(),
  };
  return JSON.stringify(data, null, 2);
}

export async function importData(jsonString: string): Promise<void> {
  const data = JSON.parse(jsonString);
  await db.transaction('rw', [db.products, db.sales, db.customers, db.installments, db.installmentPayments, db.settings], async () => {
    await db.products.clear();
    await db.sales.clear();
    await db.customers.clear();
    await db.installments.clear();
    await db.installmentPayments.clear();
    await db.settings.clear();

    if (data.products) await db.products.bulkAdd(data.products);
    if (data.sales) await db.sales.bulkAdd(data.sales);
    if (data.customers) await db.customers.bulkAdd(data.customers);
    if (data.installments) await db.installments.bulkAdd(data.installments);
    if (data.installmentPayments) await db.installmentPayments.bulkAdd(data.installmentPayments);
    if (data.settings) await db.settings.bulkAdd(data.settings);
  });
}

export async function clearAllData(): Promise<void> {
  await db.delete();
  window.location.reload();
}

let receiptCounter = 0;
export async function generateReceiptNumber(): Promise<string> {
  const today = new Date();
  const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
  receiptCounter++;
  const count = await db.sales.where('createdAt').between(
    new Date(today.getFullYear(), today.getMonth(), today.getDate()),
    new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)
  ).count();
  return `VT-${dateStr}-${String(count + 1).padStart(3, '0')}`;
}
