import { describe, it, expect } from 'vitest';
import { normalizeCubanPhone, isValidCubanPhone, cubanPhoneOrNull } from '@/components/PhoneField';

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

  describe('cubanPhoneOrNull', () => {
    it('accepts the 8 digits however they are written', () => {
      expect(cubanPhoneOrNull('52345678')).toBe('52345678');
      expect(cubanPhoneOrNull('523-456-78')).toBe('52345678');
      expect(cubanPhoneOrNull('+53 5234 5678')).toBe('52345678');
      expect(cubanPhoneOrNull('0053 52345678')).toBe('52345678');
    });

    it('refuses a foreign number instead of cutting it down to 8 digits', () => {
      // normalizeCubanPhone turns this into 15550190, a number nobody has,
      // which the app would then dial as +53 15550190.
      expect(normalizeCubanPhone('+15550190123')).toBe('15550190');
      expect(cubanPhoneOrNull('+15550190123')).toBeNull();
      expect(cubanPhoneOrNull('+39 320 000 0000')).toBeNull();
      expect(cubanPhoneOrNull('+8615550190626')).toBeNull();
    });

    it('refuses a short code', () => {
      expect(cubanPhoneOrNull('105')).toBeNull();
      expect(cubanPhoneOrNull('2266')).toBeNull();
    });

    it('refuses nothing at all', () => {
      expect(cubanPhoneOrNull('')).toBeNull();
      expect(cubanPhoneOrNull('sin telefono')).toBeNull();
    });
  });
});
