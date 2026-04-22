import { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Search, Plus, X, Camera, Pencil, Trash2, AlertTriangle } from 'lucide-react';
import { db } from '@/lib/db';
import { useApp } from '@/contexts/AppContext';
import type { Product, ProductType, Currency } from '@/types';

type ViewState = 'list' | 'form' | 'detail';
type FilterType = 'all' | 'own' | 'consignment' | 'lowstock';

const PREDEFINED_CATEGORIES = ['Ropa', 'Ferretería', 'Comida', 'Peluquería', 'Electrónica', 'Hogar', 'Otros'];

export default function Productos() {
  const { formatPrice, showToast } = useApp();
  const [view, setView] = useState<ViewState>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const products = useLiveQuery(() => db.products.toArray(), []);

  const filteredProducts = useMemo(() => {
    if (!products) return [];
    return products.filter(p => {
      const matchesSearch = !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesFilter = activeFilter === 'all' ||
        (activeFilter === 'own' && p.type === 'own') ||
        (activeFilter === 'consignment' && p.type === 'consignment') ||
        (activeFilter === 'lowstock' && p.stock <= p.minStock);
      return matchesSearch && matchesFilter;
    });
  }, [products, searchQuery, activeFilter]);

  const handleDelete = async () => {
    if (!selectedProduct?.id) return;
    await db.products.delete(selectedProduct.id);
    showToast('Producto eliminado', 'warning');
    setShowDeleteConfirm(false);
    setView('list');
    setSelectedProduct(null);
  };

  const openForm = (product?: Product) => {
    setEditingProduct(product || null);
    setView('form');
  };

  const openDetail = (product: Product) => {
    setSelectedProduct(product);
    setView('detail');
  };

  if (view === 'form') {
    return <ProductForm product={editingProduct} onBack={() => setView('list')} onSave={() => { setView('list'); setEditingProduct(null); }} />;
  }

  if (view === 'detail' && selectedProduct) {
    return (
      <div className="animate-fade-in-up">
        <div className="flex items-center gap-2 mb-4">
          <button onClick={() => setView('list')} className="p-2 rounded-lg active:bg-[#F1F5F9]">
            <X size={20} className="text-[#475569]" />
          </button>
          <h2 className="text-lg font-semibold">Detalle del Producto</h2>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm space-y-4">
          {selectedProduct.image ? (
            <img src={selectedProduct.image} alt={selectedProduct.name} className="w-full h-48 object-cover rounded-lg" />
          ) : (
            <div className="w-full h-48 bg-[#F1F5F9] rounded-lg flex items-center justify-center">
              <span className="text-4xl">📦</span>
            </div>
          )}

          <div>
            <h3 className="text-xl font-bold">{selectedProduct.name}</h3>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                selectedProduct.type === 'own' ? 'bg-[#D1FAE5] text-[#15803D]' : 'bg-[#DBEAFE] text-[#1E40AF]'
              }`}>
                {selectedProduct.type === 'own' ? 'Propio' : `Ajeno · ${selectedProduct.ownerName}`}
              </span>
              <span className="text-xs text-[#475569]">{selectedProduct.category}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#F8FAFC] rounded-lg p-3">
              <p className="text-xs text-[#94A3B8]">Precio Costo</p>
              <p className="text-sm font-semibold">{formatPrice(selectedProduct.costPrice, selectedProduct.costCurrency)}</p>
            </div>
            <div className="bg-[#F8FAFC] rounded-lg p-3">
              <p className="text-xs text-[#94A3B8]">Precio Venta</p>
              <p className="text-sm font-semibold text-[#0F766E]">{formatPrice(selectedProduct.salePrice, selectedProduct.saleCurrency)}</p>
            </div>
            <div className="bg-[#F8FAFC] rounded-lg p-3">
              <p className="text-xs text-[#94A3B8]">Stock</p>
              <p className={`text-sm font-semibold ${selectedProduct.stock <= selectedProduct.minStock ? 'text-[#D97706]' : 'text-[#0F172A]'}`}>
                {selectedProduct.stock} / mín: {selectedProduct.minStock}
              </p>
            </div>
            <div className="bg-[#F8FAFC] rounded-lg p-3">
              <p className="text-xs text-[#94A3B8]">Ganancia</p>
              <p className="text-sm font-semibold text-[#059669]">
                {formatPrice(selectedProduct.salePrice - selectedProduct.costPrice, selectedProduct.saleCurrency)}
              </p>
            </div>
          </div>

          {selectedProduct.description && (
            <div>
              <p className="text-xs text-[#94A3B8] mb-1">Descripción</p>
              <p className="text-sm text-[#475569]">{selectedProduct.description}</p>
            </div>
          )}

          {selectedProduct.notes && (
            <div>
              <p className="text-xs text-[#94A3B8] mb-1">Notas</p>
              <p className="text-sm text-[#475569]">{selectedProduct.notes}</p>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              onClick={() => openForm(selectedProduct)}
              className="flex-1 h-12 flex items-center justify-center gap-2 border-2 border-[#0F766E] text-[#0F766E] rounded-lg font-medium"
            >
              <Pencil size={16} />
              Editar
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex-1 h-12 flex items-center justify-center gap-2 border-2 border-[#DC2626] text-[#DC2626] rounded-lg font-medium"
            >
              <Trash2 size={16} />
              Eliminar
            </button>
          </div>
        </div>

        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black/40 z-[400] flex items-center justify-center p-4">
            <div className="bg-white rounded-xl p-6 w-full max-w-sm animate-scale-in">
              <AlertTriangle size={32} className="text-[#D97706] mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-center mb-2">Eliminar producto</h3>
              <p className="text-sm text-[#475569] text-center mb-4">¿Estás seguro de eliminar <strong>{selectedProduct.name}</strong>?</p>
              <div className="flex gap-2">
                <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 h-12 border border-[#E2E8F0] rounded-lg text-[#475569]">Cancelar</button>
                <button onClick={handleDelete} className="flex-1 h-12 bg-[#DC2626] text-white rounded-lg font-medium">Eliminar</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="animate-fade-in-up">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-bold">Productos</h2>
        <span className="text-sm text-[#94A3B8]">{products?.length ?? 0} total</span>
      </div>

      {/* Search */}
      <div className="relative mb-2">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar productos..."
          className="w-full h-12 pl-10 pr-4 rounded-xl border border-[#E2E8F0] bg-white text-base focus:border-[#0F766E] focus:ring-2 focus:ring-[#0F766E]/10 outline-none"
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8]">
            <X size={18} />
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar mb-3 pb-1">
        {([
          { key: 'all', label: 'Todos' },
          { key: 'own', label: 'Propios' },
          { key: 'consignment', label: 'Ajenos' },
          { key: 'lowstock', label: 'Stock Bajo' },
        ] as { key: FilterType; label: string }[]).map(f => (
          <button
            key={f.key}
            onClick={() => setActiveFilter(f.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              activeFilter === f.key ? 'bg-[#0F766E] text-white' : 'bg-white text-[#475569] border border-[#E2E8F0]'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Products List */}
      <div className="space-y-2 pb-20">
        {filteredProducts.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto rounded-full bg-[#F1F5F9] flex items-center justify-center mb-2">
              <span className="text-2xl">📦</span>
            </div>
            <p className="text-sm text-[#475569]">No hay productos</p>
          </div>
        ) : (
          filteredProducts.map((product, i) => (
            <button
              key={product.id}
              onClick={() => openDetail(product)}
              className="w-full flex items-center gap-3 bg-white rounded-xl p-3 shadow-sm text-left active:scale-[0.98] active:bg-[#F1F5F9] transition-all animate-fade-in-up"
              style={{ animationDelay: `${i * 30}ms`, opacity: 0 }}
            >
              {product.image ? (
                <img src={product.image} alt={product.name} className="w-[60px] h-[60px] rounded-lg object-cover flex-shrink-0" />
              ) : (
                <div className="w-[60px] h-[60px] rounded-lg bg-[#F1F5F9] flex items-center justify-center flex-shrink-0">
                  <span className="text-xl">📦</span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#0F172A] truncate">{product.name}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                    product.type === 'own' ? 'bg-[#D1FAE5] text-[#15803D]' : 'bg-[#DBEAFE] text-[#1E40AF]'
                  }`}>
                    {product.type === 'own' ? 'Propio' : 'Ajeno'}
                  </span>
                  <span className="text-xs text-[#94A3B8]">{product.category}</span>
                </div>
                <p className={`text-xs mt-0.5 font-medium ${
                  product.stock === 0 ? 'text-[#DC2626]' : product.stock <= product.minStock ? 'text-[#D97706]' : 'text-[#059669]'
                }`}>
                  Stock: {product.stock}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-sm font-bold text-[#0F766E]">{formatPrice(product.salePrice, product.saleCurrency)}</p>
                {product.type === 'consignment' && (
                  <p className="text-[11px] text-[#059669]">+{formatPrice(product.salePrice - product.costPrice, product.saleCurrency)}</p>
                )}
              </div>
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

function ProductForm({ product, onBack, onSave }: { product: Product | null; onBack: () => void; onSave: () => void }) {
  const { showToast } = useApp();
  const isEditing = !!product;

  const [type, setType] = useState<ProductType>(product?.type || 'own');
  const [name, setName] = useState(product?.name || '');
  const [category, setCategory] = useState(product?.category || '');
  const [customCategory, setCustomCategory] = useState('');
  const [costPrice, setCostPrice] = useState(product?.costPrice || 0);
  const [costCurrency, setCostCurrency] = useState<Currency>(product?.costCurrency || 'CUP');
  const [salePrice, setSalePrice] = useState(product?.salePrice || 0);
  const [saleCurrency, setSaleCurrency] = useState<Currency>(product?.saleCurrency || 'CUP');
  const [stock, setStock] = useState(product?.stock || 0);
  const [minStock, setMinStock] = useState(product?.minStock || 5);
  const [description, setDescription] = useState(product?.description || '');
  const [ownerName, setOwnerName] = useState(product?.ownerName || '');
  const [ownerContact, setOwnerContact] = useState(product?.ownerContact || '');
  const [notes, setNotes] = useState(product?.notes || '');
  const [image, setImage] = useState(product?.image || '');
  const [profitPercent, setProfitPercent] = useState(0);

  const finalCategory = category === 'Otro' ? customCategory : category;

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      showToast('La imagen debe ser menor a 2MB', 'warning');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => setImage(reader.result as string);
    reader.readAsDataURL(file);
  };

  const applyProfit = () => {
    if (profitPercent > 0 && costPrice > 0) {
      setSalePrice(Math.round(costPrice * (1 + profitPercent / 100) * 100) / 100);
      setSaleCurrency(costCurrency);
    }
  };

  const handleSubmit = async () => {
    if (!name.trim() || !finalCategory.trim() || costPrice <= 0 || salePrice <= 0) {
      showToast('Complete los campos obligatorios', 'error');
      return;
    }

    const data: Omit<Product, 'id'> = {
      name: name.trim(),
      category: finalCategory.trim(),
      type,
      costPrice,
      salePrice,
      costCurrency,
      saleCurrency,
      stock: Math.max(0, stock),
      minStock: Math.max(0, minStock),
      image: image || undefined,
      description: description.trim() || undefined,
      ownerName: type === 'consignment' ? ownerName.trim() || undefined : undefined,
      ownerContact: type === 'consignment' ? ownerContact.trim() || undefined : undefined,
      notes: notes.trim() || undefined,
      createdAt: product?.createdAt || new Date(),
      updatedAt: new Date(),
    };

    try {
      if (product?.id) {
        await db.products.update(product.id, data);
        showToast('Producto actualizado', 'success');
      } else {
        await db.products.add(data);
        showToast('Producto agregado', 'success');
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
        <h2 className="text-lg font-semibold">{isEditing ? 'Editar Producto' : 'Nuevo Producto'}</h2>
      </div>

      <div className="space-y-4 pb-8">
        {/* Type Toggle */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setType('own')}
            className={`h-12 rounded-lg text-sm font-semibold transition-colors ${
              type === 'own' ? 'bg-[#0F766E] text-white' : 'bg-[#F1F5F9] text-[#475569]'
            }`}
          >
            Propio
          </button>
          <button
            onClick={() => setType('consignment')}
            className={`h-12 rounded-lg text-sm font-semibold transition-colors ${
              type === 'consignment' ? 'bg-[#0F766E] text-white' : 'bg-[#F1F5F9] text-[#475569]'
            }`}
          >
            Ajeno (Intermediario)
          </button>
        </div>

        {/* Image */}
        <div className="flex justify-center">
          <label className="w-28 h-28 border-2 border-dashed border-[#E2E8F0] rounded-xl flex flex-col items-center justify-center cursor-pointer active:bg-[#F8FAFC]">
            {image ? (
              <img src={image} alt="Preview" className="w-full h-full object-cover rounded-xl" />
            ) : (
              <>
                <Camera size={24} className="text-[#94A3B8] mb-1" />
                <span className="text-xs text-[#94A3B8]">Foto</span>
              </>
            )}
            <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
          </label>
        </div>

        {/* Name */}
        <div>
          <label className="text-sm font-medium text-[#475569] block mb-1">Nombre *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nombre del producto"
            className="w-full h-12 px-3 rounded-lg border border-[#E2E8F0] text-base focus:border-[#0F766E] focus:ring-2 focus:ring-[#0F766E]/10 outline-none"
          />
        </div>

        {/* Category */}
        <div>
          <label className="text-sm font-medium text-[#475569] block mb-1">Categoría *</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full h-12 px-3 rounded-lg border border-[#E2E8F0] text-base focus:border-[#0F766E] focus:ring-2 focus:ring-[#0F766E]/10 outline-none bg-white mb-2"
          >
            <option value="">Seleccionar...</option>
            {PREDEFINED_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            <option value="Otro">Otra (escribir)</option>
          </select>
          {category === 'Otro' && (
            <input
              type="text"
              value={customCategory}
              onChange={(e) => setCustomCategory(e.target.value)}
              placeholder="Escribe la categoría"
              className="w-full h-12 px-3 rounded-lg border border-[#E2E8F0] text-base focus:border-[#0F766E] focus:ring-2 focus:ring-[#0F766E]/10 outline-none"
            />
          )}
        </div>

        {/* Cost Price */}
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <div>
            <label className="text-sm font-medium text-[#475569] block mb-1">Precio de Costo *</label>
            <input
              type="number"
              value={costPrice || ''}
              onChange={(e) => setCostPrice(Number(e.target.value))}
              placeholder="0.00"
              className="w-full h-12 px-3 rounded-lg border border-[#E2E8F0] text-base focus:border-[#0F766E] focus:ring-2 focus:ring-[#0F766E]/10 outline-none"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-[#475569] block mb-1">Mon.</label>
            <select
              value={costCurrency}
              onChange={(e) => setCostCurrency(e.target.value as Currency)}
              className="h-12 px-2 rounded-lg border border-[#E2E8F0] text-base focus:border-[#0F766E] outline-none bg-white"
            >
              <option value="CUP">CUP</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="MLC">MLC</option>
            </select>
          </div>
        </div>

        {/* Sale Price */}
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <div>
            <label className="text-sm font-medium text-[#475569] block mb-1">Precio de Venta *</label>
            <input
              type="number"
              value={salePrice || ''}
              onChange={(e) => setSalePrice(Number(e.target.value))}
              placeholder="0.00"
              className="w-full h-12 px-3 rounded-lg border border-[#E2E8F0] text-base focus:border-[#0F766E] focus:ring-2 focus:ring-[#0F766E]/10 outline-none"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-[#475569] block mb-1">Mon.</label>
            <select
              value={saleCurrency}
              onChange={(e) => setSaleCurrency(e.target.value as Currency)}
              className="h-12 px-2 rounded-lg border border-[#E2E8F0] text-base focus:border-[#0F766E] outline-none bg-white"
            >
              <option value="CUP">CUP</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="MLC">MLC</option>
            </select>
          </div>
        </div>

        {/* Profit calculator for consignment */}
        {type === 'consignment' && costPrice > 0 && (
          <div className="bg-[#F0FDFA] rounded-lg p-3 space-y-2">
            <label className="text-sm font-medium text-[#475569] block">% Ganancia (sobre costo)</label>
            <div className="flex gap-2">
              <input
                type="number"
                value={profitPercent || ''}
                onChange={(e) => setProfitPercent(Number(e.target.value))}
                placeholder="20"
                className="flex-1 h-10 px-3 rounded-lg border border-[#E2E8F0] text-base focus:border-[#0F766E] outline-none"
              />
              <button onClick={applyProfit} className="h-10 px-4 bg-[#0F766E] text-white rounded-lg text-sm font-medium active:scale-95">
                Aplicar
              </button>
            </div>
          </div>
        )}

        {/* Stock */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium text-[#475569] block mb-1">Stock *</label>
            <input
              type="number"
              value={stock || ''}
              onChange={(e) => setStock(Number(e.target.value))}
              placeholder="0"
              className="w-full h-12 px-3 rounded-lg border border-[#E2E8F0] text-base focus:border-[#0F766E] focus:ring-2 focus:ring-[#0F766E]/10 outline-none"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-[#475569] block mb-1">Stock Mínimo</label>
            <input
              type="number"
              value={minStock || ''}
              onChange={(e) => setMinStock(Number(e.target.value))}
              placeholder="5"
              className="w-full h-12 px-3 rounded-lg border border-[#E2E8F0] text-base focus:border-[#0F766E] focus:ring-2 focus:ring-[#0F766E]/10 outline-none"
            />
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="text-sm font-medium text-[#475569] block mb-1">Descripción</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descripción opcional"
            rows={3}
            className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] text-base focus:border-[#0F766E] focus:ring-2 focus:ring-[#0F766E]/10 outline-none resize-none"
          />
        </div>

        {/* Consignment fields */}
        {type === 'consignment' && (
          <>
            <div>
              <label className="text-sm font-medium text-[#475569] block mb-1">Nombre del Dueño *</label>
              <input
                type="text"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="Dueño del producto"
                className="w-full h-12 px-3 rounded-lg border border-[#E2E8F0] text-base focus:border-[#0F766E] focus:ring-2 focus:ring-[#0F766E]/10 outline-none"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-[#475569] block mb-1">Contacto del Dueño</label>
              <input
                type="text"
                value={ownerContact}
                onChange={(e) => setOwnerContact(e.target.value)}
                placeholder="Teléfono u otro contacto"
                className="w-full h-12 px-3 rounded-lg border border-[#E2E8F0] text-base focus:border-[#0F766E] focus:ring-2 focus:ring-[#0F766E]/10 outline-none"
              />
            </div>
          </>
        )}

        {/* Notes */}
        <div>
          <label className="text-sm font-medium text-[#475569] block mb-1">Notas</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notas adicionales"
            rows={2}
            className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] text-base focus:border-[#0F766E] focus:ring-2 focus:ring-[#0F766E]/10 outline-none resize-none"
          />
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          className="w-full h-14 bg-[#0F766E] text-white rounded-xl font-semibold text-base active:scale-[0.98] transition-transform"
        >
          {isEditing ? 'Actualizar Producto' : 'Guardar Producto'}
        </button>
      </div>
    </div>
  );
}
