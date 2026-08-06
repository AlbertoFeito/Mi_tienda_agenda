import { describe, it, expect } from 'vitest';
import { looksLikeVCard, parseVCards } from '@/lib/vcard';
import { planImport } from '@/lib/csv';

/**
 * These cards copy the shape of a real export from an Android phone — vCard
 * 2.1, CRLF endings, quoted-printable names, several phones per contact — but
 * every name and number here is made up.
 */
function card(...lines: string[]): string {
  return ['BEGIN:VCARD', 'VERSION:2.1', ...lines, 'END:VCARD'].join('\r\n') + '\r\n';
}

describe('looksLikeVCard', () => {
  it('recognises a vCard', () => {
    expect(looksLikeVCard(card('FN:Ana'))).toBe(true);
  });

  it('does not mistake a CSV for one', () => {
    expect(looksLikeVCard('nombre,telefono\nAna,55512345')).toBe(false);
  });
});

describe('parseVCards', () => {
  it('reads a plain contact', () => {
    const { customers } = parseVCards(card('N:;Ana;;;', 'FN:Ana', 'TEL;CELL:+5355512345'));
    expect(customers).toEqual([
      { name: 'Ana', phone: '55512345', address: undefined, notes: undefined },
    ]);
  });

  it('reads every card in the file', () => {
    const text = card('FN:Ana', 'TEL;CELL:55512345') + card('FN:Yeni', 'TEL;CELL:55598765');
    expect(parseVCards(text).customers.map((c) => c.name)).toEqual(['Ana', 'Yeni']);
  });

  it('decodes an accented name instead of showing the hex', () => {
    // Without this, "Eliécer" arrives as "=45=6C=69=C3=A9=63=65=72".
    const { customers } = parseVCards(
      card(
        'N;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:;=45=6C=69=C3=A9=63=65=72;;;',
        'FN;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:=45=6C=69=C3=A9=63=65=72',
        'TEL;CELL:55512345',
      ),
    );
    expect(customers[0].name).toBe('Eliécer');
  });

  it('decodes a name with an emoji in it', () => {
    const { customers } = parseVCards(
      card('FN;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:=4C=61=79=6F=6E=20=F0=9F=92=AF', 'TEL;CELL:55512345'),
    );
    expect(customers[0].name).toBe('Layon 💯');
  });

  it('joins a quoted-printable soft line break', () => {
    const text =
      'BEGIN:VCARD\r\nVERSION:2.1\r\n' +
      'FN;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:=50=65=71=75=65=\r\n=C3=B1=61\r\n' +
      'TEL;CELL:55512345\r\nEND:VCARD\r\n';
    expect(parseVCards(text).customers[0].name).toBe('Pequeña');
  });

  it('joins a folded line', () => {
    // vCard 3.0 wraps long values onto a line starting with a space, and that
    // one space is the marker, not part of the text — so the fold can land in
    // the middle of a word and has to close back up seamlessly.
    const text =
      'BEGIN:VCARD\r\nVERSION:3.0\r\nFN:Ana Maria Nu\r\n nez Perez\r\nTEL;CELL:55512345\r\nEND:VCARD\r\n';
    expect(parseVCards(text).customers[0].name).toBe('Ana Maria Nunez Perez');
  });

  it('prefers FN over the split-up N', () => {
    const { customers } = parseVCards(card('N:Perez;Ana;;;', 'FN:Ana la de la esquina', 'TEL;CELL:55512345'));
    expect(customers[0].name).toBe('Ana la de la esquina');
  });

  it('builds the name from N when there is no FN', () => {
    // N is stored surname first; a person says it the other way round.
    const { customers } = parseVCards(card('N:Kitchen;Camila;;;', 'TEL;CELL:55512345'));
    expect(customers[0].name).toBe('Camila Kitchen');
  });

  it('falls back to the organisation when there is no name at all', () => {
    const { customers } = parseVCards(card('ORG:Proyecto ArteSano', 'TEL;CELL:55512345'));
    expect(customers[0].name).toBe('Proyecto ArteSano');
  });

  it('counts a card with no name instead of inventing one', () => {
    const { customers, skipped } = parseVCards(card('TEL;CELL:55512345'));
    expect(customers).toHaveLength(0);
    expect(skipped).toBe(1);
  });
});

