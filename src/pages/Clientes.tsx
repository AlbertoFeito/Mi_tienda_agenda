import { useState, useMemo, useEffect } from 'react';
import { useLiveQuery } from '@/lib/live';
import { Search, Plus, X, User, Phone, CreditCard, CheckCircle, Clock, AlertTriangle, MessageSquare, MessageCircle, Contact, ImagePlus, Upload, Trash2 } from 'lucide-react';
import ConfirmDialog from '@/components/ConfirmDialog';
import { db } from '@/lib/db';
import { pickProductImage } from '@/lib/camera';
import { parseCustomers, planImport, type ImportPlan } from '@/lib/csv';
import { looksLikeVCard, parseVCards } from '@/lib/vcard';
import { batch } from '@/lib/live';
import { useBackHandler } from '@/lib/backHandler';
import NumberField from '@/components/NumberField';
import PhoneField, { isValidCubanPhone, normalizeCubanPhone } from '@/components/PhoneField';
import { buildReminderMessage, openSms, openWhatsApp } from '@/lib/messaging';
import { pickPhoneContact, savePhoneContact, contactsSupported } from '@/lib/contacts';
import { useApp } from '@/contexts/AppContext';
import type { Customer, Installment, InstallmentPayment, PaymentMethod } from '@/types';

type ViewState = 'list' | 'form' | 'detail' | 'import';
type CustomerTab = 'active' | 'all' | 'paid';

/**
 * Whether this customer still owes money.
 *
 * A customer who does cannot be deleted: their card is the only place that
 * debt is shown and collected, so deleting them would leave the money nowhere.
 * Past sales are a different matter — those keep a copy of the name and stay
 * whole either way.
 */
function owesMoney(installments: Installment[], customerId?: number): boolean {
  return installments.some(
    (i) => i.customerId === customerId && i.status === 'active' && i.remainingAmount > 0,
  );
}

