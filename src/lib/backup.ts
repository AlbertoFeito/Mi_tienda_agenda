import { Capacitor } from '@capacitor/core';
import { db, exportData } from '@/lib/db';

/**
 * Local data backup.
 *
 * The whole database lives only on the device, so losing the phone means
 * losing everything. These helpers write a JSON backup that the user can share
 * (save to Drive, send by WhatsApp, copy to a PC, ...) and also create an
 * automatic daily backup file. Everything is local; no network is used.
 */

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** The store name, reduced to something safe to use inside a filename. */
function slug(name: string): string {
  const clean = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return clean || 'MiTienda';
}

/** Name the backup after the user's own store, so she can spot it later. */
async function backupFilename(): Promise<string> {
  const row = (await db.settings.toArray())[0];
  const d = new Date();
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return `${slug(row?.storeName || '')}-copia-${date}.json`;
}

async function markBackedUp(shared = false): Promise<void> {
  const row = (await db.settings.toArray())[0];
  if (!row?.id) return;
  const now = new Date().toISOString();
  await db.settings.update(row.id, {
    lastBackupAt: now,
    // Only a backup the user sent somewhere else survives losing the phone.
    ...(shared ? { lastSharedBackupAt: now } : {}),
  });
}

function downloadInBrowser(json: string, filename: string): void {
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Write a persistent backup file (Documents on device). Returns its URI. */
export async function createBackupFile(): Promise<string | undefined> {
  const json = await exportData();
  const filename = await backupFilename();

  if (!Capacitor.isNativePlatform()) {
    downloadInBrowser(json, filename);
    await markBackedUp();
    return undefined;
  }

  const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
  let directory = Directory.Documents;
  try {
    await Filesystem.writeFile({ path: filename, data: json, directory, encoding: Encoding.UTF8, recursive: true });
  } catch {
    directory = Directory.Data; // fall back to app-private storage
    await Filesystem.writeFile({ path: filename, data: json, directory, encoding: Encoding.UTF8, recursive: true });
  }
  await markBackedUp();
  const { uri } = await Filesystem.getUri({ path: filename, directory });
  return uri;
}

/** Create a backup and open the system share sheet so the user can store it. */
export async function shareBackup(): Promise<void> {
  const json = await exportData();
  const filename = await backupFilename();

  if (!Capacitor.isNativePlatform()) {
    downloadInBrowser(json, filename);
    await markBackedUp(true);
    return;
  }

  const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
  const { Share } = await import('@capacitor/share');
  await Filesystem.writeFile({ path: filename, data: json, directory: Directory.Cache, encoding: Encoding.UTF8, recursive: true });
  const { uri } = await Filesystem.getUri({ path: filename, directory: Directory.Cache });
  await markBackedUp(true);
  const store = (await db.settings.toArray())[0]?.storeName?.trim() || 'Mi Tienda';
  await Share.share({
    title: `Copia de seguridad de ${store}`,
    text: `Copia de seguridad de ${store}`,
    url: uri,
  });
}

/** Create a backup automatically at most once every 24h. */
export async function maybeAutoBackup(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const row = (await db.settings.toArray())[0];
    const last = row?.lastBackupAt ? new Date(row.lastBackupAt).getTime() : 0;
    if (Date.now() - last < 24 * 60 * 60 * 1000) return;
    await createBackupFile();
  } catch (err) {
    console.error('auto backup failed:', err);
  }
}
