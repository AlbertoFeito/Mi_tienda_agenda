import { useEffect, useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import { AppProvider, useApp } from '@/contexts/AppContext';
import { maybeAutoBackup } from '@/lib/backup';
import AuthGate from '@/components/AuthGate';
import LicenseGate from '@/components/LicenseGate';
import BackButtonManager from '@/components/BackButtonManager';
import Header from '@/components/Header';
import Onboarding from '@/components/Onboarding';
import BottomNav from '@/components/BottomNav';
import Toast from '@/components/Toast';
import Dashboard from '@/pages/Dashboard';
import Ventas from '@/pages/Ventas';
import Productos from '@/pages/Productos';
import Clientes from '@/pages/Clientes';
import Duenos from '@/pages/Duenos';
import Analisis from '@/pages/Analisis';
import './App.css';

function AppLayout() {
  const { settings, updateStoreInfo } = useApp();
  // Lets the user replay the walkthrough from Ayuda once it is already done.
  const [replayTour, setReplayTour] = useState(false);

  // Create an automatic local backup at most once a day.
  useEffect(() => {
    maybeAutoBackup();
  }, []);

  // Wait for settings to load before deciding: `undefined` only means the read
  // is still in flight, and showing the tour there would flash it every launch.
  const showTour = replayTour || (settings !== undefined && !settings.onboardingDoneAt);

  const finishTour = async () => {
    setReplayTour(false);
    if (settings && !settings.onboardingDoneAt) {
      await updateStoreInfo({ onboardingDoneAt: new Date().toISOString() });
    }
  };

  return (
    <div className="min-h-[100dvh] w-full max-w-lg mx-auto bg-[#F1F5F9] flex flex-col relative overflow-x-hidden">
      <BackButtonManager />
      <Header onReplayTour={() => setReplayTour(true)} />
      {showTour && <Onboarding onFinish={finishTour} />}
      <main className="flex-1 pt-14 pb-20 px-4 overflow-y-auto">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/ventas" element={<Ventas />} />
          <Route path="/productos" element={<Productos />} />
          <Route path="/clientes" element={<Clientes />} />
          <Route path="/duenos" element={<Duenos />} />
          <Route path="/analisis" element={<Analisis />} />
        </Routes>
      </main>
      <Toast />
      <BottomNav />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AuthGate>
        <LicenseGate>
          <AppLayout />
        </LicenseGate>
      </AuthGate>
    </AppProvider>
  );
}