export default function Clientes() {
  const { formatPrice, showToast } = useApp();
  const [view, setView] = useState<ViewState>('list');
  const [activeTab, setActiveTab] = useState<CustomerTab>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [marked, setMarked] = useState<Set<number>>(new Set());
  const [confirmBulk, setConfirmBulk] = useState(false);

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
        const freqDays = inst.frequency === 'weekly' ? 7 : inst.frequency === 'biweekly' ? 15 : 30;
        for (let i = 0; i < nextNum; i++) {
          if (inst.frequency === 'monthly') {
            nextDate.setMonth(nextDate.getMonth() + 1);
          } else {
            nextDate.setDate(nextDate.getDate() + freqDays);
          }
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

  const leaveSelecting = () => {
    setSelecting(false);
    setMarked(new Set());
  };

  // Back should drop out of selecting before it leaves the screen.
  useBackHandler(leaveSelecting, selecting);

  const toggleMarked = (id: number) => {
    setMarked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkDelete = async () => {
    setConfirmBulk(false);
    const ids = [...marked];
    try {
      // One refresh at the end, not one per customer.
      await batch(async () => {
        for (const id of ids) await db.customers.delete(id);
      });
      showToast(
        ids.length === 1 ? 'Cliente eliminado' : `${ids.length} clientes eliminados`,
        'success',
      );
      leaveSelecting();
    } catch {
      showToast('Error al eliminar', 'error');
    }
  };

  if (view === 'form') {
    return <CustomerForm customer={editingCustomer} onBack={() => setView('list')} onSave={() => { setView('list'); setEditingCustomer(null); }} />;
  }

  if (view === 'import') {
    return <ImportCustomers existing={customers ?? []} onBack={() => setView('list')} />;
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
      {/* Header con botón de agregar */}
      <div className="flex items-center justify-between mb-3 px-4 pt-4">
        <h2 className="text-xl font-bold">Clientes</h2>
        {selecting ? (
          <button
            onClick={leaveSelecting}
            className="h-10 px-3 flex items-center gap-1.5 border border-[#E2E8F0] text-[#475569] rounded-full text-sm font-medium active:scale-95 transition-transform"
          >
            Cancelar
          </button>
        ) : (
          <div className="flex items-center gap-2">
            {(customers?.length ?? 0) > 0 && (
              <button
                onClick={() => setSelecting(true)}
                className="h-10 px-3 flex items-center gap-1.5 border border-[#E2E8F0] text-[#475569] rounded-full text-sm font-medium active:scale-95 transition-transform"
              >
                Seleccionar
              </button>
            )}
            <button
              onClick={() => setView('import')}
              className="h-10 px-3 flex items-center gap-1.5 border border-[#0F766E] text-[#0F766E] rounded-full text-sm font-medium active:scale-95 transition-transform"
            >
              <Upload size={16} />
              Importar
            </button>
            <button
              onClick={() => openForm()}
              className="w-10 h-10 bg-[#0F766E] text-white rounded-full shadow-sm flex items-center justify-center active:scale-90 transition-transform"
            >
              <Plus size={20} />
            </button>
          </div>
        )}
      </div>

      {/* Search */}
      <div className="relative mb-2 px-4">
        <Search size={18} className="absolute left-7 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar cliente..."
          className="w-full h-12 pl-10 pr-4 rounded-xl border border-[#E2E8F0] bg-white text-base focus:border-[#0F766E] focus:ring-2 focus:ring-[#0F766E]/10 outline-none"
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery('')} className="absolute right-7 top-1/2 -translate-y-1/2 text-[#94A3B8]">
            <X size={18} />
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex bg-[#F1F5F9] rounded-lg p-1 mb-3 mx-4">
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

      {selecting && (
        <p className="text-xs text-[#94A3B8] px-4 mb-2">
          Marca los que quieras borrar. Los que deben dinero no se pueden marcar.
        </p>
      )}

      {/* List */}
      <div className={`space-y-2 px-4 ${selecting ? 'pb-28' : 'pb-20'}`}>
        {filteredCustomers.length === 0 ? (
          <div className="text-center py-12">
            <User size={40} className="mx-auto text-[#94A3B8] mb-2" />
            <p className="text-sm text-[#475569]">No hay clientes</p>
          </div>
        ) : (
          filteredCustomers.map((cd, i) => {
            const id = cd.customer.id;
            const hasDebt = cd.remaining > 0;
            const isMarked = id !== undefined && marked.has(id);

            return (
            <button
              key={cd.customer.id}
              onClick={() => {
                if (!selecting) { openDetail(cd.customer); return; }
                if (hasDebt || id === undefined) {
                  showToast('Este cliente todavía debe: no se puede borrar', 'warning');
                  return;
                }
                toggleMarked(id);
              }}
              className={`w-full bg-white rounded-xl p-4 shadow-sm text-left active:scale-[0.98] active:bg-[#F1F5F9] transition-all animate-fade-in-up ${
                isMarked ? 'ring-2 ring-[#DC2626]' : ''
              } ${selecting && hasDebt ? 'opacity-50' : ''}`}
              style={{ animationDelay: `${i * 60}ms`, opacity: 0 }}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {selecting && (
                    <span
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                        isMarked ? 'bg-[#DC2626] border-[#DC2626]' : 'border-[#CBD5E1]'
                      }`}
                    >
                      {isMarked && <CheckCircle size={14} className="text-white" />}
                    </span>
                  )}
                  {cd.customer.avatar ? (
                    <img
                      src={cd.customer.avatar}
                      alt=""
                      className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-[#F1F5F9] flex items-center justify-center flex-shrink-0">
                      <User size={18} className="text-[#94A3B8]" />
                    </div>
                  )}
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
            );
          })
        )}
      </div>

      {selecting && marked.size > 0 && (
        <div className="fixed bottom-16 left-0 right-0 max-w-lg mx-auto px-4 pb-2 z-40">
          <button
            onClick={() => setConfirmBulk(true)}
            className="w-full h-14 flex items-center justify-center gap-2 bg-[#DC2626] text-white rounded-xl font-semibold text-base shadow-lg active:scale-[0.98] transition-transform"
          >
            <Trash2 size={18} />
            Eliminar {marked.size} cliente(s)
          </button>
        </div>
      )}

      {confirmBulk && (
        <ConfirmDialog
          title={`¿Eliminar ${marked.size} cliente(s)?`}
          message="Se borran de tu lista de clientes. Las ventas que les hiciste no se tocan: guardan su nombre."
          onConfirm={handleBulkDelete}
          onCancel={() => setConfirmBulk(false)}
        />
      )}

      {/* FAB ELIMINADO - ahora está en el header */}
    </div>
  );
}

/**
 * Bringing a customer list in from the phone's contacts.
 *
 * Two things had to be true for this to be useful. It has to read what the
 * phone actually exports — a `.vcf`, not a CSV — and it has to let you pick.
 * A contact list is not a customer list: it has the fire brigade, the pizza
 * place and your mother in it. So nothing is written until the file has been
 * read and every name has been seen and ticked.
 */
function ImportCustomers({ existing, onBack }: { existing: Customer[]; onBack: () => void }) {
  const { showToast } = useApp();
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [columns, setColumns] = useState<string[]>([]);
  const [fileName, setFileName] = useState('');
  const [chosen, setChosen] = useState<Set<number>>(new Set());
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);

  useBackHandler(onBack);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      // The format is decided by what is inside, not by the file's name.
      const parsed = looksLikeVCard(text) ? parseVCards(text) : parseCustomers(text);
      if (!parsed.customers.length && !parsed.skipped && !parsed.skippedPhone) {
        showToast('Ese archivo no parece una lista de contactos', 'error');
        return;
      }
      const next = planImport(parsed, existing);
      setFileName(file.name);
      setColumns(parsed.columns);
      setPlan(next);
      setChosen(new Set(next.toAdd.map((_, i) => i)));
      setQuery('');
    } catch {
      showToast('No se pudo leer el archivo', 'error');
    }
  };

  const visible = useMemo(() => {
    if (!plan) return [];
    const rows = plan.toAdd.map((c, i) => ({ c, i }));
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(({ c }) => c.name.toLowerCase().includes(q) || (c.phone ?? '').includes(q));
  }, [plan, query]);

  const toggle = (i: number) => {
    setChosen((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  /** The Todos / Ninguno buttons act on what is on screen, not on the whole file. */
  const setAllVisible = (on: boolean) => {
    setChosen((prev) => {
      const next = new Set(prev);
      for (const { i } of visible) {
        if (on) next.add(i);
        else next.delete(i);
      }
      return next;
    });
  };

  const handleConfirm = async () => {
    if (!plan || saving || chosen.size === 0) return;
    setSaving(true);
    const picked = plan.toAdd.filter((_, i) => chosen.has(i));
    try {
      // One refresh at the end instead of one per customer, or three hundred
      // reloads would freeze the screen.
      await batch(async () => {
        for (const c of picked) {
          await db.customers.add({
            name: c.name,
            phone: c.phone,
            address: c.address,
            notes: c.notes,
            createdAt: new Date(),
          });
        }
      });
      showToast(
        picked.length === 1 ? '1 cliente importado' : `${picked.length} clientes importados`,
        'success',
      );
      onBack();
    } catch {
      showToast('Error al guardar los clientes', 'error');
      setSaving(false);
    }
  };

  if (!plan) {
    return (
      <div className="animate-fade-in-up">
        <div className="flex items-center gap-2 mb-4 px-4 pt-4">
          <h2 className="text-lg font-semibold">Importar clientes</h2>
        </div>
        <div className="space-y-4 pb-8 px-4">
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-4 space-y-2">
            <p className="text-sm text-[#475569]">
              En el teléfono: abre <span className="font-semibold">Contactos</span> → Ajustes →{' '}
              <span className="font-semibold">Exportar</span>. Te deja un archivo{' '}
              <span className="font-semibold">.vcf</span>. Elígelo aquí.
            </p>
            <p className="text-sm text-[#475569]">
              También sirve un <span className="font-semibold">.csv</span> hecho en Excel con las
              columnas Nombre, Teléfono, Dirección y Notas.
            </p>
            <p className="text-xs text-[#94A3B8]">
              Después eliges uno a uno quién entra: en la agenda del teléfono están la pizzería y
              los Bomberos, y esos no son clientes.
            </p>
            <p className="text-xs text-[#94A3B8]">
              No se borra ni se cambia nada de lo que ya tienes, y los que ya estén guardados se
              saltan.
            </p>
          </div>

          <label className="w-full h-14 flex items-center justify-center gap-2 bg-[#0F766E] text-white rounded-xl font-semibold text-base active:scale-[0.98] transition-transform cursor-pointer">
            <Upload size={18} />
            Elegir archivo
            {/* Sin filtro de tipo a propósito: los selectores de Android
                esconden el .vcf cuando se les pide .csv. */}
            <input type="file" onChange={handleFile} className="hidden" />
          </label>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full animate-fade-in-up">
      <div className="px-4 pt-4 pb-3 bg-white border-b border-[#E2E8F0] space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Importar clientes</h2>
          <p className="text-xs text-[#94A3B8] break-all">{fileName}</p>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle size={18} className="text-[#059669] flex-shrink-0" />
            <span className="text-[#0F172A]">
              <span className="font-bold">{chosen.size}</span> de {plan.toAdd.length} seleccionados
            </span>
          </div>
          {plan.duplicates.length > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <User size={18} className="text-[#94A3B8] flex-shrink-0" />
              <span className="text-[#475569]">
                <span className="font-bold">{plan.duplicates.length}</span> ya estaban guardados
              </span>
            </div>
          )}
          {plan.skippedPhone > 0 && (
            <div className="flex items-start gap-2 text-sm">
              <AlertTriangle size={18} className="text-[#D97706] flex-shrink-0 mt-0.5" />
              <span className="text-[#475569]">
                <span className="font-bold">{plan.skippedPhone}</span> con teléfono extranjero o
                código corto: no entran, la app marca siempre con +53
              </span>
            </div>
          )}
          {plan.skipped > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <AlertTriangle size={18} className="text-[#D97706] flex-shrink-0" />
              <span className="text-[#475569]">
                <span className="font-bold">{plan.skipped}</span> sin nombre, no se pueden usar
              </span>
            </div>
          )}
          {columns.length > 0 && (
            <p className="text-xs text-[#94A3B8]">Se leyó: {columns.join(', ')}</p>
          )}
        </div>

        {plan.toAdd.length > 0 && (
          <>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nombre o teléfono..."
              className="w-full h-11 px-3 rounded-xl border border-[#E2E8F0] text-base focus:border-[#0F766E] focus:ring-2 focus:ring-[#0F766E]/10 outline-none"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setAllVisible(true)}
                className="flex-1 h-9 text-sm font-medium text-[#0F766E] border border-[#0F766E] rounded-lg active:scale-95 transition-transform"
              >
                Todos
              </button>
              <button
                onClick={() => setAllVisible(false)}
                className="flex-1 h-9 text-sm font-medium text-[#475569] border border-[#E2E8F0] rounded-lg active:scale-95 transition-transform"
              >
                Ninguno
              </button>
            </div>
          </>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-2">
        {visible.length === 0 ? (
          <p className="text-center text-sm text-[#94A3B8] py-10">
            {plan.toAdd.length === 0 ? 'No hay nadie nuevo en ese archivo' : 'Sin resultados'}
          </p>
        ) : (
          <div className="divide-y divide-[#F1F5F9]">
            {visible.map(({ c, i }) => (
              <label key={i} className="flex items-center gap-3 py-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={chosen.has(i)}
                  onChange={() => toggle(i)}
                  className="w-5 h-5 accent-[#0F766E] flex-shrink-0"
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm text-[#0F172A] truncate">{c.name}</span>
                  <span className="block text-xs text-[#94A3B8]">{c.phone || 'sin teléfono'}</span>
                </span>
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="px-4 py-3 bg-white border-t border-[#E2E8F0] space-y-2">
        <button
          onClick={handleConfirm}
          disabled={chosen.size === 0 || saving}
          className="w-full h-14 bg-[#0F766E] text-white rounded-xl font-semibold text-base active:scale-[0.98] transition-transform disabled:opacity-50"
        >
          {saving
            ? 'Guardando...'
            : chosen.size === 0
              ? 'No hay nadie seleccionado'
              : `Agregar ${chosen.size} cliente(s)`}
        </button>
        <button
          onClick={() => { setPlan(null); setColumns([]); setFileName(''); setChosen(new Set()); setQuery(''); }}
          className="w-full h-11 border border-[#E2E8F0] text-[#475569] rounded-xl font-medium active:scale-[0.98] transition-transform"
        >
          Elegir otro archivo
        </button>
      </div>
    </div>
  );
}

function CustomerForm({ customer, onBack, onSave }: { customer: Customer | null; onBack: () => void; onSave: () => void }) {
  const { showToast } = useApp();
  const [name, setName] = useState(customer?.name || '');
  const [phone, setPhone] = useState(customer?.phone || '');
  const [address, setAddress] = useState(customer?.address || '');
  const [notes, setNotes] = useState(customer?.notes || '');
  const [avatar, setAvatar] = useState<string | undefined>(customer?.avatar);

  useBackHandler(onBack);

  const canContacts = contactsSupported();
  const [saveToContacts, setSaveToContacts] = useState(false);

  const handlePickContact = async () => {
    const picked = await pickPhoneContact();
    if (!picked) {
      showToast('No se pudo obtener el contacto', 'warning');
      return;
    }
    if (picked.name) setName(picked.name);
    if (picked.phone) setPhone(picked.phone);
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      showToast('El nombre es obligatorio', 'error');
      return;
    }
    if (!isValidCubanPhone(phone)) {
      showToast('El teléfono debe tener 8 dígitos (Cuba)', 'error');
      return;
    }

    const data = {
      name: name.trim(),
      phone: normalizeCubanPhone(phone) || undefined,
      address: address.trim() || undefined,
      notes: notes.trim() || undefined,
      avatar,
      createdAt: customer?.createdAt || new Date(),
    };

    try {
      if (customer?.id) {
        await db.customers.update(customer.id, data);
        showToast('Cliente actualizado', 'success');
      } else {
        await db.customers.add(data);
        if (saveToContacts && canContacts) {
          const ok = await savePhoneContact(data.name, normalizeCubanPhone(phone));
          showToast(ok ? 'Cliente agregado y guardado en contactos' : 'Cliente agregado', 'success');
        } else {
          showToast('Cliente agregado', 'success');
        }
      }
      onSave();
    } catch {
      showToast('Error al guardar', 'error');
    }
  };

  return (
    <div className="animate-fade-in-up">
      <div className="flex items-center gap-2 mb-4 px-4 pt-4">
        <h2 className="text-lg font-semibold">{customer ? 'Editar Cliente' : 'Nuevo Cliente'}</h2>
      </div>

      <div className="space-y-4 pb-8 px-4">
        {canContacts && (
          <button
            type="button"
            onClick={handlePickContact}
            className="w-full h-12 flex items-center justify-center gap-2 border-2 border-[#0F766E] text-[#0F766E] rounded-xl font-medium active:scale-[0.98] transition-transform"
          >
            <Contact size={18} />
            Elegir de contactos
          </button>
        )}
        <div className="flex flex-col items-center gap-1.5">
          <button
            type="button"
            onClick={async () => {
              const picked = await pickProductImage();
              if (picked) setAvatar(picked);
            }}
            className="w-24 h-24 rounded-full bg-[#F1F5F9] flex items-center justify-center overflow-hidden border-2 border-dashed border-[#CBD5E1] active:border-[#0F766E]"
            aria-label="Foto del cliente"
          >
            {avatar ? (
              <img src={avatar} alt="" className="w-full h-full object-cover" />
            ) : (
              <ImagePlus className="w-7 h-7 text-[#94A3B8]" />
            )}
          </button>
          <span className="text-xs text-[#94A3B8]">Foto del cliente (opcional)</span>
          {avatar && (
            <button
              type="button"
              onClick={() => setAvatar(undefined)}
              className="text-xs font-medium text-[#DC2626] active:opacity-70"
            >
              Quitar foto
            </button>
          )}
        </div>
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
          <PhoneField value={phone} onChange={setPhone} />
        </div>
        {canContacts && !customer && (
          <label className="flex items-center gap-3 px-1 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={saveToContacts}
              onChange={(e) => setSaveToContacts(e.target.checked)}
              className="w-5 h-5 accent-[#0F766E]"
            />
            <span className="text-sm text-[#475569]">Guardar también en los contactos del teléfono</span>
          </label>
        )}
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
  const { formatPrice, showToast, settings } = useApp();
  const [detailTab, setDetailTab] = useState<'debts' | 'payments'>('debts');
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [selectedInstallment, setSelectedInstallment] = useState<Installment | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useBackHandler(onBack);

  const hasDebt = owesMoney(installments, customer.id);

  const handleDelete = async () => {
    setConfirmDelete(false);
    if (!customer.id) return;
    try {
      await db.customers.delete(customer.id);
      showToast('Cliente eliminado', 'success');
      onBack();
    } catch {
      showToast('Error al eliminar', 'error');
    }
  };

  const storeName = settings?.storeName || 'NayadeStore';

  const sendReminder = async (
    kind: 'sms' | 'whatsapp',
    amount: number,
    dueDate: Date,
    overdue: boolean,
  ) => {
    if (!customer.phone) {
      showToast('Este cliente no tiene teléfono guardado', 'warning');
      return;
    }
    const text = buildReminderMessage({ customerName: customer.name, amount, dueDate, storeName, overdue });
    try {
      if (kind === 'sms') await openSms(customer.phone, text);
      else await openWhatsApp(customer.phone, text);
    } catch {
      showToast('No se pudo abrir la app de mensajes', 'error');
    }
  };

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
      <div className="flex items-center gap-2 mb-4 px-4 pt-4">
        <h2 className="text-lg font-semibold truncate flex-1">{customer.name}</h2>
        <button onClick={onEdit} className="p-2 text-[#0F766E]">
          <span className="text-xs font-medium">Editar</span>
        </button>
      </div>

      {/* Info Card */}
      <div className="bg-white rounded-xl p-4 shadow-sm mb-4 mx-4 space-y-3">
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
      <div className="flex bg-[#F1F5F9] rounded-lg p-1 mb-3 mx-4">
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
        <div className="space-y-2 pb-4 px-4">
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

                  {nextNum <= inst.numberOfPayments && (
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => sendReminder('sms', installmentAmount, nextDate, isOverdue)}
                        className="flex-1 h-9 flex items-center justify-center gap-1.5 rounded-lg border border-[#0F766E] text-[#0F766E] text-xs font-medium active:scale-[0.98] transition-transform"
                      >
                        <MessageSquare size={14} />
                        Recordar SMS
                      </button>
                      <button
                        onClick={() => sendReminder('whatsapp', installmentAmount, nextDate, isOverdue)}
                        className="flex-1 h-9 flex items-center justify-center gap-1.5 rounded-lg bg-[#25D366] text-white text-xs font-medium active:scale-[0.98] transition-transform"
                      >
                        <MessageCircle size={14} />
                        WhatsApp
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
        <div className="space-y-2 pb-4 px-4">
          {payments.filter(p => installments.some(i => i.id === p.installmentId)).length === 0 ? (
            <div className="text-center py-8">
              <CreditCard size={32} className="mx-auto text-[#94A3B8] mb-2" />
              <p className="text-sm text-[#475569]">Sin pagos registrados</p>
            </div>
          ) : (
            payments
              .filter(p => installments.some(i => i.id === p.installmentId))
              .sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime())
              .map(payment => {
                const inst = installments.find(i => i.id === payment.installmentId);
                return (
                  <div key={payment.id} className="bg-white rounded-xl p-3 shadow-sm flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Cuota pagada</p>
                      <p className="text-xs text-[#94A3B8]">
                        {inst ? `Venta #${inst.saleId}` : 'Venta'} · {new Date(payment.paymentDate).toLocaleDateString('es-CU')}
                      </p>
                    </div>
                    <span className="text-sm font-bold text-[#059669]">{formatPrice(payment.amount, 'CUP')}</span>
                  </div>
                );
              })
          )}
        </div>
      )}

      <div className="px-4 pt-2 pb-8">
        <button
          onClick={() => {
            if (hasDebt) {
              showToast('No se puede: este cliente todavía debe', 'warning');
              return;
            }
            setConfirmDelete(true);
          }}
          className={`w-full h-12 flex items-center justify-center gap-2 border rounded-xl font-medium active:scale-[0.98] transition-transform ${
            hasDebt ? 'border-[#E2E8F0] text-[#94A3B8]' : 'border-[#DC2626] text-[#DC2626]'
          }`}
        >
          <Trash2 size={18} />
          Eliminar cliente
        </button>
        {hasDebt && (
          <p className="text-xs text-[#94A3B8] text-center mt-2">
            Mientras deba no se puede borrar: esta ficha es el único sitio donde se ve y se cobra
            esa deuda.
          </p>
        )}
      </div>

      {/* Payment Form Modal */}
      {showPaymentForm && selectedInstallment && (
        <PaymentForm
          installment={selectedInstallment}
          onClose={() => { setShowPaymentForm(false); setSelectedInstallment(null); }}
          onPay={handlePayment}
        />
      )}

      {confirmDelete && (
        <ConfirmDialog
          title={`¿Eliminar a ${customer.name}?`}
          message="Se borra de tu lista de clientes. Las ventas que le hiciste no se tocan: guardan su nombre."
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
}

function PaymentForm({ installment, onClose, onPay }: {
  installment: Installment;
  onClose: () => void;
  onPay: (installmentId: number, amount: number, method: PaymentMethod) => void;
}) {
  const { formatPrice } = useApp();
  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const maxAmount = installment.totalAmount / installment.numberOfPayments;

  useBackHandler(onClose);

  useEffect(() => {
    if (amount === 0) setAmount(maxAmount);
  }, []);

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-t-3xl w-full max-w-lg p-5 animate-slide-up">
        <div className="flex justify-center mb-3">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>
        <h3 className="text-lg font-semibold mb-4">Registrar Pago</h3>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-[#475569] block mb-1">Monto (CUP)</label>
            <NumberField value={amount} onChange={setAmount} decimals min={0} max={maxAmount} />
            <p className="text-xs text-[#94A3B8] mt-1">Máximo: {formatPrice(maxAmount, 'CUP')}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-[#475569] block mb-1">Método</label>
            <div className="grid grid-cols-3 gap-2">
              {(['cash', 'transfer', 'installment'] as PaymentMethod[]).map(m => (
                <button
                  key={m}
                  onClick={() => setMethod(m)}
                  className={`py-2 rounded-lg text-xs font-medium border-2 ${
                    method === m ? 'border-[#0F766E] bg-[#0F766E]/5 text-[#0F766E]' : 'border-gray-200 text-gray-600'
                  }`}
                >
                  {m === 'cash' ? 'Efectivo' : m === 'transfer' ? 'Transferencia' : 'A plazos'}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={() => {
              if (installment.id) {
                onPay(installment.id, amount, method);
              }
            }}
            className="w-full h-14 bg-[#0F766E] text-white rounded-xl font-semibold active:scale-[0.98] transition-transform"
          >
            Confirmar Pago
          </button>
        </div>
      </div>
    </div>
  );
}
