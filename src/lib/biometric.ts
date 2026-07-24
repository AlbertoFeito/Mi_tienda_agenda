import { Capacitor } from '@capacitor/core';

/**
 * Optional fingerprint/biometric unlock, as an alternative to typing the PIN.
 * The PIN always remains as a fallback.
 */

export async function biometricAvailable(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const { BiometricAuth } = await import('@aparajita/capacitor-biometric-auth');
    const info = await BiometricAuth.checkBiometry();
    return info.isAvailable;
  } catch {
    return false;
  }
}

/** Prompt for biometric auth. Resolves true on success, false otherwise. */
export async function biometricAuthenticate(reason = 'Desbloquea NayadeStore'): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const { BiometricAuth } = await import('@aparajita/capacitor-biometric-auth');
    await BiometricAuth.authenticate({
      reason,
      cancelTitle: 'Cancelar',
      allowDeviceCredential: false,
      androidTitle: 'Desbloquear NayadeStore',
      androidSubtitle: 'Usa tu huella para entrar',
      androidConfirmationRequired: false,
    });
    return true;
  } catch {
    // Thrown on failure, cancellation or when unavailable.
    return false;
  }
}
