export type ProductType = 'own' | 'consignment';
export type PaymentMethod = 'cash' | 'transfer' | 'installment';
export type Currency = 'CUP' | 'USD' | 'EUR' | 'MLC';
export type InstallmentFrequency = 'weekly' | 'biweekly' | 'monthly';
export type InstallmentStatus = 'active' | 'completed' | 'cancelled';
export type SaleStatus = 'active' | 'cancelled';
export type PeriodFilter = 'today' | 'week' | 'month' | 'year';

export interface Product {
  id?: number;
  name: string;
  category: string;
  type: ProductType;
  costPrice: number;
  salePrice: number;
  costCurrency: Currency;
  saleCurrency: Currency;
  stock: number;
  minStock: number;
  image?: string;
  description?: string;
  ownerName?: string;
  ownerContact?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SaleItem {
  productId: number;
  productName: string;
  quantity: number;
  unitPrice: number;
  unitCurrency: Currency;
  subtotal: number;
}

export interface Sale {
  id?: number;
  items: SaleItem[];
  total: number;
  currency: Currency;
  paymentMethod: PaymentMethod;
  customerId?: number;
  customerName?: string;
  discount: number;
  createdAt: Date;
  receiptNumber: string;
  /**
   * Undefined means active: sales recorded before cancelling existed carry no
   * status, and must keep counting.
   */
  status?: SaleStatus;
  cancelledAt?: string;
  cancelReason?: string;
}

export interface Customer {
  id?: number;
  name: string;
  phone?: string;
  address?: string;
  notes?: string;
  createdAt: Date;
}

export interface Owner {
  id?: number;
  name: string;
  phone?: string;
  email?: string;
  avatar?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Installment {
  id?: number;
  saleId: number;
  customerId: number;
  customerName: string;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  numberOfPayments: number;
  frequency: InstallmentFrequency;
  startDate: Date;
  status: InstallmentStatus;
  createdAt: Date;
}

export interface InstallmentPayment {
  id?: number;
  installmentId: number;
  amount: number;
  paymentDate: Date;
  paymentMethod: PaymentMethod;
  notes?: string;
  createdAt: Date;
}

/** Why stock moved without a sale behind it. */
export type StockMovementType = 'entrada' | 'merma';

/**
 * Stock that came in or was written off.
 *
 * Until now the only thing that moved stock was a sale, so restocking meant
 * editing the number by hand and a broken item had to be faked as a sale. Both
 * left the inventory saying things that never happened.
 */
export interface StockMovement {
  id?: number;
  productId: number;
  /** Kept on the movement so the history survives deleting the product. */
  productName: string;
  type: StockMovementType;
  /** Always positive; the type says which way it goes. */
  quantity: number;
  /** What the goods cost this time round. Entries only. */
  unitCost?: number;
  unitCurrency?: Currency;
  /** For a write-off: broke, expired, lost, taken for personal use. */
  reason?: string;
  notes?: string;
  createdAt: Date;
}

/** A payment the seller makes to a consignment owner (settlement). */
export interface OwnerPayment {
  id?: number;
  ownerName: string;
  amount: number; // CUP
  notes?: string;
  createdAt: Date;
}

export interface AppSettings {
  id?: number;
  storeName: string;
  address?: string;
  phone?: string;
  primaryCurrency: Currency;
  usdRate: number;
  eurRate: number;
  mlcRate: number;
  /** Salted SHA-256 hash of the app PIN ("salt$hash"). Undefined until set. */
  pinHash?: string;
  /** Whether fingerprint/biometric unlock is enabled. */
  biometricEnabled?: boolean;
  /** ISO timestamp of the last successful data backup. */
  lastBackupAt?: string;
  /** ISO timestamp of when the first-run walkthrough was completed. */
  onboardingDoneAt?: string;
  /** Code identifying this install, shown to the user so it can be licensed. */
  deviceId?: string;
  /** The activation code, once verified. Its presence means "licensed". */
  licenseKey?: string;
  /** ISO timestamp of the first launch, from which the trial is counted. */
  trialStartedAt?: string;
  /** ISO timestamp of the last time the user reviewed the exchange rates. */
  ratesReviewedAt?: string;
  /**
   * ISO timestamp of the last backup the user actually sent out of the phone.
   * Kept apart from `lastBackupAt`, which the daily automatic backup also sets
   * and which therefore proves nothing about surviving a lost phone.
   */
  lastSharedBackupAt?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CartItem {
  productId: number;
  productName: string;
  quantity: number;
  unitPrice: number;
  unitCurrency: Currency;
}

export interface CategorySummary {
  name: string;
  totalRevenue: number;
  totalProfit: number;
  productCount: number;
}

export interface SalesByMethod {
  method: PaymentMethod;
  count: number;
  total: number;
}

export interface DailySale {
  date: string;
  total: number;
  profit: number;
}

export interface TopProduct {
  id: number;
  name: string;
  image?: string;
  quantitySold: number;
  totalRevenue: number;
}

export interface CustomerDebt {
  customer: Customer;
  totalDebt: number;
  totalPaid: number;
  remaining: number;
  overdueAmount: number;
  activeInstallments: number;
}
