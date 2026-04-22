import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock IndexedDB/Dexie
vi.mock('dexie', () => {
  const mockDb = {
    products: {
      toArray: vi.fn().mockResolvedValue([]),
      add: vi.fn().mockResolvedValue(1),
      update: vi.fn().mockResolvedValue(1),
      delete: vi.fn().mockResolvedValue(undefined),
      get: vi.fn().mockResolvedValue(null),
      where: vi.fn().mockReturnThis(),
      between: vi.fn().mockReturnThis(),
      count: vi.fn().mockResolvedValue(0),
      clear: vi.fn().mockResolvedValue(undefined),
      bulkAdd: vi.fn().mockResolvedValue(undefined),
    },
    sales: {
      toArray: vi.fn().mockResolvedValue([]),
      add: vi.fn().mockResolvedValue(1),
      count: vi.fn().mockResolvedValue(0),
      clear: vi.fn().mockResolvedValue(undefined),
      bulkAdd: vi.fn().mockResolvedValue(undefined),
    },
    customers: {
      toArray: vi.fn().mockResolvedValue([]),
      add: vi.fn().mockResolvedValue(1),
      update: vi.fn().mockResolvedValue(1),
      get: vi.fn().mockResolvedValue(null),
      clear: vi.fn().mockResolvedValue(undefined),
      bulkAdd: vi.fn().mockResolvedValue(undefined),
    },
    installments: {
      toArray: vi.fn().mockResolvedValue([]),
      add: vi.fn().mockResolvedValue(1),
      update: vi.fn().mockResolvedValue(1),
      clear: vi.fn().mockResolvedValue(undefined),
      bulkAdd: vi.fn().mockResolvedValue(undefined),
    },
    installmentPayments: {
      toArray: vi.fn().mockResolvedValue([]),
      add: vi.fn().mockResolvedValue(1),
      clear: vi.fn().mockResolvedValue(undefined),
      bulkAdd: vi.fn().mockResolvedValue(undefined),
    },
    settings: {
      toArray: vi.fn().mockResolvedValue([{
        id: 1,
        storeName: 'Mi Tienda',
        primaryCurrency: 'CUP',
        usdRate: 320,
        eurRate: 350,
        mlcRate: 300,
      }]),
      add: vi.fn().mockResolvedValue(1),
      update: vi.fn().mockResolvedValue(1),
      count: vi.fn().mockResolvedValue(1),
      clear: vi.fn().mockResolvedValue(undefined),
      bulkAdd: vi.fn().mockResolvedValue(undefined),
    },
    transaction: vi.fn().mockImplementation(async (mode, tables, callback) => {
      await callback();
    }),
    delete: vi.fn().mockResolvedValue(undefined),
  };

  return {
    default: vi.fn().mockImplementation(() => mockDb),
    Dexie: vi.fn(),
  };
});

// Mock window.location.reload
delete window.location;
window.location = { reload: vi.fn() } as any;

// Mock navigator.serviceWorker
if (typeof navigator !== 'undefined') {
  Object.assign(navigator, {
    serviceWorker: {
      register: vi.fn().mockResolvedValue({}),
      unregister: vi.fn().mockResolvedValue(undefined),
    },
  });
}