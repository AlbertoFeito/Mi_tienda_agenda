import { Capacitor } from '@capacitor/core';
import { normalizeCubanPhone } from '@/components/PhoneField';

/** Cuba country code. */
const CC = '53';

function formatDate(d: Date): string {
  return d.toLocaleDateString('es-CU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatAmount(n: number): string {
  return new Intl.NumberFormat('es-CU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

/** Build the payment-reminder text for a customer. */
export function buildReminderMessage(params: {
  customerName: string;
  amount: number;
  dueDate: Date;
  storeName: string;
  overdue: boolean;
}): string {
  const { customerName, amount, dueDate, storeName, overdue } = params;
  const money = `${formatAmount(amount)} CUP`;
  if (overdue) {
    return `Hola ${customerName}, le recordamos que tiene un pago pendiente de ${money} que venció el ${formatDate(dueDate)}. Por favor comuníquese con nosotros. Gracias. — ${storeName}`;
  }
  return `Hola ${customerName}, le recordamos su pago de ${money} que vence el ${formatDate(dueDate)}. Gracias. — ${storeName}`;
}

async function openExternal(url: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const { AppLauncher } = await import('@capacitor/app-launcher');
    await AppLauncher.openUrl({ url });
  } else {
    window.open(url, '_blank');
  }
}

/** Open the SMS app with the recipient and message prefilled. */
export async function openSms(phone: string, text: string): Promise<void> {
  const digits = normalizeCubanPhone(phone);
  const to = digits ? `+${CC}${digits}` : '';
  await openExternal(`sms:${to}?body=${encodeURIComponent(text)}`);
}

/** Open WhatsApp with the recipient and message prefilled. */
export async function openWhatsApp(phone: string, text: string): Promise<void> {
  const digits = normalizeCubanPhone(phone);
  await openExternal(`whatsapp://send?phone=${CC}${digits}&text=${encodeURIComponent(text)}`);
}
