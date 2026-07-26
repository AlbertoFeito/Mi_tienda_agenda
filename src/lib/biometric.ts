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

/**
 * Prompt for biometric auth. Resolves true on success, false otherwise.
 *
 * The store name is passed in so the system dialog says the name the user gave
 * their own shop, the same one shown everywhere else in the app.
 */
export async function biometricAuthenticate(
  opts: { reason?: string; storeName?: string } = {},
): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  const store = opts.storeName?.trim() || 'tu tienda';
  try {
    const { BiometricAuth } = await import('@aparajita/capacitor-biometric-auth');
    await BiometricAuth.authenticate({
      reason: opts.reason ?? `Desbloquea ${store}`,
      cancelTitle: 'Cancelar',
      allowDeviceCredential: false,
      androidTitle: `Desbloquear ${store}`,
      androidSubtitle: 'Usa tu huella para entrar',
      androidConfirmationRequired: false,
    });
    return true;
  } catch {
    // Thrown on failure, cancellation or when unavailable.
    return false;
  }
}
