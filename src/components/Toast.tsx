import { CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';

const toastStyles = {
  success: { bg: 'bg-[#D1FAE5]', text: 'text-[#15803D]', icon: CheckCircle },
  warning: { bg: 'bg-[#FEF3C7]', text: 'text-[#D97706]', icon: AlertTriangle },
  error: { bg: 'bg-[#FEE2E2]', text: 'text-[#DC2626]', icon: XCircle },
};

export default function Toast() {
  const { toast } = useApp();
  if (!toast) return null;

  const style = toastStyles[toast.type];
  const Icon = style.icon;

  return (
    // Por encima de todo lo demás (configuración, recibo, PIN, licencia): si el
    // aviso queda por debajo de una pantalla abierta, el usuario guarda y no ve
    // ninguna señal de que se guardó.
    <div className="fixed top-16 left-4 right-4 z-[700] flex justify-center animate-slide-down">
      <div className={`${style.bg} ${style.text} px-4 py-3 rounded-lg shadow-md flex items-center gap-2 max-w-sm`}>
        <Icon size={18} />
        <span className="text-sm font-medium">{toast.message}</span>
      </div>
    </div>
  );
}
