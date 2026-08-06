import { describe, it, expect } from 'vitest';
import { detectDelimiter, parseCSV, parseCustomers, planImport } from '@/lib/csv';

describe('detectDelimiter', () => {
  it('picks the semicolon Excel writes in Spanish', () => {
    expect(detectDelimiter('nombre;telefono;direccion')).toBe(';');
  });

  it('picks the comma otherwise', () => {
    expect(detectDelimiter('nombre,telefono,direccion')).toBe(',');
  });

  it('handles a tab-separated file', () => {
    expect(detectDelimiter('nombre\ttelefono')).toBe('\t');
  });
});

describe('parseCSV', () => {
  it('keeps a comma that lives inside a quoted field', () => {
    // Splitting on the delimiter alone would tear "Pérez, Ana" in two.
    const rows = parseCSV('nombre,telefono\n"Pérez, Ana",55512345');
    expect(rows[1]).toEqual(['Pérez, Ana', '55512345']);
  });

  it('unescapes a doubled quote', () => {
    const rows = parseCSV('nombre\n"Ana ""la flaca"" Pérez"');
    expect(rows[1]).toEqual(['Ana "la flaca" Pérez']);
  });

  it('swallows the BOM Excel puts on the front', () => {
    const rows = parseCSV('﻿nombre,telefono\nAna,55512345');
    expect(rows[0][0]).toBe('nombre');
  });

  it('copes with Windows line endings', () => {
    expect(parseCSV('nombre,telefono\r\nAna,55512345')).toHaveLength(2);
  });

  it('drops blank lines instead of making empty customers', () => {
    expect(parseCSV('nombre\nAna\n\n\nYeni')).toHaveLength(3);
  });
});

describe('parseCustomers', () => {
  it('reads the plain Spanish layout', () => {
    const { customers } = parseCustomers(
      'nombre,telefono,direccion\nAna Pérez,55512345,Calle 23\nYeni,55598765,',
    );
    expect(customers).toEqual([
      { name: 'Ana Pérez', phone: '55512345', address: 'Calle 23', notes: undefined },
      { name: 'Yeni', phone: '55598765', address: undefined, notes: undefined },
    ]);
  });

  it('reads it with semicolons and accents in the headings', () => {
    const { customers } = parseCustomers('Nombre;Teléfono;Dirección\nAna;55512345;Centro');
    expect(customers[0]).toMatchObject({ name: 'Ana', phone: '55512345', address: 'Centro' });
  });

  it('reads English headings', () => {
    const { customers } = parseCustomers('Name,Phone\nAna,55512345');
    expect(customers[0]).toMatchObject({ name: 'Ana', phone: '55512345' });
  });

  it('reads a Google Contacts export', () => {
    // Where most of these files will actually come from.
    const csv =
      'First Name,Middle Name,Last Name,Phone 1 - Value\n' +
      'Ana,María,Pérez,+53 5551 2345\n' +
      'Yeni,,Gómez,55598765';
    const { customers } = parseCustomers(csv);
    expect(customers[0]).toMatchObject({ name: 'Ana María Pérez', phone: '55512345' });
    expect(customers[1]).toMatchObject({ name: 'Yeni Gómez', phone: '55598765' });
  });

  it('normalizes phones however they are written', () => {
    const csv = 'nombre,telefono\nA,+53 5551-2345\nB,53 55598765\nC,5 5 5 1 2 3 4 5';
    const { customers } = parseCustomers(csv);
    expect(customers.map((c) => c.phone)).toEqual(['55512345', '55598765', '55512345']);
  });

  it('leaves out a row whose number is not Cuban, and says so', () => {
    const { customers, skippedPhone } = parseCustomers(
      'nombre,telefono\nAna,55512345\nPrima de Miami,+15550190123',
    );
    expect(customers.map((c) => c.name)).toEqual(['Ana']);
    expect(skippedPhone).toBe(1);
  });

  it('keeps a row with no phone at all', () => {
    const { customers, skippedPhone } = parseCustomers('nombre,telefono\nAna,');
    expect(customers).toHaveLength(1);
    expect(skippedPhone).toBe(0);
  });

  it('counts the rows with no name instead of inventing one', () => {
    const { customers, skipped } = parseCustomers('nombre,telefono\nAna,55512345\n,55598765');
    expect(customers).toHaveLength(1);
    expect(skipped).toBe(1);
  });

  it('falls back to name-then-phone when no heading is recognisable', () => {
    const { customers } = parseCustomers('Ana Pérez,55512345\nYeni,55598765');
    expect(customers).toHaveLength(2);
    expect(customers[0]).toMatchObject({ name: 'Ana Pérez', phone: '55512345' });
  });

  it('reports which columns it understood', () => {
    const { columns } = parseCustomers('Nombre,Teléfono,Correo\nAna,55512345,a@b.cu');
    expect(columns).toContain('Nombre');
    expect(columns).toContain('Teléfono');
    // "Correo" is not something we store; it is simply left out.
    expect(columns).not.toContain('Correo');
  });

  it('survives an empty file', () => {
    expect(parseCustomers('')).toEqual({ customers: [], skipped: 0, columns: [] });
  });

  it('normalizes the phone rather than storing what was typed', () => {
    const { customers } = parseCustomers('nombre,telefono\nAna,+53 5551 2345');
    expect(customers[0].phone).toBe('55512345');
  });
});

describe('planImport', () => {
  const parse = (csv: string) => parseCustomers(csv);

  it('adds everyone when the book is empty', () => {
    const plan = planImport(parse('nombre,telefono\nAna,55512345\nYeni,55598765'), []);
    expect(plan.toAdd).toHaveLength(2);
    expect(plan.duplicates).toHaveLength(0);
  });

  it('leaves alone whoever is already there, matched by phone', () => {
    const plan = planImport(parse('nombre,telefono\nAna,55512345\nYeni,55598765'), [
      { name: 'Ana Pérez', phone: '+53 5551 2345' },
    ]);
    expect(plan.toAdd.map((c) => c.name)).toEqual(['Yeni']);
    expect(plan.duplicates.map((c) => c.name)).toEqual(['Ana']);
  });

  it('matches by name when there is no phone to go on', () => {
    const plan = planImport(parse('nombre\nAna Pérez\nYeni'), [{ name: 'ana pérez' }]);
    expect(plan.toAdd.map((c) => c.name)).toEqual(['Yeni']);
  });

  it('does not duplicate rows repeated inside the file itself', () => {
    const plan = planImport(parse('nombre,telefono\nAna,55512345\nAna,55512345'), []);
    expect(plan.toAdd).toHaveLength(1);
    expect(plan.duplicates).toHaveLength(1);
  });

  it('importing the same file twice adds nothing the second time', () => {
    const csv = 'nombre,telefono\nAna,55512345\nYeni,55598765';
    const first = planImport(parse(csv), []);
    const book = first.toAdd.map((c) => ({ name: c.name, phone: c.phone }));
    const second = planImport(parse(csv), book);
    expect(second.toAdd).toHaveLength(0);
    expect(second.duplicates).toHaveLength(2);
  });
});
