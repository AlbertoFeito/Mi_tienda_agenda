import { db } from '@/lib/db';
import { syncReminders } from '@/lib/reminders';
import type { Installment, InstallmentPayment, Sale } from '@/types';

/**
 * Cancelling a sale.
 *
 * A registered sale moves three things: the stock it took out, the profit it
 * added, and — for consignment goods — what the shop owes the owner. Undoing it
 * has to put all three back, which is why every read of the sales table goes
 * through `activeSales` here instead of filtering on its own.
 *
 * The sale is kept and marked, not deleted: a ledger gets a line crossed out,
 * not the page torn out.
 */

/** A sale counts unless it was explicitly cancelled. */
export function isActive(sale: Sale): boolean {
  return sale.status !== 'cancelled';
}

/** The sales that count towards stock, profit and what owners are owed. */
export function activeSales(sales: Sale[]): Sale[] {
  return sales.filter(isActive);
}

/** Why a sale cannot be cancelled. */
export type CancelBlock = 'no-existe' | 'ya-anulada' | 'tiene-cobros';

export interface CancelCheck {
  ok: boolean;
  block?: CancelBlock;
  /** CUP already collected, when the block is `tiene-cobros`. */
  collected?: number;
  /** Items whose product no longer exists, so their stock could not return. */
  missingProducts?: number;
}

/**
 * Whether this sale can still be undone.
 *
 * An instalment sale means the customer already took the goods, so once any
 * payment has come in the sale really happened: cancelling it would take money
 * that was genuinely received out of the books.
 */
export function canCancel(
  sale: Sale,
  installments: Installment[],
  payments: InstallmentPayment[],
): CancelCheck {
  if (!isActive(sale)) return { ok: false, block: 'ya-anulada' };

  const inst = installments.find((i) => i.saleId === sale.id);
  if (inst) {
    const made = payments.filter((p) => p.installmentId === inst.id);
    if (made.length > 0) {
      return {
        ok: false,
        block: 'tiene-cobros',
        collected: made.reduce((sum, p) => sum + p.amount, 0),
      };
    }
  }

  return { ok: true };
}

/**
 * Undo a sale: mark it cancelled, return its stock, and drop the debt it
 * created. Refuses — touching nothing — when `canCancel` says no.
 */
export async function cancelSale(saleId: number, reason?: string): Promise<CancelCheck> {
  const [sale, installments, payments] = await Promise.all([
    db.sales.get(saleId),
    db.installments.toArray(),
    db.installmentPayments.toArray(),
  ]);

  if (!sale) return { ok: false, block: 'no-existe' };

  const check = canCancel(sale, installments, payments);
  if (!check.ok) return check;

  let missingProducts = 0;

  await db.transaction('rw', db.sales, db.products, db.installments, async () => {
    await db.sales.update(saleId, {
      status: 'cancelled',
      cancelledAt: new Date().toISOString(),
      cancelReason: reason?.trim() || undefined,
    });

    for (const item of sale.items) {
      const product = await db.products.get(item.productId);
      // The product may have been deleted since; skip it rather than fail the
      // whole cancellation, and report how many could not be restored.
      if (!product?.id) {
        missingProducts += 1;
        continue;
      }
      await db.products.update(product.id, {
        stock: product.stock + item.quantity,
        updatedAt: new Date(),
      });
    }

    const inst = installments.find((i) => i.saleId === saleId);
    if (inst?.id) await db.installments.update(inst.id, { status: 'cancelled' });
  });

  // The 2-days-before notifications are only rescheduled from the home screen.
  // Without this, a reminder for the cancelled instalment would still fire.
  try {
    await syncReminders(await db.installments.toArray(), payments);
  } catch {
    /* notifications are best-effort; the cancellation already went through */
  }

  return { ok: true, missingProducts };
}
