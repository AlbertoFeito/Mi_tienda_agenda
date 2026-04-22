import { useState } from 'react';
import { X, Download, Upload, Trash2 } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { exportData, importData, clearAllData } from '@/lib/db';
import type { Currency } from '@/types';

export default function SettingsModal({ onClose }: { onClose: () => void }) {
  const { settings, updateRates, updateStoreInfo, showToast } = useApp();
  const [activeTab, setActiveTab] = useState<'rates' | 'store' | 'data'>('rates');
  const [usdRate, setUsdRate] = useState(settings?.usdRate ?? 320);
  const [eurRate, setEurRate] = useState(settings?.eurRate ?? 350);
  const [mlcRate, setMlcRate] = useState(settings?.mlcRate ?? 300);
  const [storeName, setStoreName] = useState(settings?.storeName ?? 'Mi Tienda');
  const [address, setAddress] = useState(settings?.address ?? '');
  const [phone, setPhone] = useState(settings?.phone ?? '');
  const [primaryCurrency, setPrimaryCurrency] = useState<Currency>(settings?.primaryCurrency ?? 'CUP');
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const handleSaveRates = async () => {
    await updateRates(usdRate, eurRate, mlcRate);
    showToast('Tasas de cambio actualizadas', 'success');
  };

  const handleSaveStore = async () => {
    await updateStoreInfo({ storeName, address, phone, primaryCurrency });
    showToast('Datos de la tienda guardados', 'success');
  };

  const handleExport = async () => {
    try {
      const data = await exportData();
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mitienda-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Datos exportados correctamente', 'success');
    } catch {
      showToast('Error al exportar datos', 'error');
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      await importData(text);
      showToast('Datos importados correctamente', 'success');
    } catch {
      showToast('Error al importar datos', 'error');
    }
  };

  const handleClear = async () => {
    if (deleteConfirm === 'ELIMINAR') {
      await clearAllData();
      showToast('Todos los datos han sido eliminados', 'warning');
    }
  };

  return (
    <div className="fixed inset-0 z-[300] bg-white flex flex-col animate-slide-up">
      <div className="h-14 bg-[#134E4A] text-white flex items-center justify-between px-4 flex-shrink-0">
        <h2 className="text-lg font-semibold">Configuración</h2>
        <button onClick={onClose} className="p-2 active:scale-95 transition-transform">
          <X size={22} />
        </button>
      </div>

      <div className="flex border-b border-[#E2E8F0] flex-shrink-0">
        {(['rates', 'store', 'data'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'text-[#0F766E] border-b-2 border-[#0F766E]'
                : 'text-[#94A3B8]'
            }`}
          >
            {tab === 'rates' ? 'Tasas' : tab === 'store' ? 'Tienda' : 'Datos'}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'rates' && (
          <div className="space-y-4">
            <p className="text-sm text-[#475569]">Configure las tasas de cambio respecto al CUP</p>
            <div className="bg-white rounded-xl border border-[#E2E8F0] p-4 space-y-4">
              {[
                { label: '1 USD =', value: usdRate, setter: setUsdRate },
                { label: '1 EUR =', value: eurRate, setter: setEurRate },
                { label: '1 MLC =', value: mlcRate, setter: setMlcRate },
              ].map((rate) => (
                <div key={rate.label} className="flex items-center gap-3">
                  <label className="text-sm font-medium text-[#475569] w-20">{rate.label}</label>
                  <input
                    type="number"
                    value={rate.value}
                    onChange={(e) => rate.setter(Number(e.target.value))}
                    className="flex-1 h-12 px-3 rounded-lg border border-[#E2E8F0] text-base focus:border-[#0F766E] focus:ring-2 focus:ring-[#0F766E]/10 outline-none"
                  />
                  <span className="text-sm text-[#94A3B8]">CUP</span>
                </div>
              ))}
              <button
                onClick={handleSaveRates}
                className="w-full h-12 bg-[#0F766E] text-white rounded-lg font-semibold active:scale-[0.98] transition-transform"
              >
                Guardar Tasas
              </button>
            </div>
          </div>
        )}

        {activeTab === 'store' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-[#E2E8F0] p-4 space-y-4">
              <div>
                <label className="text-sm font-medium text-[#475569] block mb-1">Nombre de la tienda</label>
                <input
                  type="text"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  className="w-full h-12 px-3 rounded-lg border border-[#E2E8F0] text-base focus:border-[#0F766E] focus:ring-2 focus:ring-[#0F766E]/10 outline-none"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-[#475569] block mb-1">Dirección</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full h-12 px-3 rounded-lg border border-[#E2E8F0] text-base focus:border-[#0F766E] focus:ring-2 focus:ring-[#0F766E]/10 outline-none"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-[#475569] block mb-1">Teléfono</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full h-12 px-3 rounded-lg border border-[#E2E8F0] text-base focus:border-[#0F766E] focus:ring-2 focus:ring-[#0F766E]/10 outline-none"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-[#475569] block mb-1">Moneda principal</label>
                <select
                  value={primaryCurrency}
                  onChange={(e) => setPrimaryCurrency(e.target.value as Currency)}
                  className="w-full h-12 px-3 rounded-lg border border-[#E2E8F0] text-base focus:border-[#0F766E] focus:ring-2 focus:ring-[#0F766E]/10 outline-none bg-white"
                >
                  <option value="CUP">CUP</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="MLC">MLC</option>
                </select>
              </div>
              <button
                onClick={handleSaveStore}
                className="w-full h-12 bg-[#0F766E] text-white rounded-lg font-semibold active:scale-[0.98] transition-transform"
              >
                Guardar Datos
              </button>
            </div>
          </div>
        )}

        {activeTab === 'data' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-[#E2E8F0] p-4 space-y-3">
              <button
                onClick={handleExport}
                className="w-full h-12 flex items-center justify-center gap-2 border-2 border-[#0F766E] text-[#0F766E] rounded-lg font-medium active:scale-[0.98] transition-transform"
              >
                <Download size={18} />
                Exportar Datos
              </button>

              <label className="w-full h-12 flex items-center justify-center gap-2 border-2 border-[#64748B] text-[#64748B] rounded-lg font-medium active:scale-[0.98] transition-transform cursor-pointer">
                <Upload size={18} />
                Importar Datos
                <input type="file" accept=".json" onChange={handleImport} className="hidden" />
              </label>

              <button
                onClick={() => setShowDeleteModal(true)}
                className="w-full h-12 flex items-center justify-center gap-2 border-2 border-[#DC2626] text-[#DC2626] rounded-lg font-medium active:scale-[0.98] transition-transform"
              >
                <Trash2 size={18} />
                Borrar Todos los Datos
              </button>
            </div>

            <div className="text-center pt-4">
              <p className="text-xs text-[#94A3B8]">MiTienda v1.0.0</p>
              <p className="text-xs text-[#94A3B8]">Gestión comercial offline</p>
            </div>
          </div>
        )}
      </div>

      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/40 z-[400] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm animate-scale-in">
            <h3 className="text-lg font-semibold text-[#0F172A] mb-2">Eliminar todos los datos</h3>
            <p className="text-sm text-[#475569] mb-4">
              Esta acción no se puede deshacer. Escribe ELIMINAR para confirmar.
            </p>
            <input
              type="text"
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder="Escribe ELIMINAR"
              className="w-full h-12 px-3 rounded-lg border border-[#E2E8F0] text-base focus:border-[#DC2626] focus:ring-2 focus:ring-[#DC2626]/10 outline-none mb-4"
            />
            <div className="flex gap-2">
              <button
                onClick={() => { setShowDeleteModal(false); setDeleteConfirm(''); }}
                className="flex-1 h-12 border border-[#E2E8F0] rounded-lg font-medium text-[#475569]"
              >
                Cancelar
              </button>
              <button
                onClick={handleClear}
                disabled={deleteConfirm !== 'ELIMINAR'}
                className="flex-1 h-12 bg-[#DC2626] text-white rounded-lg font-medium disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
