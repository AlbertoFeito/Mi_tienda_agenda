import { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Search, Plus, X, Package, Camera } from 'lucide-react';
import { db } from '@/lib/db';
import { useApp } from '@/contexts/AppContext';
import type { Product, ProductType, Currency } from '@/types';

type ViewState = 'list' | 'form';
type ProductFilter = 'all' | 'own' | 'consignment' | 'lowstock';

export default function Productos() {
  const { formatPrice, showToast } = useApp();
  const [view, setView] = useState<ViewState>('list');
  const [filter, setFilter] = useState<ProductFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const products = useLiveQuery(() => db.products.toArray(), []) || [];

  const filteredProducts = useMemo(() => {
    let result = [...products];
    if (filter === 'own') result = result.filter(p => p.type === 'own');
    if (filter === 'consignment') result = result.filter(p => p.type === 'consignment');
    if (filter === 'lowstock') result = result.filter(p => p.stock <= p.minStock);
    if (searchQuery) {
      result = result.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.category.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    return result;
  }, [products, filter, searchQuery]);

  const openForm = (product?: Product) => {
    setEditingProduct(product || null);
    setView('form');
  };

  if (view === 'form') {
    return <ProductForm product={editingProduct} onBack={() => { setView('list'); setEditingProduct(null); }} />;
  }

  return (
    <div className="flex flex-col h-full bg-[#F8FAFC]">
      {/* Header con botón de agregar en el título */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Productos</h2>
            <p className="text-sm text-gray-500">{products.length} total</p>
          </div>
          <button
            onClick={() => openForm()}
            className="w-10 h-10 bg-[#0F766E] text-white rounded-full shadow-sm flex items-center justify-center active:scale-90 transition-transform"
          >
            <Plus size={20} />
          </button>
        </div>

        {/* Búsqueda */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar productos..."
            className="w-full h-12 pl-10 pr-10 rounded-xl border border-[#E2E8F0] bg-white text-base focus:border-[#0F766E] focus:ring-2 focus:ring-[#0F766E]/10 outline-none"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="w-5 h-5 text-gray-400" />
            </button>
          )}
        </div>

        {/* Filtros */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {([
            { key: 'all', label: 'Todos' },
            { key: 'own', label: 'Propios' },
            { key: 'consignment', label: 'Ajenos' },
            { key: 'lowstock', label: 'Stock Bajo' },
          ] as { key: ProductFilter; label: string }[]).map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                filter === f.key
                  ? 'bg-[#0F766E] text-white'
                  : 'bg-white text-gray-600 border border-[#E2E8F0]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Lista de productos */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {filteredProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <Package className="w-12 h-12 mb-3" />
            <p>No hay productos</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredProducts.map((product, i) => (
              <button
                key={product.id}
                onClick={() => openForm(product)}
                className="w-full bg-white rounded-xl p-4 shadow-sm text-left active:bg-[#F1F5F9] transition-colors"
                style={{ animationDelay: `${i * 30}ms` }}
              >
                <div className="flex items-start gap-3">
                  {product.image ? (
                    <img src={product.image} alt={product.name} className="w-16 h-16 rounded-xl object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-16 h-16 rounded-xl bg-gray-100 flex items-center justify-center text-2xl flex-shrink-0">
                      📦
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-gray-900 truncate">{product.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            product.type === 'own' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                          }`}>
                            {product.type === 'own' ? 'Propio' : 'Ajeno'}
                          </span>
                          <span className="text-xs text-gray-500">{product.category}</span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-semibold text-[#0F766E]">{formatPrice(product.salePrice, product.saleCurrency)}</p>
                        <p className={`text-xs font-medium ${
                          product.stock <= 0 ? 'text-red-500' : 
                          product.stock <= product.minStock ? 'text-orange-500' : 'text-gray-500'
                        }`}>
                          Stock: {product.stock}
                        </p>
                      </div>
                    </div>
                    {product.stock <= 0 && (
                      <p className="text-xs text-red-500 mt-1 font-medium">Sin stock disponible</p>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ProductForm({ product, onBack }: { product: Product | null; onBack: () => void }) {
  const { formatPrice, showToast } = useApp();
  const [name, setName] = useState(product?.name || '');
  const [category, setCategory] = useState(product?.category || '');
  const [customCategory, setCustomCategory] = useState('');
  const [type, setType] = useState<ProductType>(product?.type || 'own');
  const [costPrice, setCostPrice] = useState(product?.costPrice || 0);
  const [costCurrency, setCostCurrency] = useState<Currency>(product?.costCurrency || 'CUP');
  const [salePrice, setSalePrice] = useState(product?.salePrice || 0);
  const [saleCurrency, setSaleCurrency] = useState<Currency>(product?.saleCurrency || 'CUP');
  const [stock, setStock] = useState(product?.stock ?? 0);
  const [minStock, setMinStock] = useState(product?.minStock || 5);
  const [description, setDescription] = useState(product?.description || '');
  const [image, setImage] = useState<string | undefined>(product?.image);
  const [ownerName, setOwnerName] = useState(product?.ownerName || '');
  const [ownerContact, setOwnerContact] = useState(product?.ownerContact || '');
  const [profitPercent, setProfitPercent] = useState(20);

  const categories = useMemo(() => {
    const all = new Set<string>();
    ['Comida', 'Bebida', 'Limpieza', 'Higiene', 'Otro'].forEach(c => all.add(c));
    return Array.from(all);
  }, []);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImage(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      showToast('El nombre es obligatorio', 'error');
      return;
    }
    if (costPrice <= 0 || salePrice <= 0) {
      showToast('Los precios deben ser mayores a 0', 'error');
      return;
    }
    if (stock < 0) {
      showToast('El stock no puede ser negativo', 'error');
      return;
    }

    const finalCategory = category === 'Otro' ? customCategory : category;

    const data = {
      name: name.trim(),
      category: finalCategory,
      type,
      costPrice,
      costCurrency,
      salePrice,
      saleCurrency,
      stock,
      minStock,
      description: description.trim() || undefined,
      image,
      ownerName: type === 'consignment' ? ownerName.trim() || undefined : undefined,
      ownerContact: type === 'consignment' ? ownerContact.trim() || undefined : undefined,
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
      onBack();
    } catch {
      showToast('Error al guardar', 'error');
    }
  };

  const handleDelete = async () => {
    if (!product?.id) return;
    if (!confirm('¿Eliminar este producto?')) return;
    try {
      await db.products.delete(product.id);
      showToast('Producto eliminado', 'success');
      onBack();
    } catch {
      showToast('Error al eliminar', 'error');
    }
  };

  const suggestedSalePrice = useMemo(() => {
    if (type !== 'consignment' || costPrice <= 0) return 0;
    return costPrice * (1 + profitPercent / 100);
  }, [type, costPrice, profitPercent]);

  return (
    <div className="animate-fade-in-up">
      <div className="flex items-center gap-2 mb-4 px-4 pt-4">
        <button onClick={onBack} className="p-2 rounded-lg active:bg-[#F1F5F9]">
          <X size={20} className="text-[#475569]" />
        </button>
        <h2 className="text-lg font-semibold">{product ? 'Editar Producto' : 'Nuevo Producto'}</h2>
      </div>

      <div className="px-4 pb-8 space-y-4">
        {/* Tipo Toggle */}
        <div className="flex bg-[#F1F5F9] rounded-lg p-1">
          <button
            onClick={() => setType('own')}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${type === 'own' ? 'bg-white text-[#0F766E] shadow-sm' : 'text-[#475569]'}`}
          >
            Propio
          </button>
          <button
            onClick={() => setType('consignment')}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${type === 'consignment' ? 'bg-white text-[#0F766E] shadow-sm' : 'text-[#475569]'}`}
          >
            Ajeno
          </button>
        </div>

        {/* Imagen */}
        <div className="flex justify-center">
          <label className="w-24 h-24 rounded-xl bg-gray-100 flex items-center justify-center cursor-pointer overflow-hidden border-2 border-dashed border-gray-300 active:border-[#0F766E]">
            {image ? (
              <img src={image} alt="Preview" className="w-full h-full object-cover" />
            ) : (
              <Camera className="w-8 h-8 text-gray-400" />
            )}
            <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
          </label>
        </div>

        {/* Nombre */}
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

        {/* Categoría */}
        <div>
          <label className="text-sm font-medium text-[#475569] block mb-1">Categoría *</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full h-12 px-3 rounded-lg border border-[#E2E8F0] text-base focus:border-[#0F766E] focus:ring-2 focus:ring-[#0F766E]/10 outline-none bg-white"
          >
            <option value="">Seleccionar...</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          {category === 'Otro' && (
            <input
              type="text"
              value={customCategory}
              onChange={(e) => setCustomCategory(e.target.value)}
              placeholder="Escribe la categoría"
              className="w-full h-12 px-3 rounded-lg border border-[#E2E8F0] text-base focus:border-[#0F766E] focus:ring-2 focus:ring-[#0F766E]/10 outline-none mt-2"
            />
          )}
        </div>

        {/* Precio de Costo */}
        <div className="grid grid-cols-2 gap-2">
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
              className="w-full h-12 px-2 rounded-lg border border-[#E2E8F0] text-base focus:border-[#0F766E] outline-none bg-white"
            >
              {(['CUP', 'USD', 'EUR', 'MLC'] as Currency[]).map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Precio de Venta */}
        <div className="grid grid-cols-2 gap-2">
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
              className="w-full h-12 px-2 rounded-lg border border-[#E2E8F0] text-base focus:border-[#0F766E] outline-none bg-white"
            >
              {(['CUP', 'USD', 'EUR', 'MLC'] as Currency[]).map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Calculadora de ganancia para productos ajenos */}
        {type === 'consignment' && costPrice > 0 && (
          <div className="bg-[#F0FDFA] rounded-xl p-3 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm text-[#475569]">% Ganancia</span>
              <input
                type="number"
                value={profitPercent}
                onChange={(e) => setProfitPercent(Number(e.target.value))}
                className="w-20 h-10 px-2 rounded-lg border border-[#E2E8F0] text-sm"
              />
            </div>
            <p className="text-sm font-medium text-[#0F766E]">
              Precio sugerido: {formatPrice(suggestedSalePrice, costCurrency)}
            </p>
          </div>
        )}

        {/* Stock */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-sm font-medium text-[#475569] block mb-1">Stock *</label>
            <input
              type="number"
              value={stock}
              onChange={(e) => setStock(Number(e.target.value))}
              placeholder="0"
              className="w-full h-12 px-3 rounded-lg border border-[#E2E8F0] text-base focus:border-[#0F766E] focus:ring-2 focus:ring-[#0F766E]/10 outline-none"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-[#475569] block mb-1">Stock Mínimo</label>
            <input
              type="number"
              value={minStock}
              onChange={(e) => setMinStock(Number(e.target.value))}
              placeholder="5"
              className="w-full h-12 px-3 rounded-lg border border-[#E2E8F0] text-base focus:border-[#0F766E] focus:ring-2 focus:ring-[#0F766E]/10 outline-none"
            />
          </div>
        </div>

        {/* Descripción */}
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

        {/* Datos del dueño (solo para productos ajenos) */}
        {type === 'consignment' && (
          <div className="space-y-3 pt-2 border-t border-gray-100">
            <p className="text-sm font-medium text-[#475569]">Datos del dueño</p>
            <input
              type="text"
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              placeholder="Nombre del dueño"
              className="w-full h-12 px-3 rounded-lg border border-[#E2E8F0] text-base focus:border-[#0F766E] focus:ring-2 focus:ring-[#0F766E]/10 outline-none"
            />
            <input
              type="text"
              value={ownerContact}
              onChange={(e) => setOwnerContact(e.target.value)}
              placeholder="Contacto del dueño"
              className="w-full h-12 px-3 rounded-lg border border-[#E2E8F0] text-base focus:border-[#0F766E] focus:ring-2 focus:ring-[#0F766E]/10 outline-none"
            />
          </div>
        )}

        {/* Botones */}
        <div className="space-y-2 pt-4">
          <button
            onClick={handleSubmit}
            className="w-full h-14 bg-[#0F766E] text-white rounded-xl font-semibold text-base active:scale-[0.98] transition-transform"
          >
            {product ? 'Actualizar Producto' : 'Guardar Producto'}
          </button>
          
          {product && (
            <button
              onClick={handleDelete}
              className="w-full h-14 bg-red-50 text-red-600 rounded-xl font-semibold text-base active:scale-[0.98] transition-transform"
            >
              Eliminar Producto
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
