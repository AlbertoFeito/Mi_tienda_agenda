import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import {
  TRIAL_DAYS,
  computeLicence,
  formatDeviceId,
  formatLicence,
  licenceStatus,
  newDeviceId,
  normalizeCode,
  verifyLicence,
} from '@/lib/license';

const SECRET = 'secreto-de-prueba';
const DEVICE = '7K3M92QXBD';

describe('normalizeCode', () => {
  it('ignores formatting and case', () => {
    expect(normalizeCode('7k3m9-2qxbd')).toBe('7K3M92QXBD');
    expect(normalizeCode(' 7K3M9 2QXBD ')).toBe('7K3M92QXBD');
  });

  it('forgives the characters people confuse when copying by hand', () => {
    // I and L read as 1, O reads as 0.
    expect(normalizeCode('I23')).toBe('123');
    expect(normalizeCode('L23')).toBe('123');
    expect(normalizeCode('O12')).toBe('012');
  });
});

describe('device codes', () => {
  it('generates 10 readable characters, never the ambiguous ones', () => {
    for (let i = 0; i < 50; i++) {
      const id = newDeviceId();
      expect(id).toHaveLength(10);
      expect(id).toMatch(/^[0-9ABCDEFGHJKMNPQRSTVWXYZ]+$/);
    }
  });

  it('does not repeat itself', () => {
    const ids = new Set(Array.from({ length: 200 }, () => newDeviceId()));
    expect(ids.size).toBe(200);
  });
});

describe('licences', () => {
  it('is stable for the same device and secret', async () => {
    const a = await computeLicence(DEVICE, SECRET);
    const b = await computeLicence(DEVICE, SECRET);
    expect(a).toBe(b);
    expect(a).toHaveLength(16);
  });

  it('unlocks the device it was issued for', async () => {
    const licence = await computeLicence(DEVICE, SECRET);
    expect(await verifyLicence(DEVICE, licence, SECRET)).toBe(true);
  });

  it('does not unlock a different phone — the whole point', async () => {
    const licence = await computeLicence(DEVICE, SECRET);
    expect(await verifyLicence('ZZZZZZZZZZ', licence, SECRET)).toBe(false);
  });

  it('rejects a licence made with another secret', async () => {
    const licence = await computeLicence(DEVICE, 'otro-secreto');
    expect(await verifyLicence(DEVICE, licence, SECRET)).toBe(false);
  });

  it('accepts the licence as the user types it, with dashes and lowercase', async () => {
    const licence = await computeLicence(DEVICE, SECRET);
    expect(await verifyLicence(DEVICE, formatLicence(licence).toLowerCase(), SECRET)).toBe(true);
  });

  it('accepts the device code formatted with a dash', async () => {
    const licence = await computeLicence(DEVICE, SECRET);
    expect(await verifyLicence(formatDeviceId(DEVICE), licence, SECRET)).toBe(true);
  });

  it('rejects empty and truncated codes', async () => {
    const licence = await computeLicence(DEVICE, SECRET);
    expect(await verifyLicence(DEVICE, '', SECRET)).toBe(false);
    expect(await verifyLicence(DEVICE, licence.slice(0, 15), SECRET)).toBe(false);
  });
});

describe('the seller tool matches the app', () => {
  it('takes the secret from the environment, not just from --secret', async () => {
    // How it is actually invoked when selling: LICENSE_SECRET=... node script <id>
    const fromApp = await computeLicence(DEVICE, SECRET);
    const fromScript = execFileSync('node', ['scripts/generar-licencia.mjs', DEVICE, '--solo-codigo'], {
      encoding: 'utf8',
      env: { ...process.env, LICENSE_SECRET: SECRET },
    }).trim();
    expect(fromScript).toBe(fromApp);
  });

  it('prints the device and licence lines in the readable form', () => {
    const out = execFileSync('node', ['scripts/generar-licencia.mjs', formatDeviceId(DEVICE)], {
      encoding: 'utf8',
      env: { ...process.env, LICENSE_SECRET: SECRET },
    });
    expect(out).toMatch(/Equipo:\s+7K3M9-2QXBD/);
    expect(out).toMatch(/Licencia:\s+([0-9A-Z]{4}-){3}[0-9A-Z]{4}/);
  });

  it('generates the same licence as the code running on the phone', async () => {
    const fromApp = await computeLicence(DEVICE, SECRET);
    const fromScript = execFileSync(
      'node',
      ['scripts/generar-licencia.mjs', DEVICE, '--secret', SECRET, '--solo-codigo'],
      { encoding: 'utf8' },
    ).trim();
    // If these ever drift, every licence sold would be rejected on the phone.
    expect(fromScript).toBe(fromApp);
  });
});

