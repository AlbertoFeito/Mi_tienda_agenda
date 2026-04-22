import { Settings } from 'lucide-react';
import { useState } from 'react';
import SettingsModal from './SettingsModal';

export default function Header() {
  const [showSettings, setShowSettings] = useState(false);

  return (
    <>
      <header className="fixed top-0 left-0 right-0 h-14 bg-[#134E4A] text-white flex items-center justify-between px-4 z-50 shadow-sm">
        <h1 className="text-lg font-bold tracking-tight">MiTienda</h1>
        <button
          onClick={() => setShowSettings(true)}
          className="p-2 rounded-lg active:scale-95 active:opacity-80 transition-transform"
          aria-label="Configuración"
        >
          <Settings size={22} />
        </button>
      </header>
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </>
  );
}
