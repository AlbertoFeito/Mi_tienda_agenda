import { useState } from 'react';
import { KeyRound, Copy, Download, ShieldCheck } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { shareBackup } from '@/lib/backup';
import { formatDeviceId, licenceSecret, verifyLicence } from '@/lib/license';

/**
 * Blocking screen once the trial is over.
 *
 * It still offers the backup button: the data in there is the user's own
 * bookkeeping, and an expired licence is no reason to hold it hostage.
 */
export default function LicenseScreen({ deviceId }: { deviceId: string }) {
  const { updateStoreInfo, showToast } = useApp();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const activate = async () => {
    setBusy(true);
    try {
      const ok = await verifyLicence(deviceId, code, licenceSecret());
      if (!ok) {
        showToast('Esa licencia no es válida para este teléfono', 'error');
        return;
      }
      await updateStoreInfo({ licenseKey: code.trim() });
      showToast('¡Licencia activada! Gracias.', 'success');
    } finally {
      setBusy(false);
    }
  };

  const copyDeviceId = async () => {
    try {
      await navigator.clipboard.writeText(formatDeviceId(deviceId));
      showToast('Código copiado', 'success');
    } catch {
      showToast('No se pudo copiar; escríbelo tal cual aparece', 'warning');
    }
  };

  const backup = async () => {
    try {
      await shareBackup();
    } catch {
      showToast('No se pudo crear la copia', 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-[500] bg-gradient-to-b from-[#0F766E] to-[#134E4A] text-white overflow-y-auto pt-safe pb-safe">
      <div className="min-h-full flex flex-col items-center justify-center px-6 py-10">
        <div className="w-16 h-16 rounded-2xl bg-white/15 flex items-center justify-center mb-5">
          <KeyRound size={30} />
        </div>

        <h1 className="text-xl font-semibold text-center">Terminó el período de prueba</h1>
        <p className="text-sm text-white/75 mt-2 text-center max-w-xs">
          Para seguir usando la aplicación, pide tu licencia y actívala aquí. No necesitas internet.
        </p>

        <div className="w-full max-w-sm mt-7 bg-white/10 rounded-2xl p-4">
          <p className="text-xs text-white/70">Código de este teléfono</p>
          <div className="flex items-center justify-between gap-2 mt-1">
            <p className="text-xl font-bold tracking-wider font-mono">{formatDeviceId(deviceId)}</p>
            <button
              onClick={copyDeviceId}
              className="flex-shrink-0 p-2 rounded-lg bg-white/15 active:scale-95 transition-transform"
              aria-label="Copiar código"
            >
              <Copy size={18} />
            </button>
          </div>
          <p className="text-xs text-white/60 mt-2">
            Envía este código a quien te vendió la aplicación.
          </p>
        </div>

        <div className="w-full max-w-sm mt-4">
          <label className="text-sm text-white/80 block mb-1">Escribe tu licencia</label>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="XXXX-XXXX-XXXX-XXXX"
            autoCapitalize="characters"
            spellCheck={false}
            className="w-full h-12 px-3 rounded-lg bg-white text-[#0F172A] text-base tracking-wider font-mono outline-none"
          />
          <button
            onClick={activate}
            disabled={busy || code.trim().length === 0}
            className="w-full h-12 mt-3 flex items-center justify-center gap-2 bg-white text-[#0F766E] rounded-xl font-semibold active:scale-[0.98] transition-transform disabled:opacity-50"
          >
            <ShieldCheck size={18} />
            Activar
          </button>
        </div>

        <div className="w-full max-w-sm mt-8 pt-5 border-t border-white/15">
          <p className="text-xs text-white/60 text-center mb-2">
            Tus datos siguen aquí y son tuyos. Puedes guardarlos cuando quieras.
          </p>
          <button
            onClick={backup}
            className="w-full h-11 flex items-center justify-center gap-2 border border-white/40 rounded-xl text-sm font-medium active:scale-[0.98] transition-transform"
          >
            <Download size={16} />
            Crear copia de seguridad
          </button>
        </div>
      </div>
    </div>
  );
}
