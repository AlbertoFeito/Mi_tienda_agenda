import { useEffect, type ReactNode } from 'react';
import { useApp } from '@/contexts/AppContext';
import { licenceStatus, newDeviceId } from '@/lib/license';
import LicenseScreen from '@/components/LicenseScreen';

/**
 * Assigns this install its device code on first launch, starts the trial clock,
 * and puts the activation screen in front of everything once it runs out.
 */
export default function LicenseGate({ children }: { children: ReactNode }) {
  const { settings, updateStoreInfo } = useApp();

  useEffect(() => {
    if (!settings) return;
    const patch: { deviceId?: string; trialStartedAt?: string } = {};
    if (!settings.deviceId) patch.deviceId = newDeviceId();
    if (!settings.trialStartedAt) patch.trialStartedAt = new Date().toISOString();
    if (Object.keys(patch).length) updateStoreInfo(patch);
  }, [settings, updateStoreInfo]);

  // Settings still loading, or the device code has not been stored yet.
  if (!settings?.deviceId) return <>{children}</>;

  const status = licenceStatus({
    licensed: Boolean(settings.licenseKey),
    trialStartedAt: settings.trialStartedAt,
  });

  if (status.state === 'vencida') return <LicenseScreen deviceId={settings.deviceId} />;

  return <>{children}</>;
}
