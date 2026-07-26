/**
 * Per-device licensing, verified entirely offline.
 *
 * Each install shows a device code. The seller turns that code into a licence
 * with `scripts/generar-licencia.mjs` (which holds the secret) and sends it
 * back; the app checks it locally, with no network involved.
 *
 * What this does and does not do: the licence only matches the device it was
 * issued for, so passing the APK plus a code to a friend gets them nothing.
 * It is deliberately not proof against someone unpacking the APK and editing
 * the bundled JavaScript — no client-side check survives that. The goal is
 * friction against casual copying, not tamper resistance.
 */

/** Crockford-style base32: no I, L, O or U, so codes can be read aloud. */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export const TRIAL_DAYS = 15;
const DEVICE_CHARS = 10;
const LICENCE_CHARS = 16;

/** Encode bytes as base32 over the readable alphabet, truncated to `length`. */
function toBase32(bytes: Uint8Array, length: number): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of bytes) {
    value = ((value << 8) | byte) >>> 0;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
      value = value & ((1 << bits) - 1);
      if (out.length === length) return out;
    }
  }
  return out.padEnd(length, ALPHABET[0]);
}

/** Split a code into dash-separated groups so it is easier to read and type. */
export function group(code: string, size: number): string {
  return (code.match(new RegExp(`.{1,${size}}`, 'g')) || []).join('-');
}

/**
 * Strip formatting and fix the substitutions people make when copying by hand:
 * I and L look like 1, O looks like 0.
 */
export function normalizeCode(raw: string): string {
  return (raw || '')
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '')
    .replace(/[IL]/g, '1')
    .replace(/O/g, '0');
}

/** A fresh random device code. Stored in settings, so a backup carries it. */
export function newDeviceId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return toBase32(bytes, DEVICE_CHARS);
}

async function hmac(secret: string, message: string): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return new Uint8Array(sig);
}

/** The licence that unlocks `deviceId`. Same input always gives the same code. */
export async function computeLicence(deviceId: string, secret: string): Promise<string> {
  const digest = await hmac(secret, `nayadestore:v1:${normalizeCode(deviceId)}`);
  return toBase32(digest, LICENCE_CHARS);
}

/** Whether `licence` is the right code for this device. */
export async function verifyLicence(
  deviceId: string,
  licence: string,
  secret: string,
): Promise<boolean> {
  const expected = await computeLicence(deviceId, secret);
  const given = normalizeCode(licence);
  if (given.length !== expected.length) return false;
  // Compare every character so the timing does not leak the correct prefix.
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ given.charCodeAt(i);
  }
  return diff === 0;
}

export type LicenceState = 'activa' | 'prueba' | 'vencida';

export interface LicenceStatus {
  state: LicenceState;
  /** Days left in the trial; 0 once it has run out. */
  daysLeft: number;
}

/**
 * Where this install stands. An activated licence never expires; otherwise the
 * trial runs for TRIAL_DAYS from the first launch.
 */
export function licenceStatus(
  opts: { licensed: boolean; trialStartedAt?: string },
  now: Date = new Date(),
): LicenceStatus {
  if (opts.licensed) return { state: 'activa', daysLeft: 0 };
  if (!opts.trialStartedAt) return { state: 'prueba', daysLeft: TRIAL_DAYS };

  const started = new Date(opts.trialStartedAt).getTime();
  if (Number.isNaN(started)) return { state: 'prueba', daysLeft: TRIAL_DAYS };

  const elapsedDays = Math.floor((now.getTime() - started) / 86_400_000);
  const daysLeft = TRIAL_DAYS - elapsedDays;
  // A clock set backwards should not extend the trial past its full length.
  if (daysLeft > TRIAL_DAYS) return { state: 'prueba', daysLeft: TRIAL_DAYS };
  if (daysLeft <= 0) return { state: 'vencida', daysLeft: 0 };
  return { state: 'prueba', daysLeft };
}

/**
 * The signing secret, injected at build time via VITE_LICENSE_SECRET.
 *
 * The fallback only exists so a development build runs; ship with the variable
 * set, or every install shares the same publicly known codes.
 */
export function licenceSecret(): string {
  return (import.meta.env?.VITE_LICENSE_SECRET as string | undefined) || 'nayadestore-dev-secret';
}

/** True when the build went out without a real secret configured. */
export function usingDevSecret(): boolean {
  return licenceSecret() === 'nayadestore-dev-secret';
}

export const formatDeviceId = (id: string) => group(id, 5);
export const formatLicence = (code: string) => group(code, 4);
