import { cubanPhoneOrNull } from '@/components/PhoneField';
import type { ParsedCustomer, ParseResult } from './csv';

/**
 * Reading a customer list out of a vCard file.
 *
 * This is what the phone actually hands you. Exporting contacts from Android
 * writes a `.vcf`, not a CSV — the CSV export only exists on the Google
 * Contacts website — so this is the format that matters, and the one the app
 * asked for last.
 *
 * The files are old-fashioned: vCard 2.1 with CRLF line endings, accented
 * names hidden behind quoted-printable, one contact carrying four phone
 * numbers under invented labels. So this reads what it finds rather than
 * demanding a shape, and returns the same `ParseResult` the CSV reader does,
 * so the import screen never has to know which one it got.
 */

/** Cheap sniff, so the import screen can pick a reader from the content. */
export function looksLikeVCard(text: string): boolean {
  return /BEGIN:VCARD/i.test(text);
}

interface Property {
  name: string;
  /** Everything after the name, uppercased: `CELL`, `PREF`, `TYPE=CELL`. */
  params: string[];
  value: string;
}

/**
 * Put back together the lines the format split apart.
 *
 * Two different things wrap: vCard folds long values by starting the next line
 * with a space, and quoted-printable ends a line with `=` to mean "no line
 * break here". Both have to be undone before anything else, or a name gets
 * read as two properties.
 */
function unfold(text: string): string[] {
  const raw = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const lines: string[] = [];

  for (const line of raw) {
    const continuesFold = /^[ \t]/.test(line);
    const previous = lines[lines.length - 1];
    const continuesQuoted = previous !== undefined && previous.endsWith('=');

    if (continuesFold && lines.length) {
      lines[lines.length - 1] += line.slice(1);
    } else if (continuesQuoted) {
      lines[lines.length - 1] = previous.slice(0, -1) + line;
    } else {
      lines.push(line);
    }
  }

  return lines;
}

/** `=C3=A9` back to the byte it stands for, then read as UTF-8. */
function decodeQuotedPrintable(value: string): string {
  const bytes: number[] = [];
  for (let i = 0; i < value.length; i++) {
    if (value[i] === '=' && /^[0-9A-Fa-f]{2}$/.test(value.slice(i + 1, i + 3))) {
      bytes.push(parseInt(value.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      bytes.push(value.charCodeAt(i) & 0xff);
    }
  }
  try {
    return new TextDecoder('utf-8').decode(new Uint8Array(bytes));
  } catch {
    return value;
  }
}

/** The escapes vCard puts in free text, undone. */
function unescapeText(value: string): string {
  return value
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\');
}

function parseProperty(line: string): Property | null {
  const colon = line.indexOf(':');
  if (colon < 0) return null;

  const head = line.slice(0, colon).split(';');
  const name = head[0].trim().toUpperCase();
  if (!name) return null;

  const params = head.slice(1).map((p) => p.trim().toUpperCase());
  let value = line.slice(colon + 1);

  if (params.some((p) => p.includes('QUOTED-PRINTABLE'))) value = decodeQuotedPrintable(value);

  return { name, params, value: unescapeText(value).trim() };
}

/** Split a structured value on unescaped semicolons. */
function fields(value: string): string[] {
  return value.split(/(?<!\\);/).map((f) => unescapeText(f).trim());
}

/**
 * `N` is stored surname first; read it back in the order a person says it.
 * Fields are Family;Given;Middle;Prefix;Suffix.
 */
function nameFromN(value: string): string {
  const [family = '', given = '', middle = '', prefix = '', suffix = ''] = fields(value);
  return [prefix, given, middle, family, suffix].filter((p) => p).join(' ').trim();
}

/** How much we want a given TEL: PREF beats a mobile, a mobile beats the rest. */
function phoneRank(params: string[]): number {
  const all = params.join(',');
  if (all.includes('PREF')) return 0;
  if (/CELL|MOBILE|MÓVIL|MOVIL/.test(all)) return 1;
  return 2;
}

function cardToCustomer(lines: string[]): { customer?: ParsedCustomer; reason?: 'name' | 'phone' } {
  const props = lines.map(parseProperty).filter((p): p is Property => p !== null);

  let fn = '';
  let n = '';
  let org = '';
  let note = '';
  let address = '';
  const tels: { rank: number; raw: string }[] = [];

  for (const p of props) {
    switch (p.name) {
      case 'FN':
        if (!fn) fn = p.value;
        break;
      case 'N':
        if (!n) n = nameFromN(p.value);
        break;
      case 'ORG':
        if (!org) org = fields(p.value).filter((f) => f).join(' — ');
        break;
      case 'NOTE':
        if (!note) note = p.value;
        break;
      case 'ADR':
        if (!address) address = fields(p.value).filter((f) => f).join(', ');
        break;
      case 'LABEL':
        if (!address) address = p.value;
        break;
      case 'TEL':
        if (p.value.trim()) tels.push({ rank: phoneRank(p.params), raw: p.value });
        break;
    }
  }

  const name = fn || n || org;
  if (!name) return { reason: 'name' };

  // Best number first, then the rest in the order the file had them.
  const ordered = tels
    .map((t, i) => ({ ...t, i }))
    .sort((a, b) => a.rank - b.rank || a.i - b.i);

  const cuban: string[] = [];
  for (const t of ordered) {
    const digits = cubanPhoneOrNull(t.raw);
    if (digits && !cuban.includes(digits)) cuban.push(digits);
  }

  // Had numbers, none of them usable here: a foreign line, or a short code
  // like 103 for the fire brigade. Importing it would give a customer a number
  // the app would then dial with +53 in front.
  if (tels.length > 0 && cuban.length === 0) return { reason: 'phone' };

  const extras = cuban.slice(1).map((p) => `Otro tel: ${p}`);
  const notes = [note, org && org !== name ? org : '', ...extras].filter((x) => x).join('\n');

  return {
    customer: {
      name,
      phone: cuban[0],
      address: address || undefined,
      notes: notes || undefined,
    },
  };
}

/** Customers found in a vCard file, in the shape the CSV reader returns. */
export function parseVCards(text: string): ParseResult {
  const lines = unfold(text);

  const customers: ParsedCustomer[] = [];
  let skipped = 0;
  let skippedPhone = 0;
  let current: string[] | null = null;
  let sawCard = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (/^BEGIN:VCARD$/i.test(trimmed)) {
      current = [];
      sawCard = true;
      continue;
    }
    if (/^END:VCARD$/i.test(trimmed)) {
      if (current) {
        const { customer, reason } = cardToCustomer(current);
        if (customer) customers.push(customer);
        else if (reason === 'phone') skippedPhone += 1;
        else skipped += 1;
      }
      current = null;
      continue;
    }
    if (current && trimmed) current.push(line);
  }

  // A file whose last card never closed still counts.
  if (current && current.length) {
    const { customer, reason } = cardToCustomer(current);
    if (customer) customers.push(customer);
    else if (reason === 'phone') skippedPhone += 1;
    else skipped += 1;
  }

  const columns = sawCard ? ['Nombre', 'Teléfono', 'Dirección', 'Notas'] : [];
  return { customers, skipped, skippedPhone, columns };
}
