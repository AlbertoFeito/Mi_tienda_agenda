import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Capacitor } from '@capacitor/core';
import { useLiveQuery } from '@/lib/live';
import { db } from '@/lib/db';
import { setPin, verifyPin } from '@/lib/auth';
import { biometricAvailable, biometricAuthenticate } from '@/lib/biometric';
import LockScreen from '@/components/LockScreen';

// Only re-lock after the app has been in the background for at least this long.
// Brief interruptions — including the biometric prompt itself, which briefly
// backgrounds the app — must not re-lock, otherwise the fingerprint dialog
// would keep popping up.
const LOCK_AFTER_MS = 30_000;

/**
 * Gates the whole app behind a single-user PIN (with optional fingerprint).
 *
 * - No PIN yet  -> ask the user to create one.
 * - PIN set     -> require it to unlock.
 * - Re-locks only after a real stay in the background (see LOCK_AFTER_MS).
 */
export default function AuthGate({ children }: { children: ReactNode }) {
  const settings = useLiveQuery(() => db.settings.toArray().then((s) => s[0]), []);
  const [unlocked, setUnlocked] = useState(false);
  const [canBiometric, setCanBiometric] = useState(false);
  const promptedRef = useRef(false);

  // Detect biometric availability when it's enabled in settings.
  useEffect(() => {
    if (settings?.biometricEnabled) biometricAvailable().then(setCanBiometric);
    else setCanBiometric(false);
  }, [settings?.biometricEnabled]);

  // Arm the fingerprint sensor once per lock: while locked, show the biometric
  // prompt a single time so a touch on the sensor unlocks. If the user cancels
  // or it fails, we don't re-prompt automatically (they can tap "Usar huella"
  // or type the PIN).
  useEffect(() => {
    if (unlocked) {
      promptedRef.current = false;
      return;
    }
    if (!settings?.pinHash || !settings?.biometricEnabled || !canBiometric) return;
    if (promptedRef.current) return;
    promptedRef.current = true;
    let active = true;
    biometricAuthenticate().then((ok) => {
      if (active && ok) setUnlocked(true);
    });
    return () => {
      active = false;
    };
  }, [unlocked, settings?.pinHash, settings?.biometricEnabled, canBiometric]);

  // Re-lock only after a genuine background stay, not on every brief pause.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let remove: (() => void) | undefined;
    let backgroundedAt = 0;
    import('@capacitor/app').then(({ App }) => {
      const pausePromise = App.addListener('pause', () => {
        backgroundedAt = Date.now();
      });
      const resumePromise = App.addListener('resume', () => {
        if (backgroundedAt && Date.now() - backgroundedAt > LOCK_AFTER_MS) {
          setUnlocked(false);
        }
        backgroundedAt = 0;
      });
      remove = () => {
        pausePromise.then((h) => h.remove());
        resumePromise.then((h) => h.remove());
      };
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
      onBiometric={
        canBiometric
          ? async () => {
              if (await biometricAuthenticate()) setUnlocked(true);
            }
          : undefined
      }
    />
  );
}
