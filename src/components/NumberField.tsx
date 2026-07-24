import { useEffect, useRef, useState } from 'react';
import { Minus, Plus } from 'lucide-react';

interface NumberFieldProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Allow decimals (prices). When false, the value is kept as an integer. */
  decimals?: boolean;
  /** Max digits before the decimal point (unlimited when omitted). */
  maxIntegerDigits?: number;
  /** Max digits after the decimal point (default 2). */
  maxDecimals?: number;
  placeholder?: string;
  /** Extra classes for the outer wrapper. */
  className?: string;
  disabled?: boolean;
}

/**
 * Numeric input with −/+ steppers (spinbox), used for prices, quantities,
 * stock, rates, etc. Keeps a text buffer so intermediate states (empty, a
 * trailing decimal point) are editable, while reporting a clamped number.
 * Enforces digit limits so the value always fits the field.
 */
export default function NumberField({
  value,
  onChange,
  min = 0,
  max,
  step = 1,
  decimals = false,
  maxIntegerDigits,
  maxDecimals = 2,
  placeholder,
  className = '',
  disabled = false,
}: NumberFieldProps) {
  const [text, setText] = useState<string>(value ? String(value) : '');
  const focused = useRef(false);

  // Keep the buffer in sync when the value changes from the outside
  // (but not while the user is typing).
  useEffect(() => {
    if (focused.current) return;
    const parsed = parseFloat(text);
    if (parsed !== value) setText(value ? String(value) : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const clamp = (n: number): number => {
    let r = n;
    if (min !== undefined && r < min) r = min;
    if (max !== undefined && r > max) r = max;
    if (!decimals) r = Math.round(r);
    return r;
  };

  const commit = (raw: string) => {
    const parsed = parseFloat(raw);
    onChange(Number.isFinite(parsed) ? clamp(parsed) : min ?? 0);
  };

  // Keep only valid characters and enforce the digit limits.
  const sanitize = (raw: string): string => {
    let cleaned = raw.replace(decimals ? /[^0-9.,]/g : /[^0-9]/g, '').replace(',', '.');
    if (decimals) {
      const [intRaw = '', ...rest] = cleaned.split('.');
      const intPart = maxIntegerDigits ? intRaw.slice(0, maxIntegerDigits) : intRaw;
      if (cleaned.includes('.')) {
        const decPart = rest.join('').slice(0, maxDecimals);
        cleaned = `${intPart}.${decPart}`;
      } else {
        cleaned = intPart;
      }
    } else if (maxIntegerDigits) {
      cleaned = cleaned.slice(0, maxIntegerDigits);
    }
    return cleaned;
  };

  const handleInput = (raw: string) => {
    const cleaned = sanitize(raw);
    setText(cleaned);
    if (cleaned === '' || cleaned === '.') {
      onChange(min ?? 0);
      return;
    }
    commit(cleaned);
  };

  const bump = (delta: number) => {
    const next = clamp((Number.isFinite(value) ? value : 0) + delta);
    onChange(next);
    setText(String(next));
  };

  const btn =
    'w-10 flex items-center justify-center text-[#0F766E] active:bg-[#0F766E]/10 disabled:opacity-30 disabled:active:bg-transparent transition-colors select-none flex-shrink-0';

  const atMin = min !== undefined && (Number.isFinite(value) ? value : 0) <= min;
  const atMax = max !== undefined && (Number.isFinite(value) ? value : 0) >= max;

  return (
    <div
      className={`flex items-stretch h-12 rounded-xl border border-[#E2E8F0] bg-white overflow-hidden transition-shadow focus-within:border-[#0F766E] focus-within:ring-2 focus-within:ring-[#0F766E]/15 ${
        disabled ? 'opacity-60' : ''
      } ${className}`}
    >
      <button
        type="button"
        onClick={() => bump(-step)}
        disabled={disabled || atMin}
        className={`${btn} border-r border-[#E2E8F0]`}
        aria-label="Disminuir"
      >
        <Minus size={16} strokeWidth={2.5} />
      </button>
      <input
        type="text"
        inputMode={decimals ? 'decimal' : 'numeric'}
        value={text}
        placeholder={placeholder}
        disabled={disabled}
        onFocus={() => (focused.current = true)}
        onBlur={() => {
          focused.current = false;
          if (text === '' || text === '.') {
            setText(min ? String(min) : '');
          } else {
            const parsed = parseFloat(text);
            const c = clamp(Number.isFinite(parsed) ? parsed : min ?? 0);
            setText(String(c));
          }
        }}
        onChange={(e) => handleInput(e.target.value)}
        className="flex-1 min-w-0 w-full px-1 text-center text-base font-semibold text-[#0F172A] tabular-nums bg-transparent outline-none placeholder:font-normal placeholder:text-[#CBD5E1]"
      />
      <button
        type="button"
        onClick={() => bump(step)}
        disabled={disabled || atMax}
        className={`${btn} border-l border-[#E2E8F0]`}
        aria-label="Aumentar"
      >
        <Plus size={16} strokeWidth={2.5} />
      </button>
    </div>
  );
}
