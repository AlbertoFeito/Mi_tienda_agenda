import { useState } from 'react';
import Portal from '@/components/Portal';
import { KeyRound } from 'lucide-react';
import PinPad from '@/components/PinPad';
import { verifyPin, setPin } from '@/lib/auth';
import { useBackHandler } from '@/lib/backHandler';
import { useApp } from '@/contexts/AppContext';

const PIN_LENGTH = 4;

type Step = 'current' | 'new' | 'confirm';

/**
 * Change the app PIN: confirm the current PIN, then enter and repeat a new one.
 */
export default function ChangePinModal({ onClose }: { onClose: () => void }) {
  const { showToast } = useApp();
  const [step, setStep] = useState<Step>('current');
  const [pin, setPin_] = useState('');
  const [newPin, setNewPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useBackHandler(onClose);

  const titles: Record<Step, { title: string; subtitle: string }> = {
    current: { title: 'PIN actual', subtitle: 'Introduce tu PIN actual para continuar.' },
    new: { title: 'Nuevo PIN', subtitle: 'Elige un nuevo PIN de 4 dígitos.' },
    confirm: { title: 'Repite el nuevo PIN', subtitle: 'Vuelve a introducir el nuevo PIN.' },
  };

  const handleComplete = async (full: string) => {
    if (step === 'current') {
      setBusy(true);
      const ok = await verifyPin(full);
      setBusy(false);
      if (!ok) {
        setError('PIN incorrecto.');
        setPin_('');
        return;
      }
      setStep('new');
      setPin_('');
      setError('');
      return;
    }

    if (step === 'new') {
      setNewPin(full);
      setStep('confirm');
      setPin_('');
      setError('');
      return;
    }

    // confirm
    if (full !== newPin) {
      setError('Los PIN no coinciden. Intenta de nuevo.');
      setStep('new');
      setNewPin('');
      setPin_('');
      return;
    }
    setBusy(true);
    await setPin(full);
    setBusy(false);
    showToast('PIN actualizado', 'success');
    onClose();
  };

  const press = (digit: string) => {
    if (busy || pin.length >= PIN_LENGTH) return;
    const next = pin + digit;
    setPin_(next);
    setError('');
    if (next.length === PIN_LENGTH) {
      setTimeout(() => handleComplete(next), 120);
    }
  };

  const backspace = () => {
    if (busy) return;
    setPin_((p) => p.slice(0, -1));
    setError('');
  };

  return (
    <Portal>
      <div className="fixed inset-0 z-[600] bg-gradient-to-b from-[#0F766E] to-[#134E4A] text-white flex flex-col items-center justify-center px-8" onClick={onClose}>
        <div onClick={(e) => e.stopPropagation()} className="flex flex-col items-center">
          <div className="w-16 h-16 rounded-2xl bg-white/15 flex items-center justify-center mb-6">
            <KeyRound size={30} />
          </div>
          <h1 className="text-xl font-semibold">{titles[step].title}</h1>
          <p className="text-sm text-white/70 mt-1 text-center max-w-xs">{titles[step].subtitle}</p>

          <PinPad pin={pin} onDigit={press} onBackspace={backspace} length={PIN_LENGTH} busy={busy} />

          <div className="h-5 mt-4">
            {error && <p className="text-sm text-amber-200">{error}</p>}
          </div>
        </div>
      </div>
    </Portal>
  );
}
