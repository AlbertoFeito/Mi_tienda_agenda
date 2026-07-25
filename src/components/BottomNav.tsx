import { useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, ShoppingCart, Package, Users, Handshake, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { path: '/', icon: LayoutDashboard, label: 'Inicio' },
  { path: '/ventas', icon: ShoppingCart, label: 'Vender' },
  { path: '/productos', icon: Package, label: 'Productos' },
  { path: '/clientes', icon: Users, label: 'Clientes' },
  { path: '/duenos', icon: Handshake, label: 'Dueños' },
  { path: '/analisis', icon: BarChart3, label: 'Análisis' },
];

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-[#E2E8F0] z-50 flex items-center justify-around pb-safe shadow-[0_-4px_12px_rgba(0,0,0,0.04)] max-w-lg mx-auto">
      {navItems.map((item) => {
        const isActive = location.pathname === item.path;
        const Icon = item.icon;
        return (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className={cn(
              'flex flex-col items-center justify-center gap-0.5 flex-1 min-w-0 h-full transition-colors',
              isActive ? 'text-[#0F766E]' : 'text-[#94A3B8]'
            )}
          >
            <Icon size={21} strokeWidth={isActive ? 2.5 : 1.5} />
            <span className="text-[10px] font-medium truncate max-w-full px-0.5">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
