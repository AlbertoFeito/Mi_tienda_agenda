import { describe, it, expect } from 'vitest';
import { abbreviate, moneyClass, moneySize } from '@/lib/format';

/** The same formatter the app uses, so the test measures real strings. */
function money(amount: number, currency = 'CUP'): string {
  const n = new Intl.NumberFormat('es-CU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return `${n} ${currency}`;
}

describe('moneySize', () => {
  it('leaves everyday amounts at full size', () => {
    expect(moneySize(money(2700), 'base')).toBe('text-base');
    expect(moneySize(money(15, 'USD'), 'base')).toBe('text-base');
  });

  it('steps down as the amount grows', () => {
    const sizes = [money(2700), money(250_000), money(1_250_000), money(99_999_999_999)].map((t) =>
      moneySize(t, 'base'),
    );
    expect(sizes).toEqual(['text-base', 'text-sm', 'text-xs', 'text-[11px]']);
  });

  it('handles the amount from the reported screenshot', () => {
    // "1,250,000.00 CUP" (16 chars) is what overflowed the product card.
    const text = money(1_250_000);
    expect(text).toBe('1,250,000.00 CUP');
    expect(text).toHaveLength(16);
    expect(moneySize(text, 'base')).toBe('text-xs');
  });

  it('shrinks from whatever size the caller starts at', () => {
    const huge = money(1_250_000);
    expect(moneySize(huge, 'xl')).toBe('text-lg');
    expect(moneySize(huge, 'lg')).toBe('text-sm');
    expect(moneySize(huge, 'sm')).toBe('text-[11px]');
  });

  it('never returns an empty class, whatever it is given', () => {
    for (const text of ['', '0.00 CUP', 'x'.repeat(200)]) {
      expect(moneySize(text, 'base')).toMatch(/^text-/);
    }
  });
});

describe('moneyClass', () => {
  it('lines digits up so columns do not dance', () => {
    expect(moneyClass(money(2700))).toContain('tabular-nums');
  });
});

describe('abbreviate', () => {
  it('shortens only what is genuinely huge', () => {
    expect(abbreviate(999)).toBe('999');
    expect(abbreviate(150_000)).toBe('150.0 mil');
    expect(abbreviate(1_250_000)).toBe('1.25 M');
  });

  it('keeps the sign on negative amounts', () => {
    expect(abbreviate(-1_250_000)).toBe('-1.25 M');
  });
});
