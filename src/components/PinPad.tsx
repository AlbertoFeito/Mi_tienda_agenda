import { Delete } from 'lucide-react';

interface PinPadProps {
  pin: string;
  onDigit: (digit: string) => void;
  onBackspace: () => void;
  length?: number;
  busy?: boolean;
}

/**
 * Presentational PIN entry pad: the row of dots plus the numeric keypad.
 * Shared by the lock screen and the "change PIN" flow.
 */
export default function PinPad({ pin, onDigit, onBackspace, length = 4, busy = false }: PinPadProps) {
  return (
    <>
      <div className="flex gap-4 my-8">
        {Array.from({ length }).map((_, i) => (
          <div
            key={i}
            className={`w-4 h-4 rounded-full border-2 border-white/70 transition-colors ${
              i < pin.length ? 'bg-white' : 'bg-transparent'
            }`}
          />
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4 w-full max-w-xs">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button
            key={d}
            onClick={() => onDigit(d)}
            disabled={busy}
            className="h-16 rounded-2xl bg-white/10 active:bg-white/25 text-2xl font-medium transition-colors disabled:opacity-50"
          >
            {d}
          </button>
        ))}
        <div />
        <button
          onClick={() => onDigit('0')}
          disabled={busy}
          className="h-16 rounded-2xl bg-white/10 active:bg-white/25 text-2xl font-medium transition-colors disabled:opacity-50"
        >
          0
        </button>
        <button
          onClick={onBackspace}
          disabled={busy}
          className="h-16 rounded-2xl flex items-center justify-center active:bg-white/15 transition-colors disabled:opacity-50"
          aria-label="Borrar"
        >
          <Delete size={24} />
        </button>
      </div>
    </>
  );
}