describe('the offline HTML generator matches the app', () => {
  // The seller may only have a phone, so the HTML tool carries its own
  // hand-written SHA-256. If it drifted from the app, every licence issued
  // from it would be rejected — hence checking the real file, not a copy.
  function loadHtmlGenerator() {
    const html = readFileSync('herramientas/generador-licencias.html', 'utf8');
    const core = html.match(/<script id="core">([\s\S]*?)<\/script>/);
    if (!core) throw new Error('no se encontró el bloque <script id="core">');
    const module = { exports: {} as Record<string, unknown> };
    new Function('module', core[1])(module);
    return module.exports as {
      calcularLicencia(equipo: string, secreto: string): string;
      normalizar(raw: string): string;
    };
  }

  it('produces the same licence as the app', async () => {
    const gen = loadHtmlGenerator();
    expect(gen.calcularLicencia(DEVICE, SECRET)).toBe(await computeLicence(DEVICE, SECRET));
  });

  it('agrees across many random devices and secrets', async () => {
    const gen = loadHtmlGenerator();
    for (let i = 0; i < 25; i++) {
      const device = newDeviceId();
      const secret = `secreto-${i}-ñ-áéí`; // non-ASCII: exercises the UTF-8 encoder
      expect(gen.calcularLicencia(device, secret)).toBe(await computeLicence(device, secret));
    }
  });

  it('normalizes codes the same way', () => {
    const gen = loadHtmlGenerator();
    for (const raw of ['7k3m9-2qxbd', ' O12 ', 'IL23', 'B587X-7WC16']) {
      expect(gen.normalizar(raw)).toBe(normalizeCode(raw));
    }
  });
});

describe('licenceStatus', () => {
  const day = 86_400_000;

  it('starts a fresh install on a full trial', () => {
    expect(licenceStatus({ licensed: false })).toEqual({ state: 'prueba', daysLeft: TRIAL_DAYS });
  });

  it('counts the days down', () => {
    const started = new Date('2026-01-01T00:00:00Z');
    const now = new Date(started.getTime() + 5 * day);
    expect(licenceStatus({ licensed: false, trialStartedAt: started.toISOString() }, now)).toEqual({
      state: 'prueba',
      daysLeft: TRIAL_DAYS - 5,
    });
  });

  it('expires once the trial runs out', () => {
    const started = new Date('2026-01-01T00:00:00Z');
    const now = new Date(started.getTime() + TRIAL_DAYS * day);
    expect(licenceStatus({ licensed: false, trialStartedAt: started.toISOString() }, now).state).toBe(
      'vencida',
    );
  });

  it('stays active forever once licensed', () => {
    const started = new Date('2020-01-01T00:00:00Z');
    expect(
      licenceStatus({ licensed: true, trialStartedAt: started.toISOString() }).state,
    ).toBe('activa');
  });

  it('does not hand out extra days when the clock is set backwards', () => {
    const started = new Date('2026-06-01T00:00:00Z');
    const now = new Date('2026-01-01T00:00:00Z'); // user moved the clock back
    const status = licenceStatus({ licensed: false, trialStartedAt: started.toISOString() }, now);
    expect(status.daysLeft).toBeLessThanOrEqual(TRIAL_DAYS);
  });

  it('survives a corrupted date instead of crashing', () => {
    expect(licenceStatus({ licensed: false, trialStartedAt: 'no-es-fecha' }).state).toBe('prueba');
  });
});
