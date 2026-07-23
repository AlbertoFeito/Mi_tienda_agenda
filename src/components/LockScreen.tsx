import { useState } from 'react';
import { Delete, Lock } from 'lucide-react';

const PIN_LENGTH = 4;

interface LockScreenProps {
  mode: 'setup' | 'enter';
  onSubmit: (pin: string) => Promise<boolean>;
}

/**
 * Full-screen PIN lock. In "setup" mode it asks for the PIN twice; in "enter"
 * mode it validates against the stored PIN via `onSubmit`.
 */
export default function LockScreen({ mode, onSubmit }: LockScreenProps) {
  const [pin, setPin] = useState('');
  const [firstPin, setFirstPin] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const confirming = mode === 'setup' && firstPin !== null;
  const title = mode === 'setup'
    ? (confirming ? 'Repite el PIN' : 'Crea un PIN')
    : 'Introduce tu PIN';
  const subtitle = mode === 'setup'
    ? 'Protege el acceso a NayadeStore con un PIN de 4 dígitos.'
    : 'Ingresa tu PIN para continuar.';

  const handleComplete = async (fullPin: string) => {
    if (mode === 'setup') {
      if (firstPin === null) {
        setFirstPin(fullPin);
        setPin('');
        setError('');
        return;
      }
      if (fullPin !== firstPin) {
        setError('Los PIN no coinciden. Intenta de nuevo.');
        setFirstPin(null);
        setPin('');
        return;
      }
      setBusy(true);
      await onSubmit(fullPin);
      setBusy(false);
      return;
    }

    // enter mode
    setBusy(true);
    const ok = await onSubmit(fullPin);
    setBusy(false);
    if (!ok) {
      setError('PIN incorrecto.');
      setPin('');
    }
  };

  const press = (digit: string) => {
    if (busy || pin.length >= PIN_LENGTH) return;
    const next = pin + digit;
    setPin(next);
    setError('');
    if (next.length === PIN_LENGTH) {
      // Defer so the last dot renders before validating.
      setTimeout(() => handleComplete(next), 120);
    }
  };

  const backspace = () => {
    if (busy) return;
    setPin((p) => p.slice(0, -1));
    setError('');
  };

  return (
    <div className="fixed inset-0 z-[500] bg-gradient-to-b from-[#0F766E] to-[#134E4A] text-white flex flex-col items-center justify-center px-8">
      <div className="w-16 h-16 rounded-2xl bg-white/15 flex items-center justify-center mb-6">
        <Lock size={30} />
      </div>
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="text-sm text-white/70 mt-1 text-center max-w-xs">{subtitle}</p>

      <div className="flex gap-4 my-8">
        {Array.from({ length: PIN_LENGTH }).map((_, i) => (
          <div
            key={i}
            className={`w-4 h-4 rounded-full border-2 border-white/70 transition-colors ${
              i < pin.length ? 'bg-white' : 'bg-transparent'
            }`}
          />
        ))}
      </div>

      <div className="h-5 mb-2">
        {error && <p className="text-sm text-amber-200">{error}</p>}
      </div>

      <div className="grid grid-cols-3 gap-4 w-full max-w-xs">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button
            key={d}
            onClick={() => press(d)}
            className="h-16 rounded-2xl bg-white/10 active:bg-white/25 text-2xl font-medium transition-colors"
          >
            {d}
          </button>
        ))}
        <div />
        <button
          onClick={() => press('0')}
          className="h-16 rounded-2xl bg-white/10 active:bg-white/25 text-2xl font-medium transition-colors"
        >
          0
        </button>
        <button
          onClick={backspace}
          className="h-16 rounded-2xl flex items-center justify-center active:bg-white/15 transition-colors"
          aria-label="Borrar"
        >
          <Delete size={24} />
        </button>
      </div>
    </div>
  );
}
