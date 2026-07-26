import { Capacitor } from '@capacitor/core';
import type { Installment, InstallmentPayment } from '@/types';
import { getNextDue, paymentAmount } from '@/lib/installments';

/**
 * Schedules a local notification two days before each active installment's next
 * due date, so the store owner is reminded to collect (and can then send an
 * SMS/WhatsApp from the app). Works fully offline; no network involved.
 */

const REMIND_DAYS_BEFORE = 2;
const REMIND_HOUR = 9; // 9:00 local time

function formatAmount(n: number): string {
  return new Intl.NumberFormat('es-CU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

let scheduling = false;

export async function syncReminders(
  installments: Installment[],
  payments: InstallmentPayment[],
): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  if (scheduling) return;
  scheduling = true;
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');

    const perm = await LocalNotifications.requestPermissions();
    if (perm.display !== 'granted') return;

    // Clear previously scheduled reminders before rescheduling.
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length) {
      await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
    }

    const now = Date.now();
    const toSchedule = [];

    for (const inst of installments) {
      const due = getNextDue(inst, payments);
      if (!due || inst.id == null) continue;

      const remindAt = new Date(due.dueDate);
      remindAt.setDate(remindAt.getDate() - REMIND_DAYS_BEFORE);
      remindAt.setHours(REMIND_HOUR, 0, 0, 0);
      if (remindAt.getTime() <= now) continue; // in-app list covers imminent ones

      toSchedule.push({
        id: inst.id,
        title: 'Cobro próximo',
        body: `${inst.customerName}: ${formatAmount(paymentAmount(inst))} CUP vence el ${due.dueDate.toLocaleDateString('es-CU')}`,
        schedule: { at: remindAt, allowWhileIdle: true },
      });
    }

    if (toSchedule.length) {
      await LocalNotifications.schedule({ notifications: toSchedule });
    }
  } catch (err) {
    console.error('syncReminders failed:', err);
  } finally {
    scheduling = false;
  }
}
