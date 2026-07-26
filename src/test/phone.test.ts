import { describe, it, expect } from 'vitest';
import { normalizeCubanPhone, isValidCubanPhone } from '@/components/PhoneField';

describe('Cuban phone helpers', () => {
  describe('normalizeCubanPhone', () => {
    it('keeps only digits', () => {
      expect(normalizeCubanPhone('5 234-5678')).toBe('52345678');
    });

    it('caps at 8 digits', () => {
      expect(normalizeCubanPhone('123456789012')).toBe('12345678');
    });

    it('drops a leading 53 country code', () => {
      expect(normalizeCubanPhone('+53 52345678')).toBe('52345678');
      expect(normalizeCubanPhone('5352345678')).toBe('52345678');
    });

    it('returns empty for no digits', () => {
      expect(normalizeCubanPhone('abc')).toBe('');
      expect(normalizeCubanPhone('')).toBe('');
    });
  });

  describe('isValidCubanPhone', () => {
    it('accepts an 8-digit number', () => {
      expect(isValidCubanPhone('52345678')).toBe(true);
    });

    it('accepts empty (phone is optional)', () => {
      expect(isValidCubanPhone('')).toBe(true);
    });

    it('rejects fewer than 8 digits', () => {
      expect(isValidCubanPhone('5234567')).toBe(false);
    });
  });
});
