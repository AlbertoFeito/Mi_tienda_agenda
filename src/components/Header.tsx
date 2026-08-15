import { HelpCircle, Settings } from 'lucide-react';
import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useApp } from '@/contexts/AppContext';
import SettingsModal from './SettingsModal';
import HelpModal from './HelpModal';

export default function Header({ onReplayTour }: { onReplayTour: () => void }) {
  const { settings, settingsTab, openSettings, closeSettings } = useApp();
  const [showHelp, setShowHelp] = useState(false);
  const location = useLocation();

  return (
    <>
      <header className="app-header fixed top-0 left-0 right-0 bg-[#134E4A] text-white flex items-center justify-between px-4 z-50 shadow-sm max-w-lg mx-auto">
        <div className="flex items-center gap-2 min-w-0 mr-2">
          {settings?.logo && (
            <img
              src={settings.logo}
              alt=""
              className="w-8 h-8 rounded-lg object-cover flex-shrink-0 bg-white/10"
            />
          )}
          <h1 className="text-lg font-bold tracking-tight truncate">
            {settings?.storeName?.trim() || 'Mi Tienda'}
          </h1>
        </div>
        <div className="flex items-center flex-shrink-0">
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
