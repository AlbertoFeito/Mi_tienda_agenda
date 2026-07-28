import { isActive } from '@/lib/sales';
import type { Product, Sale, Owner, OwnerPayment, Currency } from '@/types';

/**
 * Consignment settlement ("liquidación por dueño").
 *
 * Model: the owner sets the price they want back (the product's cost price);
 * the seller keeps whatever is sold above it. So for each sold unit the seller
 * owes the owner `costPrice`, and the seller's profit is `salePrice − costPrice`
 * (all normalized to CUP). The seller records payments to the owner to settle.
 */

export interface OwnerProductInfo {
  product: Product;
  soldQty: number;
  remaining: number;
  owedCUP: number; // owner's money for the units sold
  profitCUP: number; // seller's profit for the units sold
}

export interface OwnerSummary {
  ownerName: string;
  contact?: string;
  /** Id in the owners table, when the owner is registered in "Gestionar dueños". */
  ownerId?: number;
  products: OwnerProductInfo[];
  totalOwed: number; // CUP owed to the owner for everything sold
  totalPaid: number; // CUP already paid to the owner
  balance: number; // owed − paid
  profit: number; // seller's accumulated profit from this owner
  activeProducts: number; // products with remaining stock
}

const NO_OWNER = 'Sin dueño';

export function computeOwners(
  products: Product[],
  sales: Sale[],
  ownerPayments: OwnerPayment[],
  convertToCUP: (amount: number, currency: Currency) => number,
  registeredOwners: Owner[] = [],
): OwnerSummary[] {
  // Units sold and revenue (CUP) per product, from the sales history.
  const soldQty = new Map<number, number>();
  const revenueCUP = new Map<number, number>();
  for (const sale of sales) {
    // A cancelled sale never happened: the owner is not owed for it.
    if (!isActive(sale)) continue;
    for (const it of sale.items) {
      soldQty.set(it.productId, (soldQty.get(it.productId) || 0) + it.quantity);
      revenueCUP.set(
        it.productId,
        (revenueCUP.get(it.productId) || 0) + convertToCUP(it.unitPrice * it.quantity, it.unitCurrency),
      );
    }
  }

  const paidByOwner = new Map<string, number>();
  for (const pay of ownerPayments) {
    const name = (pay.ownerName || '').trim() || NO_OWNER;
    paidByOwner.set(name, (paidByOwner.get(name) || 0) + pay.amount);
  }

  const owners = new Map<string, OwnerSummary>();

  for (const product of products) {
    if (product.type !== 'consignment') continue;
    const name = (product.ownerName || '').trim() || NO_OWNER;

    const sold = product.id != null ? soldQty.get(product.id) || 0 : 0;
    const revenue = product.id != null ? revenueCUP.get(product.id) || 0 : 0;
    const owedCUP = convertToCUP(product.costPrice * sold, product.costCurrency);
    const profitCUP = revenue - owedCUP;

    if (!owners.has(name)) {
      owners.set(name, {
        ownerName: name,
        contact: product.ownerContact,
        products: [],
        totalOwed: 0,
        totalPaid: paidByOwner.get(name) || 0,
        balance: 0,
        profit: 0,
        activeProducts: 0,
      });
    }
    const entry = owners.get(name)!;
    if (!entry.contact && product.ownerContact) entry.contact = product.ownerContact;
    entry.products.push({ product, soldQty: sold, remaining: product.stock, owedCUP, profitCUP });
    entry.totalOwed += owedCUP;
    entry.profit += profitCUP;
    if (product.stock > 0) entry.activeProducts += 1;
  }

  // Owners registered in "Gestionar dueños" always show up, even before they
  // have handed over any product, and their saved phone wins over the loose
  // contact typed on a product.
  for (const reg of registeredOwners) {
    const name = (reg.name || '').trim();
    if (!name) continue;
    if (!owners.has(name)) {
      owners.set(name, {
        ownerName: name,
        contact: reg.phone,
        ownerId: reg.id,
        products: [],
        totalOwed: 0,
        totalPaid: paidByOwner.get(name) || 0,
        balance: 0,
        profit: 0,
        activeProducts: 0,
      });
    } else {
      const entry = owners.get(name)!;
      entry.ownerId = reg.id;
      if (reg.phone) entry.contact = reg.phone;
    }
  }

  const result = Array.from(owners.values());
  for (const o of result) {
    o.balance = o.totalOwed - o.totalPaid;
  }
  // Most money owed first.
  return result.sort((a, b) => b.balance - a.balance);
}
