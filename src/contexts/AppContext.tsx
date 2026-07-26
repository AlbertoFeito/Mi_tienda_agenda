import React, { createContext, useContext, useCallback, useState } from 'react';
import { useLiveQuery } from '@/lib/live';
import { db } from '@/lib/db';
import type { AppSettings, Currency } from '@/types';

export type SettingsTab = 'rates' | 'store' | 'data';

interface AppContextType {
  settings: AppSettings | undefined;
  currencyRates: { USD: number; EUR: number; MLC: number };
  updateRates: (usd: number, eur: number, mlc: number) => Promise<void>;
  updateStoreInfo: (info: Partial<AppSettings>) => Promise<void>;
  convertToCUP: (amount: number, currency: Currency) => number;
  formatPrice: (amount: number, currency: Currency) => string;
  toast: ToastState | null;
  showToast: (message: string, type: ToastType) => void;
  /** Which Configuración tab is open, or null when it is closed. */
  settingsTab: SettingsTab | null;
  openSettings: (tab?: SettingsTab) => void;
  closeSettings: () => void;
}

type ToastType = 'success' | 'warning' | 'error';
interface ToastState {
  message: string;
  type: ToastType;
  id: number;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const settings = useLiveQuery(() => db.settings.toArray().then(s => s[0]), []);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [settingsTab, setSettingsTab] = useState<SettingsTab | null>(null);

  const openSettings = useCallback((tab: SettingsTab = 'rates') => setSettingsTab(tab), []);
  const closeSettings = useCallback(() => setSettingsTab(null), []);

  const currencyRates = {
    USD: settings?.usdRate ?? 320,
    EUR: settings?.eurRate ?? 350,
    MLC: settings?.mlcRate ?? 300,
  };

  const convertToCUP = useCallback((amount: number, currency: Currency): number => {
    if (currency === 'CUP') return amount;
    return amount * (currencyRates[currency] ?? 1);
  }, [currencyRates]);

  const formatPrice = useCallback((amount: number, currency: Currency): string => {
    const formatted = new Intl.NumberFormat('es-CU', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
    return `${formatted} ${currency}`;
  }, []);

  const updateRates = useCallback(async (usd: number, eur: number, mlc: number) => {
    if (!settings?.id) return;
    await db.settings.update(settings.id, {
      usdRate: usd,
      eurRate: eur,
      mlcRate: mlc,
      ratesReviewedAt: new Date().toISOString(),
      updatedAt: new Date(),
    });
  }, [settings]);

  const updateStoreInfo = useCallback(async (info: Partial<AppSettings>) => {
    if (!settings?.id) return;
    await db.settings.update(settings.id, {
      ...info,
      updatedAt: new Date(),
    });
  }, [settings]);

  const showToast = useCallback((message: string, type: ToastType) => {
    const id = Date.now();
    setToast({ message, type, id });
    setTimeout(() => {
      setToast(prev => (prev?.id === id ? null : prev));
    }, 3000);
  }, []);

  return (
    <AppContext.Provider value={{
      settings,
      currencyRates,
      updateRates,
      updateStoreInfo,
      convertToCUP,
      formatPrice,
      toast,
      showToast,
      settingsTab,
      openSettings,
      closeSettings,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
}
