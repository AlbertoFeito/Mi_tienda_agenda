/**
 * Keeping big amounts inside their box.
 *
 * The bookkeeping runs in CUP, where ordinary prices reach seven digits, so a
 * formatted amount can be well over twenty characters. Truncating it is not an
 * option — half a price is worse than no price — so the text shrinks instead,
 * one step at a time, and wraps only as a last resort.
 */

export type MoneyScale = 'xl' | 'lg' | 'base' | 'sm';

const SCALES: Record<MoneyScale, string[]> = {
  xl: ['text-2xl', 'text-xl', 'text-lg', 'text-base'],
  lg: ['text-lg', 'text-base', 'text-sm', 'text-xs'],
  base: ['text-base', 'text-sm', 'text-xs', 'text-[11px]'],
  sm: ['text-sm', 'text-xs', 'text-[11px]', 'text-[10px]'],
};

/**
 * The font-size class for an already formatted amount, stepping down as it
 * grows. `scale` is the size it uses when the number is short.
 */
export function moneySize(text: string, scale: MoneyScale = 'base'): string {
  const steps = SCALES[scale];
  const n = text.length;
  if (n <= 12) return steps[0]; // "2,700.00 CUP"
  if (n <= 14) return steps[1]; // "250,000.00 CUP"
  if (n <= 18) return steps[2]; // "1,250,000.00 CUP", "999,999,999.00 CUP"
  return steps[3]; // beyond a billion, anything goes
}

/**
 * Classes for a money figure: the adaptive size plus digits of even width, so
 * columns of numbers line up instead of dancing.
 */
export function moneyClass(text: string, scale: MoneyScale = 'base'): string {
  return `${moneySize(text, scale)} tabular-nums`;
}

/** Compact form for tight spots: 1,250,000 -> 1.25 M. Never used for totals. */
export function abbreviate(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(2)} M`;
  if (abs >= 100_000) return `${(value / 1000).toFixed(1)} mil`;
  return new Intl.NumberFormat('es-CU').format(value);
}