describe('parseVCards phone numbers', () => {
  it('strips the country code', () => {
    expect(parseVCards(card('FN:Ana', 'TEL;CELL:+5351234567')).customers[0].phone).toBe('51234567');
  });

  it('reads a landline written with dashes', () => {
    expect(parseVCards(card('FN:Ana', 'TEL;HOME:598-765-43')).customers[0].phone).toBe('59876543');
  });

  it('takes the preferred number over the others', () => {
    const { customers } = parseVCards(
      card('FN:Ana', 'TEL;HOME:71234567', 'TEL;CELL;PREF:55512345'),
    );
    expect(customers[0].phone).toBe('55512345');
  });

  it('takes a mobile over a landline when neither is preferred', () => {
    const { customers } = parseVCards(card('FN:Ana', 'TEL;HOME:71234567', 'TEL;CELL:55512345'));
    expect(customers[0].phone).toBe('55512345');
  });

  it('understands the TYPE= form vCard 3.0 uses', () => {
    const { customers } = parseVCards(
      card('FN:Ana', 'TEL;TYPE=HOME:71234567', 'TEL;TYPE=CELL:55512345'),
    );
    expect(customers[0].phone).toBe('55512345');
  });

  it('keeps the other numbers in the notes rather than losing them', () => {
    const { customers } = parseVCards(
      card('FN:Ana', 'TEL;CELL;PREF:55512345', 'TEL;HOME:71234567'),
    );
    expect(customers[0].notes).toContain('Otro tel: 71234567');
  });

  it('does not repeat a number the file lists twice', () => {
    const { customers } = parseVCards(card('FN:Ana', 'TEL;CELL:55512345', 'TEL;HOME:+5355512345'));
    expect(customers[0].notes).toBeUndefined();
  });

  it('leaves out a contact whose only number is foreign', () => {
    // +1 555 019 0123. Kept, it would be dialled as +53 15550190.
    const { customers, skippedPhone } = parseVCards(card('FN:Prima de Miami', 'TEL;CELL:+15550190123'));
    expect(customers).toHaveLength(0);
    expect(skippedPhone).toBe(1);
  });

  it('leaves out an emergency short code', () => {
    const { customers, skippedPhone } = parseVCards(card('FN:Bomberos', 'TEL;CELL;PREF:105'));
    expect(customers).toHaveLength(0);
    expect(skippedPhone).toBe(1);
  });

  it('keeps a contact that has a Cuban number alongside a foreign one', () => {
    const { customers } = parseVCards(
      card('FN:Ana', 'TEL;CELL:+15550190123', 'TEL;HOME:55512345'),
    );
    expect(customers[0].phone).toBe('55512345');
  });

  it('keeps a contact that simply has no number', () => {
    // Nothing wrong with that: it is a missing datum, not a bad one.
    const { customers, skippedPhone } = parseVCards(card('FN:Ana'));
    expect(customers).toEqual([{ name: 'Ana', phone: undefined, address: undefined, notes: undefined }]);
    expect(skippedPhone).toBe(0);
  });
});

describe('parseVCards other fields', () => {
  it('joins the parts of a structured address', () => {
    const { customers } = parseVCards(
      card('FN:Ana', 'TEL;CELL:55512345', 'ADR;HOME:;;Calle 23 #456;La Habana;;10400;Cuba'),
    );
    expect(customers[0].address).toBe('Calle 23 #456, La Habana, 10400, Cuba');
  });

  it('keeps the note', () => {
    const { customers } = parseVCards(card('FN:Ana', 'TEL;CELL:55512345', 'NOTE:Paga los viernes'));
    expect(customers[0].notes).toBe('Paga los viernes');
  });

  it('adds the organisation to the notes when it is not the name', () => {
    const { customers } = parseVCards(
      card('FN:Ana', 'ORG:Proyecto ArteSano', 'TEL;CELL:55512345'),
    );
    expect(customers[0].notes).toBe('Proyecto ArteSano');
  });

  it('does not repeat the organisation when it is already the name', () => {
    const { customers } = parseVCards(card('ORG:Proyecto ArteSano', 'TEL;CELL:55512345'));
    expect(customers[0].notes).toBeUndefined();
  });

  it('undoes the escapes vCard puts in free text', () => {
    const { customers } = parseVCards(
      card('FN:Ana', 'TEL;CELL:55512345', 'NOTE:Debe 100\\, paga el 5\\; luego se ve\\nGracias'),
    );
    expect(customers[0].notes).toBe('Debe 100, paga el 5; luego se ve\nGracias');
  });

  it('reports the fields it read', () => {
    expect(parseVCards(card('FN:Ana', 'TEL;CELL:55512345')).columns).toContain('Teléfono');
  });

  it('survives an empty file', () => {
    expect(parseVCards('')).toEqual({ customers: [], skipped: 0, skippedPhone: 0, columns: [] });
  });

  it('still reads a card whose END is missing', () => {
    const text = 'BEGIN:VCARD\r\nVERSION:2.1\r\nFN:Ana\r\nTEL;CELL:55512345\r\n';
    expect(parseVCards(text).customers).toHaveLength(1);
  });
});

describe('planImport over a vCard', () => {
  it('works on the vCard reader exactly as it does on the CSV one', () => {
    const text = card('FN:Ana', 'TEL;CELL:55512345') + card('FN:Yeni', 'TEL;CELL:55598765');
    const plan = planImport(parseVCards(text), [{ name: 'Ana Pérez', phone: '+53 5551 2345' }]);
    expect(plan.toAdd.map((c) => c.name)).toEqual(['Yeni']);
    expect(plan.duplicates.map((c) => c.name)).toEqual(['Ana']);
  });

  it('carries the skipped-phone count through', () => {
    const text = card('FN:Ana', 'TEL;CELL:55512345') + card('FN:Bomberos', 'TEL;CELL:105');
    expect(planImport(parseVCards(text), []).skippedPhone).toBe(1);
  });
});
