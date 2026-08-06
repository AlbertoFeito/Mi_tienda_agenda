import { normalizeCubanPhone } from '@/components/PhoneField';

/**
 * Reading a customer list out of a CSV.
 *
 * The file will not arrive tidy. It may come from Excel in Spanish, which uses
 * semicolons and stamps a BOM on the front; from Google Contacts, whose columns
 * are named nothing like ours; or typed by hand with the columns in any order.
 * So instead of demanding a format, this recognises what it finds and reports
 * honestly on the rows it could not use.
 */

export interface ParsedCustomer {
  name: string;
  phone?: string;
  address?: string;
  notes?: string;
}

export interface ParseResult {
  customers: ParsedCustomer[];
  /** Rows that carried no usable name. */
  skipped: number;
  /** Column headings that were recognised, for showing back to the user. */
  columns: string[];
}

/** Strip the byte-order mark Excel writes, which otherwise poisons the first heading. */
function stripBOM(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/**
 * Comma or semicolon, whichever the header row uses more.
 *
 * Excel in a Spanish locale writes semicolons, and guessing wrong turns the
 * whole file into a single column.
 */
export function detectDelimiter(headerLine: string): string {
  const commas = (headerLine.match(/,/g) || []).length;
  const semis = (headerLine.match(/;/g) || []).length;
  const tabs = (headerLine.match(/\t/g) || []).length;
  if (tabs > commas && tabs > semis) return '\t';
  return semis > commas ? ';' : ',';
}

/**
 * Split CSV text into rows of fields, honouring quoted fields.
 *
 * A name like "Pérez, Ana" carries the delimiter inside it, so splitting on the
 * delimiter alone would tear the row apart.
 */
export function parseCSV(text: string, delimiter?: string): string[][] {
  const clean = stripBOM(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const firstLine = clean.split('\n')[0] ?? '';
  const delim = delimiter ?? detectDelimiter(firstLine);

  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];

    if (inQuotes) {
      if (ch === '"') {
        // A doubled quote inside a quoted field is a literal quote.
        if (clean[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') inQuotes = true;
    else if (ch === delim) {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }

  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => r.some((f) => f.trim() !== ''));
}

/** Lowercase, unaccented, trimmed — for matching headings however they are written. */
function fold(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Headings we recognise, in Spanish, English, and as Google Contacts writes
 * them — that export is where most of these files will come from.
 */
const HEADINGS: Record<keyof ParsedCustomer, string[]> = {
  name: ['nombre', 'nombres', 'name', 'first name', 'nombre completo', 'full name', 'cliente'],
  phone: [
    'telefono',
    'telefono movil',
    'movil',
    'celular',
    'phone',
    'mobile',
    'phone 1 - value',
    'numero',
    'contacto',
  ],
  address: ['direccion', 'address', 'domicilio', 'address 1 - formatted'],
  notes: ['notas', 'nota', 'notes', 'observaciones', 'comentario'],
};

function matchColumn(heading: string): keyof ParsedCustomer | null {
  const f = fold(heading);
  for (const [field, names] of Object.entries(HEADINGS) as [keyof ParsedCustomer, string[]][]) {
    if (names.some((n) => f === n)) return field;
  }
  // Loose match as a fallback: "Teléfono particular", "Home phone".
  for (const [field, names] of Object.entries(HEADINGS) as [keyof ParsedCustomer, string[]][]) {
    if (names.some((n) => f.includes(n))) return field;
  }
  return null;
}

/** Google Contacts splits the name; glue the parts back together. */
function googleName(row: string[], index: Record<string, number>): string {
  const parts = ['first name', 'middle name', 'last name']
    .map((h) => (index[h] !== undefined ? row[index[h]] : ''))
    .filter((v) => v && v.trim());
  return parts.join(' ').trim();
}

/** Customers found in a CSV, however the file is laid out. */
export function parseCustomers(text: string): ParseResult {
  const rows = parseCSV(text);
  if (!rows.length) return { customers: [], skipped: 0, columns: [] };

  const header = rows[0];
  const byField: Partial<Record<keyof ParsedCustomer, number>> = {};
  const rawIndex: Record<string, number> = {};
  const columns: string[] = [];

  header.forEach((h, i) => {
    rawIndex[fold(h)] = i;
    const field = matchColumn(h);
    if (field && byField[field] === undefined) {
      byField[field] = i;
      columns.push(h.trim());
    }
  });

  // No recognisable heading: assume the plainest layout there is, name first
  // and phone second, and treat every row as data.
  const headerless = byField.name === undefined;
  const dataRows = headerless ? rows : rows.slice(1);

  const customers: ParsedCustomer[] = [];
  let skipped = 0;

  for (const row of dataRows) {
    const pick = (field: keyof ParsedCustomer, fallbackIndex?: number): string => {
      const i = byField[field] ?? fallbackIndex;
      return i !== undefined && row[i] !== undefined ? row[i].trim() : '';
    };

    // Google splits the name across columns, and "First Name" also looks like
    // a plain name heading — so without checking for the surname first, only
    // first names would be imported.
    const googleLayout =
      rawIndex['first name'] !== undefined && rawIndex['last name'] !== undefined;

    let name = googleLayout
      ? googleName(row, rawIndex)
      : headerless
        ? pick('name', 0)
        : pick('name');
    if (!name && rawIndex['first name'] !== undefined) name = googleName(row, rawIndex);

    if (!name) {
      skipped += 1;
      continue;
    }

    const phone = normalizeCubanPhone(headerless ? pick('phone', 1) : pick('phone'));

    customers.push({
      name,
      phone: phone || undefined,
      address: pick('address') || undefined,
      notes: pick('notes') || undefined,
    });
  }

  return { customers, skipped, columns };
}

export interface ImportPlan {
  /** Customers that are not in the book yet. */
  toAdd: ParsedCustomer[];
  /** Already there, matched by phone or — lacking one — by name. */
  duplicates: ParsedCustomer[];
  skipped: number;
}

/**
 * What an import would actually do, worked out before anything is written.
 *
 * Nothing is overwritten and nothing is merged: importing the same file twice
 * must not leave the book full of doubles.
 */
export function planImport(
  parsed: ParseResult,
  existing: { name: string; phone?: string }[],
): ImportPlan {
  const phones = new Set(
    existing.map((c) => normalizeCubanPhone(c.phone || '')).filter((p) => p.length > 0),
  );
  const names = new Set(existing.map((c) => fold(c.name)));

  const toAdd: ParsedCustomer[] = [];
  const duplicates: ParsedCustomer[] = [];

  for (const c of parsed.customers) {
    const isDupe = c.phone ? phones.has(c.phone) : names.has(fold(c.name));
    if (isDupe) {
      duplicates.push(c);
      continue;
    }
    // Guard against repeats inside the file itself, too.
    if (c.phone) phones.add(c.phone);
    else names.add(fold(c.name));
    toAdd.push(c);
  }

  return { toAdd, duplicates, skipped: parsed.skipped };
}
