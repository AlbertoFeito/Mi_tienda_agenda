import type { Installment, InstallmentPayment } from '@/types';

/**
 * Installment scheduling helpers shared by the reminders and the
 * "upcoming collections" UI. Convention (matching the existing screens):
 * the first payment is due one period after the start date, and payment
 * number `k` is due `k` periods after the start date.
 */

function addPeriods(start: Date, periods: number, frequency: Installment['frequency']): Date {
  const d = new Date(start);
  for (let i = 0; i < periods; i++) {
    if (frequency === 'monthly') d.setMonth(d.getMonth() + 1);
    else d.setDate(d.getDate() + (frequency === 'weekly' ? 7 : 15));
  }
  return d;
}

/** Amount due per scheduled payment. */
export function paymentAmount(inst: Installment): number {
  if (!inst.numberOfPayments) return inst.totalAmount;
  return inst.totalAmount / inst.numberOfPayments;
}

export interface DueInfo {
  installment: Installment;
  dueDate: Date;
  amount: number;
  overdue: boolean;
  /** Whole days until the due date (negative if overdue). */
  daysUntil: number;
}

/** Next unpaid payment due-date info, or null when fully paid. */
export function getNextDue(inst: Installment, payments: InstallmentPayment[]): DueInfo | null {
  if (inst.status !== 'active' || inst.remainingAmount <= 0) return null;
  const made = payments.filter((p) => p.installmentId === inst.id).length;
  const nextNum = made + 1;
  if (nextNum > inst.numberOfPayments) return null;

  const dueDate = addPeriods(new Date(inst.startDate), nextNum, inst.frequency);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDue = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
  const daysUntil = Math.round((startOfDue.getTime() - startOfToday.getTime()) / 86400000);

  return {
    installment: inst,
    dueDate,
    amount: paymentAmount(inst),
    overdue: dueDate.getTime() < now.getTime(),
    daysUntil,
  };
}

/**
 * Active installments whose next payment is overdue or due within
 * `withinDays` days, sorted by due date (most urgent first).
 */
export function getDueSoon(
  installments: Installment[],
  payments: InstallmentPayment[],
  withinDays = 2,
): DueInfo[] {
  return installments
    .map((inst) => getNextDue(inst, payments))
    .filter((d): d is DueInfo => d !== null && d.daysUntil <= withinDays)
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
}
