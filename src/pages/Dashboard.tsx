import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { TrendingUp, DollarSign, Package, CreditCard, ShoppingCart, Plus, UserPlus, FileText } from 'lucide-react';
import { db } from '@/lib/db';
import { useApp } from '@/contexts/AppContext';
import { isToday, isPast, startOfDay, endOfDay, startOfMonth, endOfMonth } from 'date-fns';

export default function Dashboard() {
  const navigate = useNavigate();
  const { formatPrice, convertToCUP } = useApp();

  const sales = useLiveQuery(() => db.sales.toArray(), []);
  const products = useLiveQuery(() => db.products.toArray(), []);
  const installments = useLiveQuery(() => db.installments.toArray(), []);
  const installmentPayments = useLiveQuery(() => db.installmentPayments.toArray(), []);

  const stats = useMemo(() => {
    if (!sales || !products || !installments || !installmentPayments) {
      return { todaySales: 0, todayProfit: 0, totalStock: 0, lowStock: 0, pendingDebt: 0, debtors: 0, recentSales: [], lowStockProducts: [], upcomingPayments: [] };
    }

    const todayStart = startOfDay(new Date());
    const todayEnd = endOfDay(new Date());
    const monthStart = startOfMonth(new Date());
    const monthEnd = endOfMonth(new Date());

    const todaySalesList = sales.filter(s => {
      const d = new Date(s.createdAt);
      return d >= todayStart && d <= todayEnd;
    });

    const todaySalesTotal = todaySalesList.reduce((sum, s) => {
      return sum + convertToCUP(s.total, s.currency);
    }, 0);

    const todayProfit = todaySalesList.reduce((sum, s) => {
      return sum + s.items.reduce((itemSum, item) => {
        return itemSum + convertToCUP(item.subtotal - (item.unitPrice * item.quantity), item.unitCurrency);
      }, 0);
    }, 0);

    const totalStock = products.reduce((sum, p) => sum + p.stock, 0);
    const lowStockProducts = products.filter(p => p.stock <= p.minStock && p.stock > 0);
    const outOfStock = products.filter(p => p.stock === 0).length;

    const activeInstallments = installments.filter(i => i.status === 'active');
    const pendingDebt = activeInstallments.reduce((sum, i) => sum + i.remainingAmount, 0);
    const debtors = new Set(activeInstallments.map(i => i.customerId)).size;

    const recentSales = todaySalesList.slice(-5).reverse();

    const upcomingPayments = activeInstallments.flatMap(inst => {
      const payments = installmentPayments.filter(p => p.installmentId === inst.id);
      const nextPaymentNum = payments.length + 1;
      if (nextPaymentNum > inst.numberOfPayments) return [];

      const start = new Date(inst.startDate);
      let nextDate = new Date(start);
      const freqDays = inst.frequency === 'weekly' ? 7 : inst.frequency === 'biweekly' ? 14 : 30;
      for (let i = 0; i < nextPaymentNum - 1; i++) {
        nextDate = new Date(nextDate.getTime() + freqDays * 24 * 60 * 60 * 1000);
      }

      const monthlyInstallments = installments.filter(i => {
        const d = new Date(i.createdAt);
        return d >= monthStart && d <= monthEnd && i.status === 'active';
      });

      if (monthlyInstallments.find(mi => mi.id === inst.id)) {
        const installmentAmount = inst.totalAmount / inst.numberOfPayments;
        return [{
          customerName: inst.customerName,
          paymentNum: nextPaymentNum,
          totalPayments: inst.numberOfPayments,
          dueDate: nextDate,
          amount: installmentAmount,
          isOverdue: isPast(nextDate) && !isToday(nextDate),
        }];
      }
      return [];
    }).slice(0, 3);

    return { todaySales: todaySalesTotal, todayProfit, totalStock, lowStock: lowStockProducts.length + outOfStock, pendingDebt, debtors, recentSales, lowStockProducts: lowStockProducts.slice(0, 3), upcomingPayments };
  }, [sales, products, installments, installmentPayments, convertToCUP]);

  const quickActions = [
    { icon: ShoppingCart, label: 'Nueva Venta', color: 'text-[#0F766E]', bg: 'bg-[#0F766E]/10', action: () => navigate('/ventas') },
    { icon: Plus, label: 'Producto', color: 'text-[#059669]', bg: 'bg-[#059669]/10', action: () => navigate('/productos') },
    { icon: UserPlus, label: 'Cliente', color: 'text-[#64748B]', bg: 'bg-[#64748B]/10', action: () => navigate('/clientes') },
    { icon: FileText, label: 'Reporte', color: 'text-[#D97706]', bg: 'bg-[#D97706]/10', action: () => navigate('/analisis') },
  ];

  const paymentMethodIcon = (method: string) => {
    switch (method) {
      case 'cash': return { icon: '💵', label: 'Efectivo' };
      case 'transfer': return { icon: '💳', label: 'Transferencia' };
      case 'installment': return { icon: '📅', label: 'Plazos' };
      default: return { icon: '💵', label: method };
    }
  };

  return (
    <div className="space-y-5 animate-fade-in-up">
      {/* Hero Stats */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { icon: TrendingUp, color: 'text-[#059669]', bg: 'bg-[#D1FAE5]', label: 'Ventas Hoy', value: formatPrice(stats.todaySales, 'CUP'), sub: `${stats.recentSales.length} ventas` },
          { icon: DollarSign, color: 'text-[#0F766E]', bg: 'bg-[#CCFBF1]', label: 'Ganancia Hoy', value: formatPrice(stats.todayProfit, 'CUP'), sub: '' },
          { icon: Package, color: 'text-[#D97706]', bg: 'bg-[#FEF3C7]', label: 'En Stock', value: String(stats.totalStock), sub: stats.lowStock > 0 ? `${stats.lowStock} bajos` : '' },
          { icon: CreditCard, color: 'text-[#DC2626]', bg: 'bg-[#FEE2E2]', label: 'Por Cobrar', value: formatPrice(stats.pendingDebt, 'CUP'), sub: `${stats.debtors} deudores` },
        ].map((stat, i) => (
          <div key={i} className={`bg-white rounded-xl p-4 shadow-sm animate-fade-in-up stagger-${i + 1}`} style={{ opacity: 0 }}>
            <div className={`w-9 h-9 rounded-full ${stat.bg} flex items-center justify-center mb-2`}>
              <stat.icon size={18} className={stat.color} />
            </div>
            <p className="text-xs text-[#475569]">{stat.label}</p>
            <p className="text-lg font-bold text-[#0F172A] truncate">{stat.value}</p>
            {stat.sub && <p className="text-[11px] text-[#94A3B8]">{stat.sub}</p>}
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="animate-fade-in-up stagger-3" style={{ opacity: 0 }}>
        <h3 className="text-sm font-semibold text-[#0F172A] mb-3">Acciones Rápidas</h3>
        <div className="grid grid-cols-4 gap-3">
          {quickActions.map((action, i) => (
            <button
              key={i}
              onClick={action.action}
              className="flex flex-col items-center gap-1.5 active:scale-93 transition-transform"
            >
              <div className={`w-12 h-12 rounded-full ${action.bg} flex items-center justify-center`}>
                <action.icon size={22} className={action.color} />
              </div>
              <span className="text-[11px] text-[#475569] text-center leading-tight">{action.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Recent Sales */}
      <div className="animate-fade-in-up stagger-4" style={{ opacity: 0 }}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-[#0F172A]">Ventas Recientes</h3>
          <button onClick={() => navigate('/analisis')} className="text-xs text-[#0F766E] font-medium">Ver todas</button>
        </div>
        {stats.recentSales.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center shadow-sm">
            <ShoppingCart size={40} className="mx-auto text-[#94A3B8] mb-2" />
            <p className="text-sm text-[#475569]">No hay ventas hoy</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm divide-y divide-[#F1F5F9]">
            {stats.recentSales.map((sale) => {
              const pm = paymentMethodIcon(sale.paymentMethod);
              const date = new Date(sale.createdAt);
              return (
                <div key={sale.id} className="flex items-center gap-3 p-3">
                  <div className="w-10 h-10 rounded-full bg-[#F1F5F9] flex items-center justify-center text-lg flex-shrink-0">
                    {pm.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#0F172A]">
                      {date.toLocaleTimeString('es-CU', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                    <p className="text-xs text-[#475569]">{pm.label} · {sale.currency}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-[#0F172A]">{formatPrice(sale.total, sale.currency)}</p>
                    <p className="text-xs text-[#94A3B8]">{sale.items.length} producto(s)</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Low Stock */}
      {stats.lowStockProducts.length > 0 && (
        <div className="animate-fade-in-up stagger-5" style={{ opacity: 0 }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-[#0F172A]">Stock Bajo</h3>
            <span className="text-xs bg-[#FEE2E2] text-[#DC2626] px-2 py-0.5 rounded-full font-medium">{stats.lowStock}</span>
          </div>
          <div className="bg-white rounded-xl shadow-sm divide-y divide-[#F1F5F9]">
            {stats.lowStockProducts.map((product) => (
              <div key={product.id} className="flex items-center justify-between p-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#0F172A] truncate">{product.name}</p>
                  <p className="text-xs text-[#475569]">{product.category}</p>
                </div>
                <span className="text-xs font-bold text-[#D97706] flex-shrink-0">{product.stock} / {product.minStock}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upcoming Payments */}
      {stats.upcomingPayments.length > 0 && (
        <div className="animate-fade-in-up stagger-5" style={{ opacity: 0 }}>
          <h3 className="text-sm font-semibold text-[#0F172A] mb-3">Cobros este mes</h3>
          <div className="bg-white rounded-xl shadow-sm divide-y divide-[#F1F5F9]">
            {stats.upcomingPayments.map((payment, i) => (
              <div key={i} className="flex items-center justify-between p-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#0F172A]">{payment.customerName}</p>
                  <p className="text-xs text-[#475569]">Cuota {payment.paymentNum} de {payment.totalPayments}</p>
                  <p className={`text-xs ${payment.isOverdue ? 'text-[#DC2626]' : 'text-[#D97706]'}`}>
                    {payment.isOverdue ? 'Vencida: ' : 'Vence: '}
                    {payment.dueDate.toLocaleDateString('es-CU')}
                  </p>
                </div>
                <span className="text-sm font-bold text-[#DC2626] flex-shrink-0">{formatPrice(payment.amount, 'CUP')}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
