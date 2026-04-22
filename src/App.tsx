import { Routes, Route } from 'react-router-dom';
import { AppProvider } from '@/contexts/AppContext';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import Toast from '@/components/Toast';
import Dashboard from '@/pages/Dashboard';
import Ventas from '@/pages/Ventas';
import Productos from '@/pages/Productos';
import Clientes from '@/pages/Clientes';
import Analisis from '@/pages/Analisis';
import './App.css';

function AppLayout() {
  return (
    <div className="min-h-screen bg-[#F1F5F9] flex flex-col max-w-lg mx-auto relative">
      <Header />
      <main className="flex-1 pt-14 pb-20 px-4 overflow-y-auto">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/ventas" element={<Ventas />} />
          <Route path="/productos" element={<Productos />} />
          <Route path="/clientes" element={<Clientes />} />
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
      <AppLayout />
    </AppProvider>
  );
}
