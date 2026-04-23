import { useState, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Search, X, ShoppingCart, Minus, Plus, Trash2, CreditCard, Banknote, Repeat, ChevronDown, User, Package } from 'lucide-react';
import { db } from '@/lib/db';
import { useApp } from '@/contexts/AppContext';
import type { Product, CartItem, PaymentMethod, Currency } from '@/types';

export default function Ventas() {
  const { formatPrice, convertToCUP, showToast } = useApp();
  
  // Productos
  const products = useLiveQuery(() => db.products.toArray(), []) || [];
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  
  // Carrito
  const [cart, setCart] = useState<CartItem[]>([]);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  
  // Checkout
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [selectedCurrency, setSelectedCurrency] = useState<Currency>('CUP');
  const [discount, setDiscount] = useState(0);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [numberOfPayments, setNumberOfPayments] = useState(2);
  const [installmentFrequency, setInstallmentFrequency] = useState<'weekly' | 'biweekly' | 'monthly'>('weekly');
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  
  const checkoutRef = useRef<HTMLDivElement>(null);
  const customerDropdownRef = useRef<HTMLDivElement>(null);

  const customers = useLiveQuery(() => db.customers.toArray(), []) || [];
  
  const categories = ['Todos', ...Array.from(new Set(products.map(p => p.category)))];
  
  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'Todos' || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  
  const cartTotal = cart.reduce((sum, item) => {
    return sum + convertToCUP(item.unitPrice * item.quantity, item.unitCurrency);
  }, 0);
  
  const finalTotal = Math.max(0, cartTotal - discount);

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(e.target as Node)) {
        setShowCustomerDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Ajustar altura cuando aparece el teclado
  useEffect(() => {
    const handleResize = () => {
      if (checkoutRef.current) {
        const vh = window.innerHeight;
        checkoutRef.current.style.maxHeight = `${vh * 0.85}px`;
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [checkoutOpen]);

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.productId === product.id);
      if (existing) {
        return prev.map(item => 
          item.productId === product.id 
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, {
        productId: product.id!,
        productName: product.name,
        quantity: 1,
        unitPrice: product.salePrice,
        unitCurrency: product.saleCurrency
      }];
    });
  };

  const updateQuantity = (productId: number, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.productId === productId) {
        const newQty = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const removeFromCart = (productId: number) => {
    setCart(prev => prev.filter(item => item.productId !== productId));
  };

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId);

  const handleProcessSale = async () => {
    if (cart.length === 0) return;
    
    try {
      const saleItems = cart.map(item => ({
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        unitCurrency: item.unitCurrency,
        subtotal: convertToCUP(item.unitPrice * item.quantity, item.unitCurrency)
      }));

      const receiptNumber = await db.transaction('rw', db.sales, db.products, db.installments, async () => {
        const receipt = await generateReceiptNumber();
        
        const saleId = await db.sales.add({
          items: saleItems,
          total: finalTotal,
          currency: selectedCurrency,
          paymentMethod,
          customerId: selectedCustomerId || undefined,
          customerName: selectedCustomer?.name,
          discount,
          createdAt: new Date(),
          receiptNumber: receipt
        });

        // Actualizar stock
        for (const item of cart) {
          const product = await db.products.get(item.productId);
          if (product) {
            await db.products.update(item.productId, {
              stock: Math.max(0, product.stock - item.quantity),
              updatedAt: new Date()
            });
          }
        }

        // Si es a plazos, crear installment
        if (paymentMethod === 'installment' && selectedCustomerId) {
          await db.installments.add({
            saleId: saleId as number,
            customerId: selectedCustomerId,
            customerName: selectedCustomer!.name,
            totalAmount: finalTotal,
            paidAmount: 0,
            remainingAmount: finalTotal,
            numberOfPayments,
            frequency: installmentFrequency,
            startDate: new Date(),
            status: 'active',
            createdAt: new Date()
          });
        }

        return receipt;
      });

      showToast(`Venta procesada: ${receiptNumber}`, 'success');
      setCart([]);
      setCheckoutOpen(false);
      setDiscount(0);
      setSelectedCustomerId(null);
      setPaymentMethod('cash');
    } catch (error) {
      showToast('Error al procesar la venta', 'error');
      console.error(error);
    }
  };

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
    (c.phone && c.phone.includes(customerSearch))
  );

  return (
    <div className="flex flex-col h-full bg-[#F8FAFC]">
      {/* Header de búsqueda */}
      <div className="px-4 pt-4 pb-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar productos..."
            className="w-full h-12 pl-10 pr-10 rounded-xl border border-[#E2E8F0] bg-white text-base focus:border-[#0F766E] focus:ring-2 focus:ring-[#0F766E]/10 outline-none"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          )}
        </div>
      </div>

      {/* Categorías */}
      <div className="px-4 py-2">
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                selectedCategory === cat
                  ? 'bg-[#0F766E] text-white'
                  : 'bg-white text-gray-600 border border-[#E2E8F0]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Lista de productos */}
      <div className="flex-1 overflow-y-auto px-4 pb-24">
        {filteredProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <Package className="w-12 h-12 mb-3" />
            <p>No se encontraron productos</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredProducts.map((product, i) => (
              <button
                key={product.id}
                onClick={() => addToCart(product)}
                className="w-full flex items-center gap-3 bg-white rounded-xl p-3 shadow-sm text-left active:bg-[#F1F5F9] transition-colors"
                style={{ animationDelay: `${i * 30}ms` }}
              >
                {product.image ? (
                  <img src={product.image} alt={product.name} className="w-14 h-14 rounded-lg object-cover" />
                ) : (
                  <div className="w-14 h-14 rounded-lg bg-gray-100 flex items-center justify-center text-2xl">
                    📦
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{product.name}</p>
                  <p className="text-sm text-gray-500">
                    {product.category} · Stock: {product.stock}
                    {product.type === 'consignment' && ' · Ajeno'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-[#0F766E]">
                    {formatPrice(product.salePrice, product.saleCurrency)}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Barra del carrito */}
      {cartCount > 0 && (
        <button
          onClick={() => setCheckoutOpen(true)}
          className="fixed bottom-20 left-4 right-4 bg-[#0F766E] text-white h-14 rounded-xl flex items-center justify-center gap-2 shadow-lg z-40"
        >
          <ShoppingCart className="w-5 h-5" />
          <span className="font-medium">{cartCount} productos</span>
          <span className="mx-2">·</span>
          <span>{formatPrice(cartTotal, 'CUP')}</span>
        </button>
      )}

      {/* Checkout Bottom Sheet */}
      {checkoutOpen && (
        <>
          {/* Overlay */}
          <div 
            className="fixed inset-0 bg-black/50 z-50"
            onClick={() => setCheckoutOpen(false)}
          />
          
          {/* Sheet */}
          <div 
            ref={checkoutRef}
            className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl z-50 flex flex-col"
            style={{ maxHeight: '85vh' }}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>
            
            {/* Header */}
            <div className="px-5 pb-3 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">Resumen de Venta</h2>
              <p className="text-sm text-gray-500">{cartCount} productos</p>
            </div>

            {/* Contenido scrolleable */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {/* Items del carrito */}
              <div className="space-y-3">
                {cart.map((item) => (
                  <div key={item.productId} className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{item.productName}</p>
                      <p className="text-sm text-gray-500">
                        {formatPrice(item.unitPrice, item.unitCurrency)} c/u
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => updateQuantity(item.productId, -1)}
                        className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="w-8 text-center font-medium">{item.quantity}</span>
                      <button 
                        onClick={() => updateQuantity(item.productId, 1)}
                        className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => removeFromCart(item.productId)}
                        className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center ml-1"
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Método de pago */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Método de pago</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['cash', 'transfer', 'installment'] as PaymentMethod[]).map(method => (
                    <button
                      key={method}
                      onClick={() => setPaymentMethod(method)}
                      className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all ${
                        paymentMethod === method
                          ? 'border-[#0F766E] bg-[#0F766E]/5 text-[#0F766E]'
                          : 'border-gray-200 text-gray-600'
                      }`}
                    >
                      {method === 'cash' && <Banknote className="w-6 h-6" />}
                      {method === 'transfer' && <CreditCard className="w-6 h-6" />}
                      {method === 'installment' && <Repeat className="w-6 h-6" />}
                      <span className="text-xs font-medium">
                        {method === 'cash' ? 'Efectivo' : method === 'transfer' ? 'Transferencia' : 'A plazos'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Cliente para plazos */}
              {paymentMethod === 'installment' && (
                <div className="space-y-3" ref={customerDropdownRef}>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Cliente *</label>
                    <div className="relative">
                      <button
                        onClick={() => setShowCustomerDropdown(!showCustomerDropdown)}
                        className="w-full h-12 px-3 rounded-xl border border-[#E2E8F0] bg-white text-left flex items-center justify-between"
                      >
                        <span className={selectedCustomer ? 'text-gray-900' : 'text-gray-400'}>
                          {selectedCustomer ? selectedCustomer.name : 'Seleccionar cliente...'}
                        </span>
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      </button>
                      
                      {showCustomerDropdown && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 max-h-48 overflow-y-auto">
                          <div className="p-2">
                            <input
                              type="text"
                              value={customerSearch}
                              onChange={(e) => setCustomerSearch(e.target.value)}
                              placeholder="Buscar cliente..."
                              className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm"
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                          {filteredCustomers.length === 0 ? (
                            <p className="px-3 py-2 text-sm text-gray-400">No hay clientes</p>
                          ) : (
                            filteredCustomers.map(c => (
                              <button
                                key={c.id}
                                onClick={() => {
                                  setSelectedCustomerId(c.id!);
                                  setShowCustomerDropdown(false);
                                  setCustomerSearch('');
                                }}
                                className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-2"
                              >
                                <User className="w-4 h-4 text-gray-400" />
                                <div>
                                  <p className="text-sm font-medium">{c.name}</p>
                                  {c.phone && <p className="text-xs text-gray-400">{c.phone}</p>}
                                </div>
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                    {!selectedCustomerId && (
                      <p className="text-xs text-red-500 mt-1">Seleccione un cliente para venta a plazos</p>
                    )}
                  </div>

                  {selectedCustomer && (
                    <div className="bg-[#F0FDFA] rounded-xl p-3 space-y-2">
                      <p className="text-sm font-medium text-[#0F766E]">
                        Valor por cuota: {formatPrice(finalTotal / numberOfPayments, selectedCurrency)}
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setInstallmentFrequency('weekly')}
                          className={`flex-1 py-2 rounded-lg text-xs font-medium ${
                            installmentFrequency === 'weekly' ? 'bg-[#0F766E] text-white' : 'bg-white text-gray-600'
                          }`}
                        >
                          Semanal
                        </button>
                        <button
                          onClick={() => setInstallmentFrequency('biweekly')}
                          className={`flex-1 py-2 rounded-lg text-xs font-medium ${
                            installmentFrequency === 'biweekly' ? 'bg-[#0F766E] text-white' : 'bg-white text-gray-600'
                          }`}
                        >
                          Quincenal
                        </button>
                        <button
                          onClick={() => setInstallmentFrequency('monthly')}
                          className={`flex-1 py-2 rounded-lg text-xs font-medium ${
                            installmentFrequency === 'monthly' ? 'bg-[#0F766E] text-white' : 'bg-white text-gray-600'
                          }`}
                        >
                          Mensual
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600">Cuotas:</span>
                        <button onClick={() => setNumberOfPayments(Math.max(2, numberOfPayments - 1))} className="w-8 h-8 rounded-lg bg-white border flex items-center justify-center">
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="w-8 text-center font-medium">{numberOfPayments}</span>
                        <button onClick={() => setNumberOfPayments(numberOfPayments + 1)} className="w-8 h-8 rounded-lg bg-white border flex items-center justify-center">
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Moneda */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Moneda</label>
                <div className="grid grid-cols-4 gap-2">
                  {(['CUP', 'USD', 'EUR', 'MLC'] as Currency[]).map(currency => (
                    <button
                      key={currency}
                      onClick={() => setSelectedCurrency(currency)}
                      className={`py-2 rounded-xl border-2 text-sm font-medium transition-all ${
                        selectedCurrency === currency
                          ? 'border-[#0F766E] bg-[#0F766E]/5 text-[#0F766E]'
                          : 'border-gray-200 text-gray-600'
                      }`}
                    >
                      {currency}
                    </button>
                  ))}
                </div>
              </div>

              {/* Descuento */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descuento (CUP)</label>
                <input
                  type="number"
                  value={discount || ''}
                  onChange={(e) => setDiscount(Number(e.target.value))}
                  placeholder="0.00"
                  className="w-full h-12 px-3 rounded-xl border border-[#E2E8F0] text-base focus:border-[#0F766E] focus:ring-2 focus:ring-[#0F766E]/10 outline-none"
                />
              </div>

              {/* Totales */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-medium">{formatPrice(cartTotal, 'CUP')}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Descuento</span>
                    <span className="font-medium text-red-500">-{formatPrice(discount, 'CUP')}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold pt-2 border-t border-gray-200">
                  <span>Total</span>
                  <span className="text-[#0F766E]">{formatPrice(finalTotal, 'CUP')}</span>
                </div>
              </div>
            </div>

            {/* Botón procesar (fijo abajo) */}
            <div className="px-5 py-4 border-t border-gray-100 bg-white">
              <button
                onClick={handleProcessSale}
                disabled={cart.length === 0 || (paymentMethod === 'installment' && !selectedCustomerId)}
                className="w-full h-14 bg-[#0F766E] text-white rounded-xl font-medium text-lg disabled:opacity-50 disabled:cursor-not-allowed active:bg-[#0D5C56] transition-colors"
              >
                Procesar Venta
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Función auxiliar para generar número de recibo
async function generateReceiptNumber(): Promise<string> {
  const today = new Date();
  const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
  const count = await db.sales.where('createdAt').between(
    new Date(today.getFullYear(), today.getMonth(), today.getDate()),
    new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)
  ).count();
  return `VT-${dateStr}-${String(count + 1).padStart(3, '0')}`;
}
