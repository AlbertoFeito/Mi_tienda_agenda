import { Capacitor } from '@capacitor/core';
import { normalizeCubanPhone } from '@/components/PhoneField';

/**
 * Integration with the phone's address book (local, offline):
 *  - pick an existing contact to fill in a new customer, and
 *  - optionally save a new customer back to the phone contacts.
 */

export function contactsSupported(): boolean {
  return Capacitor.isNativePlatform();
}

/** Let the user pick a contact; returns name + normalized Cuban phone. */
export async function pickPhoneContact(): Promise<{ name: string; phone: string } | null> {
  if (!Capacitor.isNativePlatform()) return null;
  try {
    const { Contacts } = await import('@capacitor-community/contacts');
    const perm = await Contacts.requestPermissions();
    if (perm.contacts !== 'granted') return null;

    const result = await Contacts.pickContact({ projection: { name: true, phones: true } });
    const c = result.contact;
    const name =
      c?.name?.display ||
      [c?.name?.given, c?.name?.middle, c?.name?.family].filter(Boolean).join(' ') ||
      '';
    const rawPhone = c?.phones?.find((p) => p.number)?.number || '';
    return { name: name.trim(), phone: normalizeCubanPhone(rawPhone) };
  } catch {
    return null;
  }
}

/** Save a customer to the phone's contacts. Returns true on success. */
export async function savePhoneContact(name: string, phone: string): Promise<boolean> {
  if (!Capacitor.isNativePlatform() || !name.trim()) return false;
  try {
    const { Contacts, PhoneType } = await import('@capacitor-community/contacts');
    const perm = await Contacts.requestPermissions();
    if (perm.contacts !== 'granted') return false;

    await Contacts.createContact({
      contact: {
        name: { given: name.trim() },
        phones: phone ? [{ type: PhoneType.Mobile, number: `+53${phone}` }] : [],
      },
    });
    return true;
  } catch {
    return false;
  }
}
