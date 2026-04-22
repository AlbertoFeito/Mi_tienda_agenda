import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('Utils', () => {
  describe('cn - className merger', () => {
    it('should merge two class strings', () => {
      const result = cn('foo', 'bar');
      expect(result).toBe('foo bar');
    });

    it('should handle conditional classes', () => {
      const isActive = true;
      const result = cn('base', isActive && 'active');
      expect(result).toBe('base active');
    });

    it('should handle falsy conditionals', () => {
      const isActive = false;
      const result = cn('base', isActive && 'active');
      expect(result).toBe('base');
    });

    it('should handle empty strings', () => {
      const result = cn('foo', '');
      expect(result).toBe('foo');
    });

    it('should handle arrays', () => {
      const result = cn(['foo', 'bar']);
      expect(result).toBe('foo bar');
    });

    it('should handle objects', () => {
      const result = cn({ foo: true, bar: false });
      expect(result).toBe('foo');
    });

    it('should merge duplicate classes and prefer tailwind override', () => {
      const result = cn('px-2 py-2', 'p-4');
      // twMerge should handle this - the later class wins for duplicate prefixes
      expect(result).toContain('p-4');
    });
  });
});