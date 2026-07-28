import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { since } from '@/components/SalesHistory';

describe('since (period filter for the sales list)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // A Wednesday, mid-afternoon, mid-month, mid-year.
    vi.setSystemTime(new Date(2026, 6, 15, 15, 30, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('"Hoy" starts at midnight, so this morning still counts', () => {
    const from = since('today')!;
    expect(from).toEqual(new Date(2026, 6, 15, 0, 0, 0));
    // A sale made at 9am today is included.
    expect(new Date(2026, 6, 15, 9, 0) >= from).toBe(true);
    // One from last night is not.
    expect(new Date(2026, 6, 14, 23, 0) >= from).toBe(false);
  });

  it('"Semana" reaches back seven full days', () => {
    const from = since('week')!;
    expect(from).toEqual(new Date(2026, 6, 8, 0, 0, 0));
  });

  it('"Mes" starts on the first of the month, not 30 days back', () => {
    expect(since('month')).toEqual(new Date(2026, 6, 1, 0, 0, 0));
  });

  it('"Año" starts on the first of January', () => {
    expect(since('year')).toEqual(new Date(2026, 0, 1, 0, 0, 0));
  });

  it('"Todas" has no lower bound', () => {
    expect(since('all')).toBeNull();
  });

  it('every bound is in the past, never ahead of now', () => {
    for (const p of ['today', 'week', 'month', 'year'] as const) {
      expect(since(p)!.getTime()).toBeLessThanOrEqual(Date.now());
    }
  });

  it('holds up on the first day of a month', () => {
    vi.setSystemTime(new Date(2026, 6, 1, 8, 0, 0));
    // Reaching back a week must cross into June, not clamp to the 1st.
    expect(since('week')).toEqual(new Date(2026, 5, 24, 0, 0, 0));
    expect(since('month')).toEqual(new Date(2026, 6, 1, 0, 0, 0));
  });

  it('holds up on the first day of a year', () => {
    vi.setSystemTime(new Date(2026, 0, 1, 8, 0, 0));
    expect(since('week')).toEqual(new Date(2025, 11, 25, 0, 0, 0));
    expect(since('year')).toEqual(new Date(2026, 0, 1, 0, 0, 0));
  });
});
