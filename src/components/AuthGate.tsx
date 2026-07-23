import { useEffect, useState, type ReactNode } from 'react';
import { Capacitor } from '@capacitor/core';
import { useLiveQuery } from '@/lib/live';
import { db } from '@/lib/db';
import { setPin, verifyPin } from '@/lib/auth';
import LockScreen from '@/components/LockScreen';

/**
 * Gates the whole app behind a single-user PIN.
 *
 * - No PIN yet  -> ask the user to create one.
 * - PIN set     -> require it to unlock.
 * - Re-locks when the app goes to the background, so reopening asks again.
 */
export default function AuthGate({ children }: { children: ReactNode }) {
  const settings = useLiveQuery(() => db.settings.toArray().then((s) => s[0]), []);
  const [unlocked, setUnlocked] = useState(false);

  // Re-lock whenever the app is backgrounded (native only).
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let remove: (() => void) | undefined;
    import('@capacitor/app').then(({ App }) => {
      App.addListener('pause', () => setUnlocked(false)).then((handle) => {
        remove = () => handle.remove();
      });
    });
    return () => remove?.();
  }, []);

  // Settings still loading.
  if (settings === undefined) {
    return (
      <div className="fixed inset-0 bg-[#0F766E] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (unlocked) return <>{children}</>;

  if (!settings.pinHash) {
    return (
      <LockScreen
        mode="setup"
        onSubmit={async (pin) => {
          await setPin(pin);
          setUnlocked(true);
          return true;
        }}
      />
    );
  }

  return (
    <LockScreen
      mode="enter"
      onSubmit={async (pin) => {
        const ok = await verifyPin(pin);
        if (ok) setUnlocked(true);
        return ok;
      }}
    />
  );
}
