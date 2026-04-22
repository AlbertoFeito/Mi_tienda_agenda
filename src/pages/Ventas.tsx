import { useState, useMemo, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Search, ShoppingCart, X, Minus, Plus, Check } from 'lucide-react';
import { db, generateReceiptNumber } from '@/lib/db';
import { useApp } from '@/contexts/AppContext';
import type { Product, Currency, PaymentMethod, SaleItem, CartItem } from '@/types';

type ViewState = 'products' | 'checkout' | 'receipt';

export default function Ventas() {
  const { formatPrice, convertToCUP, showToast } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('Todos');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [view, setView] = useState<ViewState>('products');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [selectedCurrency, setSelectedCurrency] = useState<Currency>('CUP');
  const [discount, setDiscount] = useState(0);
  const [lastReceipt, setLastReceipt] = useState('');
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const products = useLiveQuery(() => db.products.toArray(), []);

  const categories = useMemo(() => {
    if (!products) return ['Todos'];
    const cats = new Set(products.map(p => p.category));
    return ['Todos', ...Array.from(cats).sort()];
  }, [products]);

  const filteredProducts = useMemo(() => {
    if (!products) return [];
    return products.filter(p => {
      const matchesSearch = !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = activeCategory === 'Todos' || p.category === activeCategory;
      return matchesSearch && matchesCategory && p.stock > 0;
    });
  }, [products, searchQuery, activeCategory]);

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartTotal = cart.reduce((sum, item) => sum + convertToCUP(item.unitPrice * item.quantity, item.unitCurrency), 0);

  const addToCart = useCallback((product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.productId === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) return prev;
        return prev.map(item =>
          item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, {
        productId: product.id!,
        productName: product.name,
        quantity: 1,
        unitPrice: product.salePrice,
        unitCurrency: product.saleCurrency,
      }];
    });
  }, []);

  const updateQuantity = useCallback((productId: number, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.productId !== productId) return item;
      const newQty = item.quantity + delta;
      return newQty <= 0 ? item : { ...item, quantity: newQty };
    }).filter(item => item.quantity > 0));
  }, []);

  const removeFromCart = useCallback((productId: number) => {
    setCart(prev => prev.filter(item => item.productId !== productId));
  }, []);

  const handleCheckout = useCallback(async () => {
    if (cart.length === 0) return;

    const confirmed = confirm(`¿Confirmar venta?\nTotal: ${formatPrice(finalTotal, 'CUP')}`);
    if (!confirmed) return;

    try {
      const receiptNumber = await generateReceiptNumber();
      const saleItems: SaleItem[] = cart.map(item => ({
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        unitCurrency: item.unitCurrency,
        subtotal: item.unitPrice * item.quantity,
      }));

      const total = cart.reduce((sum, item) => sum + convertToCUP(item.unitPrice * item.quantity, item.unitCurrency), 0) - discount;

      await db.sales.add({
        items: saleItems,
        total: Math.max(0, total),
        currency: selectedCurrency,
        paymentMethod,
        discount,
        createdAt: new Date(),
        receiptNumber,
      });

      for (const item of cart) {
        const product = await db.products.get(item.productId);
        if (product) {
          await db.products.update(item.productId, { stock: product.stock - item.quantity });
        }
      }

      setLastReceipt(receiptNumber);
      setCart([]);
      setCheckoutOpen(false);
      setView('receipt');
      showToast('Venta completada exitosamente', 'success');
    } catch {
      showToast('Error al procesar la venta', 'error');
    }
  }, [cart, paymentMethod, selectedCurrency, discount, convertToCUP, showToast]);

  const finalTotal = Math.max(0, cartTotal - discount);

  if (view === 'receipt') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] animate-fade-in-up">
        <div className="w-20 h-20 rounded-full bg-[#D1FAE5] flex items-center justify-center mb-4 animate-check-bounce">
          <Check size={40} className="text-[#059669]" />
        </div>
        <h2 className="text-xl font-semibold text-[#0F172A] mb-1">Venta completada</h2>
        <p className="text-sm text-[#475569] mb-2">Recibo #{lastReceipt}</p>
        <p className="text-sm text-[#94A3B8] mb-6">{new Date().toLocaleString('es-CU')}</p>
        <button
          onClick={() => { setView('products'); setPaymentMethod('cash'); setDiscount(0); }}
          className="w-full max-w-xs h-12 bg-[#0F766E] text-white rounded-lg font-semibold active:scale-[0.98] transition-transform"
        >
          Nueva Venta
        </button>
      </div>
    );
  }

  return (
    <div className="relative animate-fade-in-up">
      {/* Search */}
      <div className="sticky top-0 z-20 bg-[#F1F5F9] pb-2">
        <div className="relative">
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

        {/* Categories */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar mt-2 pb-1">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                activeCategory === cat ? 'bg-[#0F766E] text-white' : 'bg-white text-[#475569] border border-[#E2E8F0]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Products List */}
      <div className="space-y-2 mt-2 pb-32">
        {filteredProducts.length === 0 ? (
          <div className="text-center py-12">
            <PackageFallback />
            <p className="text-sm text-[#475569] mt-2">No se encontraron productos</p>
          </div>
        ) : (
          filteredProducts.map((product, i) => (
            <div
              key={product.id}
              className="flex items-center gap-2 bg-white rounded-xl px-3 py-2 shadow-sm animate-fade-in-up"
              style={{ animationDelay: `${i * 30}ms`, opacity: 0 }}
            >
              {product.image ? (
                <img src={product.image} alt={product.name} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-[#F1F5F9] flex items-center justify-center flex-shrink-0">
                  <span className="text-sm">📦</span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#0F172A] truncate">{product.name}</p>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#94A3B8]">{product.category}</span>
                  <span className="text-xs text-[#94A3B8]">·</span>
                  <span className="text-xs text-[#94A3B8]">Stock: {product.stock}</span>
                  {product.type === 'consignment' && (
                    <>
                      <span className="text-xs text-[#94A3B8]">·</span>
                      <span className="text-[10px] bg-[#DBEAFE] text-[#1E40AF] px-1 py-0.5 rounded">Ajeno</span>
                    </>
                  )}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-sm font-bold text-[#0F766E]">{formatPrice(product.salePrice, product.saleCurrency)}</p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Cart Bar */}
      {cartCount > 0 && (
        <div className="fixed bottom-20 left-2 right-2 z-[150] animate-slide-up">
          <div className="flex gap-2">
            <button
              onClick={() => {
                if (confirm('¿Desea cancelar la venta?')) {
                  setCart([]);
                }
              }}
              className="flex-1 bg-[#DC2626] text-white rounded-xl py-3 px-2 flex items-center justify-center gap-2 shadow-lg"
            >
              <X size={18} />
              <span className="text-xs font-semibold">Cancelar</span>
            </button>
            <button
              onClick={() => setCheckoutOpen(true)}
              className="flex-1 bg-[#134E4A] text-white rounded-xl py-3 px-2 flex items-center justify-between shadow-lg"
            >
              <div className="flex items-center gap-2">
                <div className="relative">
                  <ShoppingCart size={18} />
                  <span className="absolute -top-2 -right-2 w-4 h-4 bg-[#DC2626] rounded-full text-[9px] font-bold flex items-center justify-center">
                    {cartCount}
                  </span>
                </div>
                <span className="text-xs">{cartCount}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-xs">{formatPrice(cartTotal, 'CUP')}</span>
                <span className="bg-white text-[#134E4A] px-2 py-1 rounded-lg text-xs font-semibold">Procesar</span>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Checkout Bottom Sheet */}
      {checkoutOpen && (
        <div className="fixed inset-0 z-[200]">
          <div className="absolute inset-0 bg-black/40" onClick={() => setCheckoutOpen(false)} />
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl max-h-[85vh] flex flex-col animate-slide-up">
            <div className="flex items-center justify-between p-4 border-b border-[#E2E8F0] flex-shrink-0">
              <h3 className="text-lg font-semibold">Resumen de Venta</h3>
              <button onClick={() => setCheckoutOpen(false)} className="p-1">
                <X size={22} className="text-[#475569]" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {/* Cart Items */}
              <div className="space-y-2">
                {cart.map((item) => (
                  <div key={item.productId} className="flex items-center gap-2 bg-[#F8FAFC] rounded-lg p-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.productName}</p>
                      <p className="text-xs text-[#94A3B8]">{formatPrice(item.unitPrice, item.unitCurrency)} c/u</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => updateQuantity(item.productId, -1)} className="w-7 h-7 rounded-full bg-white border border-[#E2E8F0] flex items-center justify-center active:scale-90">
                        <Minus size={14} />
                      </button>
                      <span className="w-8 text-center text-sm font-semibold">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.productId, 1)} className="w-7 h-7 rounded-full bg-white border border-[#E2E8F0] flex items-center justify-center active:scale-90">
                        <Plus size={14} />
                      </button>
                    </div>
                    <button onClick={() => removeFromCart(item.productId)} className="text-[#DC2626] p-1">
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>

              {/* Payment Method */}
              <div>
                <label className="text-sm font-medium text-[#475569] block mb-2">Método de pago</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['cash', 'transfer', 'installment'] as PaymentMethod[]).map(method => (
                    <button
                      key={method}
                      onClick={() => setPaymentMethod(method)}
                      className={`h-10 rounded-lg text-sm font-medium transition-colors ${
                        paymentMethod === method
                          ? 'bg-[#0F766E] text-white'
                          : 'bg-[#F1F5F9] text-[#475569]'
                      }`}
                    >
                      {method === 'cash' ? 'Efectivo' : method === 'transfer' ? 'Transferencia' : 'A Plazos'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Currency */}
              <div>
                <label className="text-sm font-medium text-[#475569] block mb-2">Moneda</label>
                <div className="grid grid-cols-4 gap-2">
                  {(['CUP', 'USD', 'EUR', 'MLC'] as Currency[]).map(currency => (
                    <button
                      key={currency}
                      onClick={() => setSelectedCurrency(currency)}
                      className={`h-10 rounded-lg text-sm font-bold transition-colors ${
                        selectedCurrency === currency
                          ? 'bg-[#0F766E] text-white'
                          : 'bg-[#F1F5F9] text-[#475569]'
                      }`}
                    >
                      {currency}
                    </button>
                  ))}
                </div>
              </div>

              {/* Discount */}
              <div>
                <label className="text-sm font-medium text-[#475569] block mb-1">Descuento (CUP)</label>
                <input
                  type="number"
                  value={discount || ''}
                  onChange={(e) => setDiscount(Number(e.target.value))}
                  placeholder="0.00"
                  className="w-full h-12 px-3 rounded-lg border border-[#E2E8F0] text-base focus:border-[#0F766E] focus:ring-2 focus:ring-[#0F766E]/10 outline-none"
                />
              </div>

              {/* Totals */}
              <div className="border-t border-[#E2E8F0] pt-3 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-[#475569]">Subtotal</span>
                  <span className="font-medium">{formatPrice(cartTotal, 'CUP')}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-[#475569]">Descuento</span>
                    <span className="font-medium text-[#DC2626]">-{formatPrice(discount, 'CUP')}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-[#475569]">Total</span>
                  <span className="text-[#0F766E] font-bold">{formatPrice(finalTotal, 'CUP')}</span>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-[#E2E8F0] flex-shrink-0">
              <div className="flex gap-2">
                <button
                  onClick={() => setCheckoutOpen(false)}
                  className="flex-1 h-12 bg-[#DC2626] text-white rounded-xl font-semibold text-sm active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
                >
                  <X size={18} />
                  Cancelar
                </button>
                <button
                  onClick={handleCheckout}
                  className="flex-1 h-12 bg-[#059669] text-white rounded-xl font-semibold text-sm active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
                >
                  <Check size={18} />
                  Completar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PackageFallback() {
  return (
    <div className="w-16 h-16 mx-auto rounded-full bg-[#F1F5F9] flex items-center justify-center">
      <span className="text-2xl">📦</span>
    </div>
  );
}
