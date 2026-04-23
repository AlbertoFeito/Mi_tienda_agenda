import { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Search, Plus, X, User, Phone, CreditCard, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { db } from '@/lib/db';
import { useApp } from '@/contexts/AppContext';
import type { Customer, Installment, InstallmentPayment, PaymentMethod } from '@/types';

type ViewState = 'list' | 'form' | 'detail';
type CustomerTab = 'active' | 'all' | 'paid';

export default function Clientes() {
  const { formatPrice } = useApp();
  const [view, setView] = useState<ViewState>('list');
  const [activeTab, setActiveTab] = useState<CustomerTab>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const customers = useLiveQuery(() => db.customers.toArray(), []);
  const installments = useLiveQuery(() => db.installments.toArray(), []);
  const payments = useLiveQuery(() => db.installmentPayments.toArray(), []);

  const customerDebts = useMemo(() => {
    if (!customers || !installments || !payments) return [];

    return customers.map(customer => {
      const customerInstallments = installments.filter(i => i.customerId === customer.id);
      const active = customerInstallments.filter(i => i.status === 'active');
      const totalDebt = active.reduce((s, i) => s + i.remainingAmount, 0);
      const totalPaid = customerInstallments.reduce((s, i) => s + i.paidAmount, 0);
      const totalAmount = customerInstallments.reduce((s, i) => s + i.totalAmount, 0);

      const hasOverdue = active.some(inst => {
        const instPayments = payments.filter(p => p.installmentId === inst.id);
        const nextNum = instPayments.length + 1;
        if (nextNum > inst.numberOfPayments) return false;
        const start = new Date(inst.startDate);
        let nextDate = new Date(start);
        const freqDays = inst.frequency === 'weekly' ? 7 : inst.frequency === 'biweekly' ? 14 : 30;
        for (let i = 0; i < nextNum - 1; i++) {
          nextDate = new Date(nextDate.getTime() + freqDays * 24 * 60 * 60 * 1000);
        }
        return nextDate < new Date();
      });

      return {
        customer,
        totalDebt,
        totalPaid,
        totalAmount,
        remaining: totalDebt,
        hasOverdue,
        activeInstallments: active.length,
      };
    });
  }, [customers, installments, payments]);

  const filteredCustomers = useMemo(() => {
    let result = customerDebts;
    if (activeTab === 'active') result = result.filter(c => c.totalDebt > 0);
    if (activeTab === 'paid') result = result.filter(c => c.totalDebt === 0 && c.totalPaid > 0);
    if (searchQuery) {
      result = result.filter(c =>
        c.customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.customer.phone && c.customer.phone.includes(searchQuery))
      );
    }
    return result;
  }, [customerDebts, activeTab, searchQuery]);

  const openForm = (customer?: Customer) => {
    setEditingCustomer(customer || null);
    setView('form');
  };

  const openDetail = (customer: Customer) => {
    setSelectedCustomer(customer);
    setView('detail');
  };

  if (view === 'form') {
    return <CustomerForm customer={editingCustomer} onBack={() => setView('list')} onSave={() => { setView('list'); setEditingCustomer(null); }} />;
  }

  if (view === 'detail' && selectedCustomer && installments && payments) {
    return (
      <CustomerDetail
        customer={selectedCustomer}
        installments={installments.filter(i => i.customerId === selectedCustomer.id)}
        payments={payments}
        onBack={() => setView('list')}
        onEdit={() => openForm(selectedCustomer)}
      />
    );
  }

  return (
    <div className="animate-fade-in-up">
      <h2 className="text-xl font-bold mb-3">Clientes</h2>

      {/* Search */}
      <div className="relative mb-2">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar cliente..."
          className="w-full h-12 pl-10 pr-4 rounded-xl border border-[#E2E8F0] bg-white text-base focus:border-[#0F766E] focus:ring-2 focus:ring-[#0F766E]/10 outline-none"
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8]">
            <X size={18} />
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex bg-[#F1F5F9] rounded-lg p-1 mb-3">
        {([
          { key: 'active', label: 'Activos' },
          { key: 'all', label: 'Todos' },
          { key: 'paid', label: 'Pagados' },
        ] as { key: CustomerTab; label: string }[]).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 py-2 text-xs font-semibold rounded-md transition-colors ${
              activeTab === tab.key ? 'bg-white text-[#0F766E] shadow-sm' : 'text-[#475569]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="space-y-2 pb-20">
        {filteredCustomers.length === 0 ? (
          <div className="text-center py-12">
            <User size={40} className="mx-auto text-[#94A3B8] mb-2" />
            <p className="text-sm text-[#475569]">No hay clientes</p>
          </div>
        ) : (
          filteredCustomers.map((cd, i) => (
            <button
              key={cd.customer.id}
              onClick={() => openDetail(cd.customer)}
              className="w-full bg-white rounded-xl p-4 shadow-sm text-left active:scale-[0.98] active:bg-[#F1F5F9] transition-all animate-fade-in-up"
              style={{ animationDelay: `${i * 60}ms`, opacity: 0 }}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-[#F1F5F9] flex items-center justify-center flex-shrink-0">
                    <User size={18} className="text-[#94A3B8]" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#0F172A]">{cd.customer.name}</p>
                    {cd.customer.phone && <p className="text-xs text-[#94A3B8]">{cd.customer.phone}</p>}
                  </div>
                </div>
                {cd.hasOverdue && (
                  <span className="text-[10px] bg-[#FEE2E2] text-[#DC2626] px-2 py-0.5 rounded-full font-medium">Vencido</span>
                )}
              </div>

              {cd.totalAmount > 0 && (
                <>
                  <div className="w-full h-1.5 bg-[#FEE2E2] rounded-full overflow-hidden mb-1.5">
                    <div
                      className="h-full bg-[#059669] rounded-full transition-all"
                      style={{ width: `${Math.min(100, (cd.totalPaid / cd.totalAmount) * 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-[#94A3B8]">{cd.activeInstallments} deuda(s) activa(s)</span>
                    {cd.remaining > 0 && <span className="font-bold text-[#DC2626]">Resta: {formatPrice(cd.remaining, 'CUP')}</span>}
                  </div>
                </>
              )}

              {cd.totalAmount === 0 && cd.totalPaid > 0 && (
                <p className="text-xs text-[#059669]">Cliente al día</p>
              )}
            </button>
          ))
        )}
      </div>

      {/* FAB */}
      <button
        onClick={() => openForm()}
        className="fixed bottom-20 right-4 w-14 h-14 bg-[#0F766E] text-white rounded-full shadow-lg flex items-center justify-center z-[150] active:scale-90 transition-transform"
      >
        <Plus size={24} />
      </button>
    </div>
  );
}

function CustomerForm({ customer, onBack, onSave }: { customer: Customer | null; onBack: () => void; onSave: () => void }) {
  const { showToast } = useApp();
  const [name, setName] = useState(customer?.name || '');
  const [phone, setPhone] = useState(customer?.phone || '');
  const [address, setAddress] = useState(customer?.address || '');
  const [notes, setNotes] = useState(customer?.notes || '');

  const handleSubmit = async () => {
    if (!name.trim()) {
      showToast('El nombre es obligatorio', 'error');
      return;
    }

    const data = {
      name: name.trim(),
      phone: phone.trim() || undefined,
      address: address.trim() || undefined,
      notes: notes.trim() || undefined,
      createdAt: customer?.createdAt || new Date(),
    };

    try {
      if (customer?.id) {
        await db.customers.update(customer.id, data);
        showToast('Cliente actualizado', 'success');
      } else {
        await db.customers.add(data);
        showToast('Cliente agregado', 'success');
      }
      onSave();
    } catch {
      showToast('Error al guardar', 'error');
    }
  };

  return (
    <div className="animate-fade-in-up">
      <div className="flex items-center gap-2 mb-4">
        <button onClick={onBack} className="p-2 rounded-lg active:bg-[#F1F5F9]">
          <X size={20} className="text-[#475569]" />
        </button>
        <h2 className="text-lg font-semibold">{customer ? 'Editar Cliente' : 'Nuevo Cliente'}</h2>
      </div>

      <div className="space-y-4 pb-8">
        <div>
          <label className="text-sm font-medium text-[#475569] block mb-1">Nombre completo *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nombre del cliente"
            className="w-full h-12 px-3 rounded-lg border border-[#E2E8F0] text-base focus:border-[#0F766E] focus:ring-2 focus:ring-[#0F766E]/10 outline-none"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-[#475569] block mb-1">Teléfono</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Número de teléfono"
            className="w-full h-12 px-3 rounded-lg border border-[#E2E8F0] text-base focus:border-[#0F766E] focus:ring-2 focus:ring-[#0F766E]/10 outline-none"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-[#475569] block mb-1">Dirección</label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Dirección opcional"
            className="w-full h-12 px-3 rounded-lg border border-[#E2E8F0] text-base focus:border-[#0F766E] focus:ring-2 focus:ring-[#0F766E]/10 outline-none"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-[#475569] block mb-1">Notas</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notas adicionales"
            rows={3}
            className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] text-base focus:border-[#0F766E] focus:ring-2 focus:ring-[#0F766E]/10 outline-none resize-none"
          />
        </div>
        <button
          onClick={handleSubmit}
          className="w-full h-14 bg-[#0F766E] text-white rounded-xl font-semibold text-base active:scale-[0.98] transition-transform"
        >
          {customer ? 'Actualizar Cliente' : 'Guardar Cliente'}
        </button>
      </div>
    </div>
  );
}

function CustomerDetail({ customer, installments, payments, onBack, onEdit }: {
  customer: Customer;
  installments: Installment[];
  payments: InstallmentPayment[];
  onBack: () => void;
  onEdit: () => void;
}) {
  const { formatPrice, showToast } = useApp();
  const [detailTab, setDetailTab] = useState<'debts' | 'payments'>('debts');
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [selectedInstallment, setSelectedInstallment] = useState<Installment | null>(null);

  const totalDebt = installments.filter(i => i.status === 'active').reduce((s, i) => s + i.remainingAmount, 0);
  const totalPaid = installments.reduce((s, i) => s + i.paidAmount, 0);
  const totalSold = installments.reduce((s, i) => s + i.totalAmount, 0);

  const handlePayment = async (installmentId: number, amount: number, method: PaymentMethod) => {
    try {
      await db.installmentPayments.add({
        installmentId,
        amount,
        paymentDate: new Date(),
        paymentMethod: method,
        createdAt: new Date(),
      });

      const inst = installments.find(i => i.id === installmentId);
      if (inst) {
        const newPaid = inst.paidAmount + amount;
        const newRemaining = Math.max(0, inst.totalAmount - newPaid);
        const status = newRemaining <= 0 ? 'completed' : 'active';
        await db.installments.update(installmentId, {
          paidAmount: newPaid,
          remainingAmount: newRemaining,
          status: status as Installment['status'],
        });
      }

      showToast('Pago registrado', 'success');
      setShowPaymentForm(false);
      setSelectedInstallment(null);
    } catch {
      showToast('Error al registrar pago', 'error');
    }
  };

  return (
    <div className="animate-fade-in-up">
      <div className="flex items-center gap-2 mb-4">
        <button onClick={onBack} className="p-2 rounded-lg active:bg-[#F1F5F9]">
          <X size={20} className="text-[#475569]" />
        </button>
        <h2 className="text-lg font-semibold truncate flex-1">{customer.name}</h2>
        <button onClick={onEdit} className="p-2 text-[#0F766E]">
          <span className="text-xs font-medium">Editar</span>
        </button>
      </div>

      {/* Info Card */}
      <div className="bg-white rounded-xl p-4 shadow-sm mb-4 space-y-3">
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-xs text-[#94A3B8]">Comprado</p>
            <p className="text-sm font-bold text-[#0F172A]">{formatPrice(totalSold, 'CUP')}</p>
          </div>
          <div>
            <p className="text-xs text-[#94A3B8]">Pagado</p>
            <p className="text-sm font-bold text-[#059669]">{formatPrice(totalPaid, 'CUP')}</p>
          </div>
          <div>
            <p className="text-xs text-[#94A3B8]">Pendiente</p>
            <p className={`text-sm font-bold ${totalDebt > 0 ? 'text-[#DC2626]' : 'text-[#94A3B8]'}`}>{formatPrice(totalDebt, 'CUP')}</p>
          </div>
        </div>

        {customer.phone && (
          <a href={`tel:${customer.phone}`} className="flex items-center gap-2 text-sm text-[#0F766E]">
            <Phone size={14} />
            {customer.phone}
          </a>
        )}
      </div>

      {/* Tabs */}
      <div className="flex bg-[#F1F5F9] rounded-lg p-1 mb-3">
        <button
          onClick={() => setDetailTab('debts')}
          className={`flex-1 py-2 text-xs font-semibold rounded-md transition-colors ${detailTab === 'debts' ? 'bg-white text-[#0F766E] shadow-sm' : 'text-[#475569]'}`}
        >
          Deudas Activas
        </button>
        <button
          onClick={() => setDetailTab('payments')}
          className={`flex-1 py-2 text-xs font-semibold rounded-md transition-colors ${detailTab === 'payments' ? 'bg-white text-[#0F766E] shadow-sm' : 'text-[#475569]'}`}
        >
          Historial
        </button>
      </div>

      {/* Debts Tab */}
      {detailTab === 'debts' && (
        <div className="space-y-2 pb-4">
          {installments.filter(i => i.status === 'active').length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle size={32} className="mx-auto text-[#059669] mb-2" />
              <p className="text-sm text-[#475569]">Sin deudas activas</p>
            </div>
          ) : (
            installments.filter(i => i.status === 'active').map(inst => {
              const instPayments = payments.filter(p => p.installmentId === inst.id);
              const nextNum = instPayments.length + 1;
              const installmentAmount = inst.totalAmount / inst.numberOfPayments;
              const progress = (inst.paidAmount / inst.totalAmount) * 100;

               let nextDate = new Date(inst.startDate);
              const freqDays = inst.frequency === 'weekly' ? 7 : inst.frequency === 'biweekly' ? 15 : 30;
              for (let i = 0; i < nextNum; i++) {
                if (inst.frequency === 'monthly') {
                  nextDate.setMonth(nextDate.getMonth() + 1);
                } else {
                  nextDate.setDate(nextDate.getDate() + freqDays);
                }
              }

              const isOverdue = nextDate < new Date();

              return (
                <div key={inst.id} className="bg-white rounded-xl p-4 shadow-sm">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="text-sm font-semibold">Venta #{inst.saleId}</p>
                      <p className="text-xs text-[#94A3B8]">{new Date(inst.createdAt).toLocaleDateString('es-CU')}</p>
                    </div>
                    <span className="text-sm font-bold text-[#0F172A]">{formatPrice(inst.totalAmount, 'CUP')}</span>
                  </div>

                  <div className="w-full h-2 bg-[#FEE2E2] rounded-full overflow-hidden mb-2">
                    <div className="h-full bg-[#059669] rounded-full" style={{ width: `${progress}%` }} />
                  </div>

                  <div className="flex justify-between text-xs mb-2">
                    <span className="text-[#475569]">{instPayments.length} de {inst.numberOfPayments} cuotas</span>
                    <span className="text-[#94A3B8]">Resta: {formatPrice(inst.remainingAmount, 'CUP')}</span>
                  </div>

                  {nextNum <= inst.numberOfPayments && (
                    <div className={`flex items-center justify-between p-2 rounded-lg ${isOverdue ? 'bg-[#FEE2E2]' : 'bg-[#FEF3C7]'}`}>
                      <div className="flex items-center gap-1.5">
                        {isOverdue ? <AlertTriangle size={14} className="text-[#DC2626]" /> : <Clock size={14} className="text-[#D97706]" />}
                        <div>
                          <p className={`text-xs font-medium ${isOverdue ? 'text-[#DC2626]' : 'text-[#D97706]'}`}>
                            {isOverdue ? 'Vencida' : 'Próxima'}: {nextDate.toLocaleDateString('es-CU')}
                          </p>
                          <p className="text-xs text-[#475569]">Cuota {nextNum}: {formatPrice(installmentAmount, 'CUP')}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => { setSelectedInstallment(inst); setShowPaymentForm(true); }}
                        className="px-3 py-1.5 bg-[#0F766E] text-white rounded-lg text-xs font-medium active:scale-95"
                      >
                        Pagar
                      </button>
                    </div>
                  )}

                  {nextNum > inst.numberOfPayments && (
                    <p className="text-xs text-[#059669] font-medium text-center py-1">Todas las cuotas pagadas</p>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Payments Tab */}
      {detailTab === 'payments' && (
        <div className="space-y-2 pb-4">
          {payments.filter(p => installments.some(i => i.id === p.installmentId)).length === 0 ? (
            <div className="text-center py-8">
              <CreditCard size={32} className="mx-auto text-[#94A3B8] mb-2" />
              <p className="text-sm text-[#475569]">Sin pagos registrados</p>
            </div>
          ) : (
            payments
              .filter(p => installments.some(i => i.id === p.installmentId))
              .sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime())
              .map(payment => (
                <div key={payment.id} className="bg-white rounded-xl p-3 shadow-sm flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-[#D1FAE5] flex items-center justify-center">
                      <CheckCircle size={14} className="text-[#059669]" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{formatPrice(payment.amount, 'CUP')}</p>
                      <p className="text-xs text-[#94A3B8]">{new Date(payment.paymentDate).toLocaleDateString('es-CU')}</p>
                    </div>
                  </div>
                  <span className="text-xs text-[#475569] capitalize">{payment.paymentMethod === 'cash' ? 'Efectivo' : payment.paymentMethod === 'transfer' ? 'Transferencia' : 'Plazos'}</span>
                </div>
              ))
          )}
        </div>
      )}

      {/* Payment Form Modal */}
      {showPaymentForm && selectedInstallment && (
        <PaymentFormModal
          installment={selectedInstallment}
          onClose={() => { setShowPaymentForm(false); setSelectedInstallment(null); }}
          onPay={handlePayment}
        />
      )}
    </div>
  );
}

function PaymentFormModal({ installment, onClose, onPay }: {
  installment: Installment;
  onClose: () => void;
  onPay: (id: number, amount: number, method: PaymentMethod) => void;
}) {
  const { formatPrice } = useApp();
  const [amount, setAmount] = useState(Math.round((installment.totalAmount / installment.numberOfPayments) * 100) / 100);
  const [method, setMethod] = useState<PaymentMethod>('cash');

  const remaining = installment.remainingAmount;
  const suggestedAmount = Math.min(amount, remaining);

  return (
    <div className="fixed inset-0 z-[300] flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-t-2xl p-4 animate-slide-up">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Registrar Pago</h3>
          <button onClick={onClose}><X size={22} className="text-[#475569]" /></button>
        </div>

        <div className="space-y-4">
          <div className="bg-[#F8FAFC] rounded-lg p-3">
            <p className="text-xs text-[#94A3B8]">Deuda restante</p>
            <p className="text-lg font-bold text-[#0F172A]">{formatPrice(remaining, 'CUP')}</p>
          </div>

          <div>
            <label className="text-sm font-medium text-[#475569] block mb-1">Monto a pagar</label>
            <input
              type="number"
              value={suggestedAmount || ''}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="w-full h-12 px-3 rounded-lg border border-[#E2E8F0] text-base focus:border-[#0F766E] focus:ring-2 focus:ring-[#0F766E]/10 outline-none"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-[#475569] block mb-1">Método de pago</label>
            <div className="grid grid-cols-2 gap-2">
              {(['cash', 'transfer'] as PaymentMethod[]).map(m => (
                <button
                  key={m}
                  onClick={() => setMethod(m)}
                  className={`h-10 rounded-lg text-sm font-medium transition-colors ${
                    method === m ? 'bg-[#0F766E] text-white' : 'bg-[#F1F5F9] text-[#475569]'
                  }`}
                >
                  {m === 'cash' ? 'Efectivo' : 'Transferencia'}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => onPay(installment.id!, suggestedAmount, method)}
            className="w-full h-14 bg-[#059669] text-white rounded-xl font-semibold active:scale-[0.98] transition-transform"
          >
            Confirmar Pago
          </button>
        </div>
      </div>
    </div>
  );
}
