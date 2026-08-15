import { useState, useMemo } from 'react';
import { useLiveQuery } from '@/lib/live';
import { Search, Plus, X, Package, Camera } from 'lucide-react';
import { db } from '@/lib/db';
import { pickProductImage } from '@/lib/camera';
import { useBackHandler } from '@/lib/backHandler';
import NumberField from '@/components/NumberField';
import HelpButton from '@/components/HelpButton';
import { moneyClass } from '@/lib/format';
import ConfirmDialog from '@/components/ConfirmDialog';
import StockMovements from '@/components/StockMovements';
import { recordEntry, recordInitialStock, recordLoss } from '@/lib/stock';
import ImageViewer from '@/components/ImageViewer';
import { useApp } from '@/contexts/AppContext';
import type { Product, ProductType, Currency } from '@/types';

type ViewState = 'list' | 'form';
type ProductFilter = 'all' | 'own' | 'consignment' | 'lowstock';

export default function Productos() {
  const { formatPrice } = useApp();
  const [view, setView] = useState<ViewState>('list');
  const [filter, setFilter] = useState<ProductFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [viewerImage, setViewerImage] = useState<string | null>(null);

  const products = useLiveQuery(() => db.products.toArray(), []) || [];

  const filteredProducts = useMemo(() => {
    let result = [...products];
    if (filter === 'own') result = result.filter(p => p.type === 'own');
    if (filter === 'consignment') result = result.filter(p => p.type === 'consignment');
    if (filter === 'lowstock') result = result.filter(p => p.stock <= p.minStock);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.brand || '').toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
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
              <div
                key={product.id}
                className="w-full bg-white rounded-xl p-4 shadow-sm flex items-start gap-3"
                style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }}
              >
                {product.image ? (
                  <img
                    src={product.image}
                    alt={product.name}
                    onClick={() => setViewerImage(product.image!)}
                    className="w-16 h-16 rounded-xl object-cover flex-shrink-0 cursor-zoom-in active:opacity-80"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-gray-100 flex items-center justify-center text-2xl flex-shrink-0">
                    📦
                  </div>
                )}
                <button onClick={() => openForm(product)} className="flex-1 min-w-0 text-left active:opacity-70">
                  <div className="flex items-start justify-between gap-2">
                    {/* min-w-0 deja que el nombre se recorte; sin él, esta
                        columna no cede y empuja el precio fuera de la tarjeta. */}
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-900 truncate">{product.name}</p>
                      {product.brand && (
                        <p className="text-xs text-gray-500 truncate">{product.brand}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                          product.type === 'own' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                        }`}>
                          {product.type === 'own' ? 'Propio' : 'Ajeno'}
                        </span>
                        <span className="text-xs text-gray-500 truncate">{product.category}</span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 max-w-[55%]">
                      <p className={`font-semibold text-[#0F766E] ${moneyClass(formatPrice(product.salePrice, product.saleCurrency))}`}>
                        {formatPrice(product.salePrice, product.saleCurrency)}
                      </p>
                      <p className={`text-xs font-medium tabular-nums ${
                        product.stock <= 0 ? 'text-red-500' :
                        product.stock <= product.minStock ? 'text-orange-500' : 'text-gray-500'
                      }`}>
                        Stock: {product.stock.toLocaleString('es-CU')}
                      </p>
                    </div>
                  </div>
                  {product.stock <= 0 && (
                    <p className="text-xs text-red-500 mt-1 font-medium">Sin stock disponible</p>
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {viewerImage && <ImageViewer src={viewerImage} onClose={() => setViewerImage(null)} />}
    </div>
  );
}

function ProductForm({ product, onBack }: { product: Product | null; onBack: () => void }) {
  const { formatPrice, showToast, convertToCUP } = useApp();
  const dbOwners = useLiveQuery(() => db.owners.toArray(), []) || [];
  const ownerSuggestions =
    useLiveQuery(
      () =>
        db.products.toArray().then((ps) =>
          Array.from(
            new Set(
              ps
                .filter((p) => p.type === 'consignment' && p.ownerName?.trim())
                .map((p) => p.ownerName!.trim()),
            ),
          ),
        ),
      [],
    ) || [];
  const [name, setName] = useState(product?.name || '');
  const [brand, setBrand] = useState(product?.brand || '');
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
  const [showViewer, setShowViewer] = useState(false);
  const [ownerName, setOwnerName] = useState(product?.ownerName || '');
  const [ownerContact, setOwnerContact] = useState(product?.ownerContact || '');
  const [confirmDelete, setConfirmDelete] = useState(false);

  useBackHandler(onBack);

  const categories = useMemo(() => {
    const all = new Set<string>();
    ['Comida', 'Bebida', 'Limpieza', 'Higiene', 'Otro'].forEach(c => all.add(c));
    return Array.from(all);
  }, []);

  const handlePickImage = async () => {
    try {
      const img = await pickProductImage();
      if (img) setImage(img);
    } catch {
      showToast('No se pudo obtener la imagen', 'error');
    }
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
      brand: brand.trim() || undefined,
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
        // Corregir la existencia a mano también tiene que dejar rastro, o los
        // lotes y el stock dejan de contar lo mismo.
        const diff = stock - product.stock;
        if (diff > 0) {
          await recordEntry({
            productId: product.id,
            quantity: diff,
            unitCost: costPrice,
            unitCurrency: costCurrency,
            toCUP: convertToCUP,
            notes: 'Ajuste de existencia',
            skipStock: true,
          });
        } else if (diff < 0) {
          await recordLoss({
            productId: product.id,
            quantity: -diff,
            reason: 'Ajuste de existencia',
            toCUP: convertToCUP,
          });
          await db.products.update(product.id, { stock });
        }
        showToast('Producto actualizado', 'success');
      } else {
        const newId = await db.products.add(data);
        // La existencia inicial abre su lote, con el costo del día de hoy: sin
        // él esas unidades no tendrían precio propio y, peor, una entrada
        // posterior se vendería antes que ellas.
        if (stock > 0) {
          await recordInitialStock({ productId: newId, quantity: stock, toCUP: convertToCUP });
        }
        showToast('Producto agregado', 'success');
      }
      onBack();
    } catch {
      showToast('Error al guardar', 'error');
    }
  };

  const handleDelete = async () => {
    if (!product?.id) return;
    setConfirmDelete(false);
    try {
      await db.products.delete(product.id);
      showToast('Producto eliminado', 'success');
      onBack();
    } catch {
      showToast('Error al eliminar', 'error');
    }
  };

  // The registered owner behind the selected name, when there is one.
  const registeredOwner = dbOwners.find((o) => o.name === ownerName) || null;

  // Live profit in the official currency (CUP) for any product type.
  const costInCUP = convertToCUP(costPrice, costCurrency);
  const profitPerUnitCUP = convertToCUP(salePrice, saleCurrency) - costInCUP;
  const marginPercent = costInCUP > 0 ? Math.round((profitPerUnitCUP / costInCUP) * 100) : 0;

  return (
    <div className="animate-fade-in-up">
      <div className="flex items-center gap-2 mb-4 px-4 pt-4">
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
        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={() => (image ? setShowViewer(true) : handlePickImage())}
            className="w-24 h-24 rounded-xl bg-gray-100 flex items-center justify-center cursor-pointer overflow-hidden border-2 border-dashed border-gray-300 active:border-[#0F766E]"
          >
            {image ? (
              <img src={image} alt="Preview" className="w-full h-full object-cover" />
            ) : (
              <Camera className="w-8 h-8 text-gray-400" />
            )}
          </button>
          {image && (
            <div className="flex items-center gap-5">
              <button type="button" onClick={handlePickImage} className="text-xs font-medium text-[#0F766E] active:opacity-70">
                Cambiar
              </button>
              <button type="button" onClick={() => setImage(undefined)} className="text-xs font-medium text-[#DC2626] active:opacity-70">
                Quitar
              </button>
            </div>
          )}
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

        {/* Marca */}
        <div>
          <label className="text-sm font-medium text-[#475569] block mb-1">Marca</label>
          <input
            type="text"
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            placeholder="Para distinguir dos productos con el mismo nombre"
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
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-sm font-medium text-[#475569]">Precio de Costo *</label>
            <select
              value={costCurrency}
              onChange={(e) => setCostCurrency(e.target.value as Currency)}
              className="h-8 px-2 rounded-lg border border-[#E2E8F0] text-sm focus:border-[#0F766E] outline-none bg-white"
            >
              {(['CUP', 'USD', 'EUR', 'MLC'] as Currency[]).map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <NumberField value={costPrice} onChange={setCostPrice} decimals placeholder="0.00" />
        </div>

        {/* Precio de Venta */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-sm font-medium text-[#475569]">Precio de Venta *</label>
            <select
              value={saleCurrency}
              onChange={(e) => setSaleCurrency(e.target.value as Currency)}
              className="h-8 px-2 rounded-lg border border-[#E2E8F0] text-sm focus:border-[#0F766E] outline-none bg-white"
            >
              {(['CUP', 'USD', 'EUR', 'MLC'] as Currency[]).map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <NumberField value={salePrice} onChange={setSalePrice} decimals placeholder="0.00" />
        </div>

        {/* Ganancia por unidad (todo tipo de producto) */}
        {costPrice > 0 && salePrice > 0 && (
          <div className="flex items-center justify-between bg-[#F0FDFA] rounded-xl px-3 py-2.5">
            <span className="text-sm text-[#475569]">Ganancia por unidad</span>
            <span className={`text-sm font-bold ${profitPerUnitCUP >= 0 ? 'text-[#059669]' : 'text-red-500'}`}>
              {formatPrice(profitPerUnitCUP, 'CUP')}
              {costInCUP > 0 && <span className="text-xs font-normal text-[#94A3B8]"> ({marginPercent}%)</span>}
            </span>
          </div>
        )}

        {/* Stock */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-sm font-medium text-[#475569] block mb-1">Stock *</label>
            <NumberField value={stock} onChange={setStock} placeholder="0" />
          </div>
          <div>
            <label className="text-sm font-medium text-[#475569] block mb-1">Stock Mínimo</label>
            <NumberField value={minStock} onChange={setMinStock} placeholder="5" />
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
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-[#475569]">Datos del dueño</p>
              <HelpButton topicId="ajenos" label="Cómo funciona" />
            </div>
            <select
              value={ownerName}
              onChange={(e) => {
                setOwnerName(e.target.value);
                const selected = dbOwners.find((o) => o.name === e.target.value);
                setOwnerContact(selected?.phone || '');
              }}
              className="w-full h-12 px-3 rounded-lg border border-[#E2E8F0] text-base focus:border-[#0F766E] focus:ring-2 focus:ring-[#0F766E]/10 outline-none bg-white"
            >
              <option value="">Seleccionar dueño...</option>
              {[...new Set([...dbOwners.map((o) => o.name), ...ownerSuggestions])].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            {registeredOwner ? (
              <p className="text-xs text-[#475569] px-3 py-2 bg-[#F0FDFA] rounded-lg">
                Contacto: {registeredOwner.phone ? `+53 ${registeredOwner.phone}` : 'sin teléfono guardado'}
              </p>
            ) : (
              <input
                type="text"
                value={ownerContact}
                onChange={(e) => setOwnerContact(e.target.value)}
                placeholder="Contacto del dueño"
                className="w-full h-12 px-3 rounded-lg border border-[#E2E8F0] text-base focus:border-[#0F766E] focus:ring-2 focus:ring-[#0F766E]/10 outline-none"
              />
            )}
            <p className="text-xs text-[#94A3B8]">
              Los dueños se crean y editan en la pestaña “Dueños”.
            </p>
          </div>
        )}

        {/* Entradas y mermas: solo tienen sentido sobre un producto ya guardado. */}
        {product?.id && <StockMovements product={product} onStockChange={setStock} />}

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
              onClick={() => setConfirmDelete(true)}
              className="w-full h-14 bg-red-50 text-red-600 rounded-xl font-semibold text-base active:scale-[0.98] transition-transform"
            >
              Eliminar Producto
            </button>
          )}
        </div>
      </div>

      {showViewer && image && <ImageViewer src={image} onClose={() => setShowViewer(false)} />}

      {confirmDelete && (
        <ConfirmDialog
          title="¿Eliminar este producto?"
          message={`"${name || 'Sin nombre'}" desaparecerá de la lista. Las ventas ya hechas no cambian.`}
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
}
