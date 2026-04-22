import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { AppProvider, useApp } from '@/contexts/AppContext';
import { db } from '@/lib/db';

vi.mock('@/lib/db', () => ({
  db: {
    settings: {
      toArray: vi.fn().mockResolvedValue([{
        id: 1,
        storeName: 'Mi Tienda',
        primaryCurrency: 'CUP',
        usdRate: 320,
        eurRate: 350,
        mlcRate: 300,
      }]),
    },
    settings: {
      update: vi.fn().mockResolvedValue(1),
    },
  },
}));

describe('AppContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useApp', () => {
    it('should throw error when used outside AppProvider', () => {
      const { result } = renderHook(() => useApp());
      expect(result.error).toBeDefined();
    });

    it('should provide default currency rates', async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AppProvider>{children}</AppProvider>
      );

      const { result } = renderHook(() => useApp(), { wrapper });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      // Context should have conversion functions without throwing
      expect(result.current).toBeDefined();
      expect(typeof result.current.convertToCUP).toBe('function');
      expect(typeof result.current.formatPrice).toBe('function');
    });
  });

  describe('Currency Conversion', () => {
    it('should return same value when currency is CUP', async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AppProvider>{children}</AppProvider>
      );

      const { result } = renderHook(() => useApp(), { wrapper });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      expect(result.current.convertToCUP(100, 'CUP')).toBe(100);
    });
  });
});