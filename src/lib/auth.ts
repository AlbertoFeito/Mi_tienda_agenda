import { db } from '@/lib/db';

/**
 * Single-user local app lock (PIN).
 *
 * The PIN is never stored in clear text: we keep only a salted SHA-256 hash
 * (`salt$hash`) in the local settings row. This protects casual access to the
 * app on a shared device. It is not a substitute for full-disk encryption.
 */

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function randomSalt(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function getSettingsRow() {
  const rows = await db.settings.toArray();
  return rows[0];
}

/** Whether a PIN has been configured. */
export async function hasPin(): Promise<boolean> {
  const row = await getSettingsRow();
  return !!row?.pinHash;
}

/** Create or replace the app PIN. */
export async function setPin(pin: string): Promise<void> {
  const row = await getSettingsRow();
  if (!row?.id) return;
  const salt = randomSalt();
  const hash = await sha256Hex(`${salt}:${pin}`);
  await db.settings.update(row.id, { pinHash: `${salt}$${hash}` });
}

/** Verify a PIN against the stored hash. */
export async function verifyPin(pin: string): Promise<boolean> {
  const row = await getSettingsRow();
  if (!row?.pinHash) return false;
  const [salt, hash] = row.pinHash.split('$');
  if (!salt || !hash) return false;
  const candidate = await sha256Hex(`${salt}:${pin}`);
  return candidate === hash;
}
