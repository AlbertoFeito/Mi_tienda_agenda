import { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from 'recharts';
import { TrendingUp, DollarSign, Package, CreditCard } from 'lucide-react';
import { db } from '@/lib/db';
import { useApp } from '@/contexts/AppContext';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, format, subDays } from 'date-fns';
import type { PeriodFilter } from '@/types';

const PERIOD_OPTIONS: { key: PeriodFilter; label: string }[] = [
  { key: 'today', label: 'Hoy' },
  { key: 'week', label: 'Semana' },
  { key: 'month', label: 'Mes' },
  { key: 'year', label: 'Año' },
];

const PIE_COLORS = {
  cash: '#059669',
  transfer: '#1D4ED8',
  installment: '#D97706',
  paid: '#059669',
  pending: '#DC2626',
};

// Chart colors available for future use
// const CHART_COLORS = ['#0F766E', '#14B8A6', '#5EEAD4', '#99F6E4', '#CCFBF1'];

export default function Analisis() {
  const { formatPrice, convertToCUP } = useApp();
  const [period, setPeriod] = useState<PeriodFilter>('week');

  const sales = useLiveQuery(() => db.sales.toArray(), []);
  const products = useLiveQuery(() => db.products.toArray(), []);
  const installments = useLiveQuery(() => db.installments.toArray(), []);

  const stats = useMemo(() => {
    if (!sales) {
      return { filteredSales: [], salesByMethod: [], dailySales: [], categoryStats: [], topProducts: [], debtStats: { total: 0, paid: 0, pending: 0 }, summary: { totalSales: 0, totalProfit: 0, totalProducts: 0, avgTicket: 0 } };
    }

    const now = new Date();
    let start: Date, end: Date;

    switch (period) {
      case 'today':
        start = startOfDay(now);
        end = endOfDay(now);
        break;
      case 'week':
        start = startOfWeek(now, { weekStartsOn: 1 });
        end = endOfWeek(now, { weekStartsOn: 1 });
        break;
      case 'month':
        start = startOfMonth(now);
        end = endOfMonth(now);
        break;
      case 'year':
        start = startOfYear(now);
        end = endOfYear(now);
        break;
    }

    const filteredSales = sales.filter(s => {
      const d = new Date(s.createdAt);
      return d >= start && d <= end;
    });

    const totalSales = filteredSales.reduce((sum, s) => sum + convertToCUP(s.total, s.currency), 0);
    const totalProfit = filteredSales.reduce((sum, s) => {
      return sum + s.items.reduce((itemSum, item) => {
        const product = products?.find(p => p.id === item.productId);
        if (product) {
          const costInCUP = convertToCUP(product.costPrice * item.quantity, product.costCurrency);
          const saleInCUP = convertToCUP(item.unitPrice * item.quantity, item.unitCurrency);
          return itemSum + (saleInCUP - costInCUP);
        }
        return itemSum;
      }, 0);
    }, 0);
    const totalProducts = filteredSales.reduce((sum, s) => sum + s.items.reduce((i, item) => i + item.quantity, 0), 0);
    const avgTicket = filteredSales.length > 0 ? totalSales / filteredSales.length : 0;

    // Sales by method
    const methodData = [
      { method: 'cash', label: 'Efectivo', count: 0, total: 0 },
      { method: 'transfer', label: 'Transferencia', count: 0, total: 0 },
      { method: 'installment', label: 'Plazos', count: 0, total: 0 },
    ];
    filteredSales.forEach(s => {
      const entry = methodData.find(m => m.method === s.paymentMethod);
      if (entry) {
        entry.count++;
        entry.total += convertToCUP(s.total, s.currency);
      }
    });
    const salesByMethod = methodData.filter(m => m.count > 0);

    // Daily sales for chart
    const daysMap = new Map<string, { date: string; total: number; profit: number }>();
    const daysCount = period === 'today' ? 1 : period === 'week' ? 7 : period === 'month' ? 30 : 12;

    if (period === 'year') {
      for (let i = 0; i < 12; i++) {
        const d = new Date(start.getFullYear(), i, 1);
        const key = format(d, 'MMM');
        daysMap.set(key, { date: key, total: 0, profit: 0 });
      }
      filteredSales.forEach(s => {
        const key = format(new Date(s.createdAt), 'MMM');
        const entry = daysMap.get(key);
        if (entry) {
          entry.total += convertToCUP(s.total, s.currency);
        }
      });
    } else {
      for (let i = daysCount - 1; i >= 0; i--) {
        const d = subDays(end, i);
        const key = format(d, period === 'today' ? 'HH:mm' : 'dd/MM');
        daysMap.set(key, { date: key, total: 0, profit: 0 });
      }
      filteredSales.forEach(s => {
        const key = format(new Date(s.createdAt), period === 'today' ? 'HH:mm' : 'dd/MM');
        if (daysMap.has(key)) {
          const entry = daysMap.get(key)!;
          entry.total += convertToCUP(s.total, s.currency);
        }
      });
    }
    const dailySales = Array.from(daysMap.values());

    // Category stats
    const catMap = new Map<string, { name: string; revenue: number; profit: number; count: number }>();
    filteredSales.forEach(s => {
      s.items.forEach(item => {
        const product = products?.find(p => p.id === item.productId);
        const catName = product?.category || 'Sin categoría';
        const saleInCUP = convertToCUP(item.unitPrice * item.quantity, item.unitCurrency);
        const costInCUP = product ? convertToCUP(product.costPrice * item.quantity, product.costCurrency) : 0;

        if (!catMap.has(catName)) {
          catMap.set(catName, { name: catName, revenue: 0, profit: 0, count: 0 });
        }
        const entry = catMap.get(catName)!;
        entry.revenue += saleInCUP;
        entry.profit += (saleInCUP - costInCUP);
        entry.count += item.quantity;
      });
    });
    const categoryStats = Array.from(catMap.values()).sort((a, b) => b.profit - a.profit);

    // Top products
    const prodMap = new Map<number, { id: number; name: string; image?: string; qty: number; revenue: number }>();
    filteredSales.forEach(s => {
      s.items.forEach(item => {
        if (!prodMap.has(item.productId)) {
          prodMap.set(item.productId, { id: item.productId, name: item.productName, qty: 0, revenue: 0 });
        }
        const entry = prodMap.get(item.productId)!;
        entry.qty += item.quantity;
        entry.revenue += convertToCUP(item.unitPrice * item.quantity, item.unitCurrency);
      });
    });
    const topProducts = Array.from(prodMap.values())
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5)
      .map(p => {
        const product = products?.find(pr => pr.id === p.id);
        return { ...p, image: product?.image };
      });

    // Debt stats
    const activeInstallments = installments?.filter(i => i.status === 'active') || [];
    const allInstallments = installments || [];
    const totalDebt = activeInstallments.reduce((s, i) => s + i.totalAmount, 0);
    const totalPaidDebt = allInstallments.reduce((s, i) => s + i.paidAmount, 0);
    const totalPending = activeInstallments.reduce((s, i) => s + i.remainingAmount, 0);

    return {
      filteredSales,
      salesByMethod,
      dailySales,
      categoryStats,
      topProducts,
      debtStats: { total: totalDebt, paid: totalPaidDebt, pending: totalPending },
      summary: { totalSales, totalProfit, totalProducts, avgTicket },
    };
  }, [sales, products, installments, period, convertToCUP]);

  return (
    <div className="space-y-5 animate-fade-in-up">
      <h2 className="text-xl font-bold">Análisis</h2>

      {/* Period Selector */}
      <div className="flex bg-[#F1F5F9] rounded-lg p-1">
        {PERIOD_OPTIONS.map(opt => (
          <button
            key={opt.key}
            onClick={() => setPeriod(opt.key)}
            className={`flex-1 py-2 text-xs font-semibold rounded-md transition-colors ${
              period === opt.key ? 'bg-white text-[#0F766E] shadow-sm' : 'text-[#475569]'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { icon: TrendingUp, color: 'text-[#059669]', bg: 'bg-[#D1FAE5]', label: 'Ventas Totales', value: formatPrice(stats.summary.totalSales, 'CUP'), sub: `${stats.filteredSales.length} ventas` },
          { icon: DollarSign, color: 'text-[#0F766E]', bg: 'bg-[#CCFBF1]', label: 'Ganancia Neta', value: formatPrice(stats.summary.totalProfit, 'CUP'), sub: '' },
          { icon: Package, color: 'text-[#D97706]', bg: 'bg-[#FEF3C7]', label: 'Productos', value: String(stats.summary.totalProducts), sub: 'unidades' },
          { icon: CreditCard, color: 'text-[#64748B]', bg: 'bg-[#F1F5F9]', label: 'Ticket Promedio', value: formatPrice(stats.summary.avgTicket, 'CUP'), sub: 'por venta' },
        ].map((stat, i) => (
          <div key={i} className="bg-white rounded-xl p-4 shadow-sm">
            <div className={`w-8 h-8 rounded-full ${stat.bg} flex items-center justify-center mb-2`}>
              <stat.icon size={16} className={stat.color} />
            </div>
            <p className="text-[11px] text-[#475569]">{stat.label}</p>
            <p className="text-base font-bold text-[#0F172A] truncate">{stat.value}</p>
            {stat.sub && <p className="text-[10px] text-[#94A3B8]">{stat.sub}</p>}
          </div>
        ))}
      </div>

      {/* Sales Chart */}
      {stats.dailySales.length > 0 && (
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <h3 className="text-sm font-semibold mb-3">Tendencia de Ventas</h3>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.dailySales}>
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#14B8A6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#14B8A6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                <Tooltip
                  formatter={(value: number) => [formatPrice(value, 'CUP'), 'Ventas']}
                  contentStyle={{ borderRadius: 8, border: '1px solid #E2E8F0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                  labelStyle={{ fontSize: 12, color: '#475569' }}
                />
                <Area type="monotone" dataKey="total" stroke="#0F766E" strokeWidth={2} fill="url(#colorSales)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Sales by Method */}
      {stats.salesByMethod.length > 0 && (
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <h3 className="text-sm font-semibold mb-3">Ventas por Método</h3>
          <div className="flex items-center gap-4">
            <div className="w-32 h-32 flex-shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.salesByMethod}
                    dataKey="count"
                    nameKey="method"
                    cx="50%"
                    cy="50%"
                    innerRadius={30}
                    outerRadius={50}
                    paddingAngle={2}
                  >
                    {stats.salesByMethod.map((entry, index) => (
                      <Cell key={index} fill={PIE_COLORS[entry.method as keyof typeof PIE_COLORS]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-2">
              {stats.salesByMethod.map(m => (
                <div key={m.method} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ background: PIE_COLORS[m.method as keyof typeof PIE_COLORS] }} />
                    <span className="text-xs text-[#475569]">{m.label}</span>
                  </div>
                  <span className="text-xs font-semibold">{m.count} ({formatPrice(m.total, 'CUP')})</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Top Products */}
      {stats.topProducts.length > 0 && (
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <h3 className="text-sm font-semibold mb-3">Productos Más Vendidos</h3>
          <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
            {stats.topProducts.map((p) => (
              <div key={p.id} className="flex-shrink-0 w-[120px] bg-[#F8FAFC] rounded-lg p-3 text-center">
                {p.image ? (
                  <img src={p.image} alt={p.name} className="w-16 h-16 mx-auto rounded-lg object-cover mb-2" />
                ) : (
                  <div className="w-16 h-16 mx-auto rounded-lg bg-[#F1F5F9] flex items-center justify-center mb-2">
                    <span className="text-xl">📦</span>
                  </div>
                )}
                <p className="text-xs font-medium truncate">{p.name}</p>
                <p className="text-xs text-[#94A3B8]">{p.qty} vendidos</p>
                <p className="text-xs font-bold text-[#0F766E]">{formatPrice(p.revenue, 'CUP')}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Category Profit */}
      {stats.categoryStats.length > 0 && (
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <h3 className="text-sm font-semibold mb-3">Ganancia por Categoría</h3>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.categoryStats.slice(0, 6)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: '#475569' }} axisLine={false} tickLine={false} width={80} />
                <Tooltip
                  formatter={(value: number) => [formatPrice(value, 'CUP'), 'Ganancia']}
                  contentStyle={{ borderRadius: 8, border: '1px solid #E2E8F0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                />
                <Bar dataKey="profit" fill="#14B8A6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Debt Summary */}
      <div className="bg-white rounded-xl p-4 shadow-sm">
        <h3 className="text-sm font-semibold mb-3">Estado de Deudas</h3>
        <div className="grid grid-cols-3 gap-3 mb-3">
          <div className="text-center">
            <p className="text-xs text-[#94A3B8]">Total Prestado</p>
            <p className="text-sm font-bold">{formatPrice(stats.debtStats.total, 'CUP')}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-[#94A3B8]">Cobrado</p>
            <p className="text-sm font-bold text-[#059669]">{formatPrice(stats.debtStats.paid, 'CUP')}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-[#94A3B8]">Por Cobrar</p>
            <p className="text-sm font-bold text-[#DC2626]">{formatPrice(stats.debtStats.pending, 'CUP')}</p>
          </div>
        </div>
        {stats.debtStats.total > 0 && (
          <div className="flex items-center gap-4">
            <div className="w-24 h-24 flex-shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={[{ name: 'Cobrado', value: stats.debtStats.paid }, { name: 'Pendiente', value: stats.debtStats.pending }]} dataKey="value" cx="50%" cy="50%" innerRadius={25} outerRadius={40} paddingAngle={2}>
                    <Cell fill={PIE_COLORS.paid} />
                    <Cell fill={PIE_COLORS.pending} />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#059669]" />
                  <span className="text-xs text-[#475569]">Cobrado</span>
                </div>
                <span className="text-xs font-semibold">{Math.round((stats.debtStats.paid / Math.max(1, stats.debtStats.total)) * 100)}%</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#DC2626]" />
                  <span className="text-xs text-[#475569]">Pendiente</span>
                </div>
                <span className="text-xs font-semibold">{Math.round((stats.debtStats.pending / Math.max(1, stats.debtStats.total)) * 100)}%</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
