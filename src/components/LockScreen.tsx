import { useState } from 'react';
import { Lock, Fingerprint } from 'lucide-react';
import PinPad from '@/components/PinPad';

const PIN_LENGTH = 4;

interface LockScreenProps {
  mode: 'setup' | 'enter';
  onSubmit: (pin: string) => Promise<boolean>;
  /** When provided (enter mode), shows a "use fingerprint" button. */
  onBiometric?: () => void;
  /** The user's own store name, shown instead of the app's. */
  storeName?: string;
}

/**
 * Full-screen PIN lock. In "setup" mode it asks for the PIN twice; in "enter"
 * mode it validates against the stored PIN via `onSubmit`.
 */
export default function LockScreen({ mode, onSubmit, onBiometric, storeName }: LockScreenProps) {
  const [pin, setPin] = useState('');
  const [firstPin, setFirstPin] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const confirming = mode === 'setup' && firstPin !== null;
  const title = mode === 'setup'
    ? (confirming ? 'Repite el PIN' : 'Crea un PIN')
    : 'Introduce tu PIN';
  const subtitle = mode === 'setup'
    ? `Protege el acceso a ${storeName?.trim() || 'tu tienda'} con un PIN de 4 dígitos.`
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

      <PinPad pin={pin} onDigit={press} onBackspace={backspace} length={PIN_LENGTH} busy={busy} />

      <div className="h-5 mt-4">
        {error && <p className="text-sm text-amber-200">{error}</p>}
      </div>

      {onBiometric && (
        <button
          onClick={onBiometric}
          className="mt-2 flex items-center gap-2 text-white/90 text-sm font-medium px-4 py-2 rounded-xl bg-white/10 active:bg-white/20 transition-colors"
        >
          <Fingerprint size={20} />
          Usar huella
        </button>
      )}
    </div>
  );
}
