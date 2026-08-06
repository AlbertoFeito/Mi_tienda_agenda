interface PhoneFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

/** Keep only the 8 digits of a Cuban phone number. */
export function normalizeCubanPhone(raw: string): string {
  let digits = (raw || '').replace(/\D/g, '');
  // Drop a leading 53 country code if present.
  if (digits.length > 8 && digits.startsWith('53')) digits = digits.slice(2);
  return digits.slice(0, 8);
}

/**
 * The 8 digits of a Cuban number, or null if it is not one.
 *
 * `normalizeCubanPhone` exists for the input field, where a half-typed number
 * is normal, so it takes whatever it is given and keeps the first 8 digits.
 * That is wrong for imported data: a foreign number like +1 555 019 0123 would
 * become 15550190, an invented number the app would then dial with +53 in
 * front. Importing needs to be able to say "this is not a Cuban number".
 */
export function cubanPhoneOrNull(raw: string): string | null {
  let digits = (raw || '').replace(/\D/g, '');
  // "00" is how a + is written when the keypad has no plus.
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.length === 10 && digits.startsWith('53')) digits = digits.slice(2);
  return digits.length === 8 ? digits : null;
}

/** Cuban numbers are 8 digits (mobiles start with 5). Empty is allowed. */
export function isValidCubanPhone(value: string): boolean {
  const digits = normalizeCubanPhone(value);
  return digits.length === 0 || digits.length === 8;
}

/**
 * Phone input restricted to Cuban numbers: a fixed +53 prefix and up to 8
 * digits, numeric keypad only.
 */
export default function PhoneField({ value, onChange, placeholder, className = '' }: PhoneFieldProps) {
  const digits = normalizeCubanPhone(value);

  return (
    <div className={`flex items-stretch ${className}`}>
      <span className="inline-flex items-center px-3 h-12 rounded-l-lg border border-r-0 border-[#E2E8F0] bg-[#F1F5F9] text-[#475569] text-base select-none">
        +53
      </span>
      <input
        type="tel"
        inputMode="numeric"
        maxLength={8}
        value={digits}
        placeholder={placeholder ?? '5XXXXXXX'}
        onChange={(e) => onChange(normalizeCubanPhone(e.target.value))}
        className="flex-1 min-w-0 h-12 px-3 rounded-r-lg border border-[#E2E8F0] text-base focus:border-[#0F766E] focus:ring-2 focus:ring-[#0F766E]/10 outline-none"
      />
    </div>
  );
}
