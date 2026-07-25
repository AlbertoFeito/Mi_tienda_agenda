import { HelpCircle, Settings } from 'lucide-react';
import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useApp } from '@/contexts/AppContext';
import SettingsModal from './SettingsModal';
import HelpModal from './HelpModal';

export default function Header({ onReplayTour }: { onReplayTour: () => void }) {
  const { settingsTab, openSettings, closeSettings } = useApp();
  const [showHelp, setShowHelp] = useState(false);
  const location = useLocation();

  return (
    <>
      <header className="fixed top-0 left-0 right-0 h-14 bg-[#134E4A] text-white flex items-center justify-between px-4 z-50 shadow-sm max-w-lg mx-auto">
        <h1 className="text-lg font-bold tracking-tight">MiTienda</h1>
        <div className="flex items-center">
          <button
            onClick={() => setShowHelp(true)}
            className="p-2 rounded-lg active:scale-95 active:opacity-80 transition-transform"
            aria-label="Ayuda"
          >
            <HelpCircle size={22} />
          </button>
          <button
            onClick={() => openSettings()}
            className="p-2 rounded-lg active:scale-95 active:opacity-80 transition-transform"
            aria-label="Configuración"
          >
            <Settings size={22} />
          </button>
        </div>
      </header>
      {settingsTab && <SettingsModal initialTab={settingsTab} onClose={closeSettings} />}
      {showHelp && (
        <HelpModal
          route={location.pathname}
          onClose={() => setShowHelp(false)}
          onReplayTour={() => { setShowHelp(false); onReplayTour(); }}
        />
      )}
    </>
  );
}
