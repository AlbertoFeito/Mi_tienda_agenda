import type { Currency } from '@/types';

const currencyStyles: Record<Currency, { bg: string; text: string }> = {
  CUP: { bg: 'bg-[#F0FDF4]', text: 'text-[#15803D]' },
  USD: { bg: 'bg-[#EFF6FF]', text: 'text-[#1D4ED8]' },
  EUR: { bg: 'bg-[#FFF7ED]', text: 'text-[#C2410C]' },
  MLC: { bg: 'bg-[#FAF5FF]', text: 'text-[#7C3AED]' },
};

export default function CurrencyBadge({ currency, className = '' }: { currency: Currency; className?: string }) {
  const style = currencyStyles[currency];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold font-mono ${style.bg} ${style.text} ${className}`}>
      {currency}
    </span>
  );
}
