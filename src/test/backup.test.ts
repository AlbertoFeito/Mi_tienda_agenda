import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/lib/db';
import { shareBackup } from '@/lib/backup';
import { TABLE_NAMES } from '@/lib/store';

async function wipeAll() {
  for (const table of TABLE_NAMES) {
    // @ts-expect-error indexed access over the db table map
    await db[table].clear();
  }
}

async function seedSettings(storeName: string) {
  await db.settings.add({
    storeName,
    primaryCurrency: 'CUP',
    usdRate: 320,
    eurRate: 350,
    mlcRate: 300,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

describe('backup', () => {
  beforeEach(async () => {
    localStorage.clear();
    await wipeAll();
    // jsdom ships no object-URL support, and the browser fallback path needs it.
    URL.createObjectURL = () => 'blob:test';
    URL.revokeObjectURL = () => {};
  });

  it('names the file after the store, stripping accents and spaces', async () => {
    await seedSettings('Boutique Ñaña Pérez');
    let downloaded = '';
    // In the browser fallback the backup is downloaded, so the anchor's
    // `download` attribute carries the filename we want to check.
    const realCreate = document.createElement.bind(document);
    document.createElement = ((tag: string) => {
      const el = realCreate(tag);
      if (tag === 'a') {
        Object.defineProperty(el, 'click', {
          value: () => {
            downloaded = (el as HTMLAnchorElement).download;
          },
        });
      }
      return el;
    }) as typeof document.createElement;

    try {
      await shareBackup();
    } finally {
      document.createElement = realCreate;
    }

    expect(downloaded).toMatch(/^Boutique-Nana-Perez-copia-\d{4}-\d{2}-\d{2}\.json$/);
  });

  it('marks a shared backup apart from the automatic one', async () => {
    await seedSettings('Mi Tienda');
    await shareBackup();
    const row = (await db.settings.toArray())[0];
    // Both move, but only `lastSharedBackupAt` proves it left the phone.
    expect(row.lastBackupAt).toBeDefined();
    expect(row.lastSharedBackupAt).toBeDefined();
  });
});
