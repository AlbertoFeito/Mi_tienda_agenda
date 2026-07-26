#!/usr/bin/env node
/**
 * Genera la licencia de un teléfono a partir de su código de equipo.
 *
 *   node scripts/generar-licencia.mjs 7K3M9-2QXBD
 *
 * El secreto sale de la variable LICENSE_SECRET y tiene que ser el mismo con
 * el que se compiló el APK (VITE_LICENSE_SECRET). Si no coinciden, el código
 * que generes aquí no le servirá a nadie.
 *
 * Este archivo va aparte de la app a propósito: es lo único que necesitas
 * guardar en tu máquina y no repartir.
 */

import { createHmac } from 'node:crypto';

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const LICENCE_CHARS = 16;

function toBase32(bytes, length) {
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

function normalizeCode(raw) {
  return (raw || '')
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '')
    .replace(/[IL]/g, '1')
    .replace(/O/g, '0');
}

function group(code, size) {
  return (code.match(new RegExp(`.{1,${size}}`, 'g')) || []).join('-');
}

function computeLicence(deviceId, secret) {
  const digest = createHmac('sha256', secret)
    .update(`nayadestore:v1:${normalizeCode(deviceId)}`)
    .digest();
  return toBase32(digest, LICENCE_CHARS);
}

const args = process.argv.slice(2);
let secret = process.env.LICENSE_SECRET || 'nayadestore-dev-secret';
let onlyCode = false;
const positional = [];

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--secret') {
    secret = args[++i] ?? secret;
  } else if (args[i] === '--solo-codigo') {
    onlyCode = true;
  } else if (!args[i].startsWith('--')) {
    positional.push(args[i]);
  }
}

const deviceId = positional[0];

if (!deviceId) {
  console.error('Uso: node scripts/generar-licencia.mjs <código-de-equipo>');
  console.error('Ejemplo: node scripts/generar-licencia.mjs 7K3M9-2QXBD');
  process.exit(1);
}

const normalized = normalizeCode(deviceId);
const licence = computeLicence(normalized, secret);

if (onlyCode) {
  process.stdout.write(licence);
} else {
  if (secret === 'nayadestore-dev-secret') {
    console.error('AVISO: estás usando el secreto de desarrollo. No sirve para vender.\n');
  }
  console.log(`Equipo:   ${group(normalized, 5)}`);
  console.log(`Licencia: ${group(licence, 4)}`);
}
