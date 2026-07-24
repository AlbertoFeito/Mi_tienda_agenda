import type { PaymentMethod } from '@/types';

export interface ReceiptItem {
  productName: string;
  quantity: number;
  subtotal: number; // CUP
}

export interface ReceiptData {
  storeName: string;
  receiptNumber: string;
  date: Date;
  items: ReceiptItem[];
  discount: number;
  total: number; // CUP
  customerName?: string;
  customerPhone?: string;
  paymentMethod: PaymentMethod;
}

const METHOD_LABEL: Record<PaymentMethod, string> = {
  cash: 'Efectivo',
  transfer: 'Transferencia',
  installment: 'A plazos',
};

function money(n: number): string {
  return new Intl.NumberFormat('es-CU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

/** Plain-text receipt suitable for SMS, WhatsApp or the share sheet. */
export function buildReceiptText(r: ReceiptData): string {
  const lines: string[] = [];
  lines.push(`🧾 ${r.storeName}`);
  lines.push(`Recibo ${r.receiptNumber}`);
  lines.push(r.date.toLocaleString('es-CU'));
  lines.push('----------------------------');
  for (const it of r.items) {
    lines.push(`${it.quantity} x ${it.productName}`);
    lines.push(`   ${money(it.subtotal)} CUP`);
  }
  lines.push('----------------------------');
  if (r.discount > 0) lines.push(`Descuento: -${money(r.discount)} CUP`);
  lines.push(`TOTAL: ${money(r.total)} CUP`);
  lines.push(`Pago: ${METHOD_LABEL[r.paymentMethod]}`);
  if (r.customerName) lines.push(`Cliente: ${r.customerName}`);
  lines.push('');
  lines.push('¡Gracias por su compra!');
  return lines.join('\n');
}
