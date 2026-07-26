import { describe, it, expect } from 'vitest';
import { getNextDue, getDueSoon, paymentAmount } from '@/lib/installments';
import type { Installment } from '@/types';

function makeInstallment(overrides: Partial<Installment> = {}): Installment {
  return {
    id: 1,
    saleId: 1,
    customerId: 1,
    customerName: 'Cliente',
    totalAmount: 400,
    paidAmount: 0,
    remainingAmount: 400,
    numberOfPayments: 4,
    frequency: 'weekly',
    startDate: new Date(),
    status: 'active',
    createdAt: new Date(),
    ...overrides,
  };
}

describe('installments helpers', () => {
  it('computes the per-payment amount', () => {
    expect(paymentAmount(makeInstallment())).toBe(100);
  });

  it('returns null for completed installments', () => {
    const inst = makeInstallment({ status: 'completed', remainingAmount: 0 });
    expect(getNextDue(inst, [])).toBeNull();
  });

  it('flags an installment due within two days as due-soon', () => {
    // First weekly payment is due 7 days after start, so start 6 days ago
    // makes the next due date one day from now.
    const start = new Date();
    start.setDate(start.getDate() - 6);
    const inst = makeInstallment({ startDate: start });
    const due = getDueSoon([inst], [], 2);
    expect(due).toHaveLength(1);
    expect(due[0].daysUntil).toBeLessThanOrEqual(2);
    expect(due[0].overdue).toBe(false);
  });

  it('flags an overdue installment', () => {
    const start = new Date();
    start.setDate(start.getDate() - 30); // well past the first weekly payment
    const inst = makeInstallment({ startDate: start });
    const due = getNextDue(inst, []);
    expect(due?.overdue).toBe(true);
  });

  it('excludes installments not yet near their due date', () => {
    const inst = makeInstallment({ frequency: 'monthly' }); // due ~30 days out
    expect(getDueSoon([inst], [], 2)).toHaveLength(0);
  });
});
