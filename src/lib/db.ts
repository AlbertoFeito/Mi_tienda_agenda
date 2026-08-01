import type {
  Product,
  Sale,
  Customer,
  Owner,
  Installment,
  InstallmentPayment,
  OwnerPayment,
  StockMovement,
  AppSettings,
} from '@/types';
import {
  backend,
  ensureReady,
  TABLE_NAMES,
  type StoredRow,
  type TableName,
} from '@/lib/store';
import { notifyChange } from '@/lib/live';

/**
 * Local database layer for Mi Tienda.
 *
 * Data lives in a real, on-device SQLite database (via
 * `@capacitor-community/sqlite`) inside the native Android build. The public
 * API mirrors the small subset of Dexie's table API the app used, so the
 * screens did not need to change how they read/write data.
 */

// Fields that must be rehydrated into `Date` objects after JSON parsing,
// matching the previous Dexie behavior.
const DATE_FIELDS: Record<TableName, string[]> = {
  products: ['createdAt', 'updatedAt'],
  sales: ['createdAt'],
  customers: ['createdAt'],
  owners: ['createdAt', 'updatedAt'],
  installments: ['startDate', 'createdAt'],
  installmentPayments: ['paymentDate', 'createdAt'],
  ownerPayments: ['createdAt'],
  stockMovements: ['createdAt'],
  settings: ['createdAt', 'updatedAt'],
};

function hydrate<T>(table: TableName, row: StoredRow): T {
  const obj: Record<string, unknown> = { id: row.id, ...row.data };
  for (const field of DATE_FIELDS[table]) {
    const value = obj[field];
    if (value !== undefined && value !== null) {
      obj[field] = new Date(value as string);
    }
  }
  return obj as T;
}

// Strip the synthetic `id` before persisting the record body.
function stripId(obj: Record<string, unknown>): Record<string, unknown> {
  const { id, ...rest } = obj;
  void id;
  return rest;
}

interface WhereClause {
  between(lower: unknown, upper: unknown): { count(): Promise<number> };
}

interface Table<T> {
  toArray(): Promise<T[]>;
  get(id: number): Promise<T | undefined>;
  add(item: T): Promise<number>;
  update(id: number, changes: Partial<T>): Promise<number>;
  delete(id: number): Promise<void>;
  count(): Promise<number>;
  clear(): Promise<void>;
  bulkAdd(items: T[]): Promise<void>;
  where(field: string): WhereClause;
}

function makeTable<T>(name: TableName): Table<T> {
  return {
    async toArray(): Promise<T[]> {
      await ensureReady();
      const rows = await backend.selectAll(name);
      return rows.map((r) => hydrate<T>(name, r));
    },

    async get(id: number): Promise<T | undefined> {
      await ensureReady();
      const row = await backend.selectOne(name, id);
      return row ? hydrate<T>(name, row) : undefined;
    },

    async add(item: T): Promise<number> {
      await ensureReady();
      const data = stripId(item as Record<string, unknown>);
      const id = await backend.insert(name, data);
      notifyChange();
      return id;
    },

    async update(id: number, changes: Partial<T>): Promise<number> {
      await ensureReady();
      const existing = await backend.selectOne(name, id);
      if (!existing) return 0;
      const merged = { ...existing.data, ...stripId(changes as Record<string, unknown>) };
      await backend.updateById(name, id, merged);
      notifyChange();
      return 1;
    },

    async delete(id: number): Promise<void> {
      await ensureReady();
      await backend.deleteById(name, id);
      notifyChange();
    },

    async count(): Promise<number> {
      await ensureReady();
      return (await backend.selectAll(name)).length;
    },

    async clear(): Promise<void> {
      await ensureReady();
      await backend.clearTable(name);
      notifyChange();
    },

    async bulkAdd(items: T[]): Promise<void> {
      await ensureReady();
      for (const item of items) {
        const record = item as Record<string, unknown>;
        const data = stripId(record);
        if (typeof record.id === 'number') {
          await backend.insertWithId(name, record.id, data);
        } else {
          await backend.insert(name, data);
        }
      }
      notifyChange();
    },

    where(field: string): WhereClause {
      return {
        between(lower: unknown, upper: unknown) {
          return {
            async count(): Promise<number> {
              await ensureReady();
              const rows = await backend.selectAll(name);
              const lo = +new Date(lower as string);
              const hi = +new Date(upper as string);
              return rows.filter((r) => {
                const raw = (r.data as Record<string, unknown>)[field];
                if (raw === undefined || raw === null) return false;
                const t = +new Date(raw as string);
                return t >= lo && t < hi;
              }).length;
            },
          };
        },
      };
    },
  };
}

export const db = {
  products: makeTable<Product>('products'),
  sales: makeTable<Sale>('sales'),
  customers: makeTable<Customer>('customers'),
  owners: makeTable<Owner>('owners'),
  installments: makeTable<Installment>('installments'),
  installmentPayments: makeTable<InstallmentPayment>('installmentPayments'),
  ownerPayments: makeTable<OwnerPayment>('ownerPayments'),
  stockMovements: makeTable<StockMovement>('stockMovements'),
  settings: makeTable<AppSettings>('settings'),

  /**
   * Dexie-compatible transaction shim. The last argument is the callback; any
   * table references before it are ignored. Operations run sequentially
   * against the single local connection, which is sufficient for this
   * single-user app.
   */
  async transaction<T>(_mode: string, ...args: unknown[]): Promise<T> {
    const callback = args[args.length - 1] as () => Promise<T>;
    return callback();
  },
};

export async function initDatabase(): Promise<void> {
  await ensureReady();
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
    owners: await db.owners.toArray(),
    installments: await db.installments.toArray(),
    installmentPayments: await db.installmentPayments.toArray(),
    ownerPayments: await db.ownerPayments.toArray(),
    stockMovements: await db.stockMovements.toArray(),
    settings: await db.settings.toArray(),
    exportDate: new Date().toISOString(),
  };
  return JSON.stringify(data, null, 2);
}

export async function importData(jsonString: string): Promise<void> {
  const data = JSON.parse(jsonString);
  await db.transaction(
    'rw',
    [db.products, db.sales, db.customers, db.owners, db.installments, db.installmentPayments, db.ownerPayments, db.stockMovements, db.settings],
    async () => {
      await db.products.clear();
      await db.sales.clear();
      await db.customers.clear();
      await db.owners.clear();
      await db.installments.clear();
      await db.installmentPayments.clear();
      await db.ownerPayments.clear();
      await db.stockMovements.clear();
      await db.settings.clear();

      if (data.products) await db.products.bulkAdd(data.products);
      if (data.sales) await db.sales.bulkAdd(data.sales);
      if (data.customers) await db.customers.bulkAdd(data.customers);
      if (data.owners) await db.owners.bulkAdd(data.owners);
      if (data.installments) await db.installments.bulkAdd(data.installments);
      if (data.installmentPayments) await db.installmentPayments.bulkAdd(data.installmentPayments);
      if (data.ownerPayments) await db.ownerPayments.bulkAdd(data.ownerPayments);
      if (data.stockMovements) await db.stockMovements.bulkAdd(data.stockMovements);
      if (data.settings) await db.settings.bulkAdd(data.settings);
    },
  );
}

export async function clearAllData(): Promise<void> {
  await ensureReady();
  for (const table of TABLE_NAMES) {
    await backend.clearTable(table);
  }
  notifyChange();
  window.location.reload();
}

export async function generateReceiptNumber(): Promise<string> {
  const today = new Date();
  const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
  const count = await db.sales
    .where('createdAt')
    .between(
      new Date(today.getFullYear(), today.getMonth(), today.getDate()),
      new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1),
    )
    .count();
  return `VT-${dateStr}-${String(count + 1).padStart(3, '0')}`;
}
