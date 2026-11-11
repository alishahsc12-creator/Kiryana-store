import React, { useMemo, useRef, useState } from 'react';
import {
  Barcode,
  CheckCircle2,
  Clock,
  Minus,
  PauseCircle,
  Play,
  Plus,
  Printer,
  Search,
  ShoppingCart,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { useBarcodeScanner } from '../hooks/useBarcodeScanner';
import type { CartItem, HeldBill, PaymentMethod, Product, Sale } from '../types/pos';
import { formatPKTime, formatRs, playCounterBeep } from '../utils/formatters';
import { ProductImage } from './ProductImage';
import { ReceiptModal } from './ReceiptModal';

export const PosCounterView: React.FC = () => {
  const {
    db,
    activeUser,
    completeSale,
    holdBill,
    deleteHeldBill,
    updateSettings,
  } = useStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discountType, setDiscountType] = useState<'flat' | 'percent'>('flat');
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [taxEnabled, setTaxEnabled] = useState<boolean>(db.settings.defaultTaxEnabled);
  const [taxRate, setTaxRate] = useState<number>(db.settings.defaultTaxRate || 0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [amountReceivedInput, setAmountReceivedInput] = useState<string>('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [billNotes, setBillNotes] = useState<string>('');

  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [activeReceipt, setActiveReceipt] = useState<Sale | null>(null);
  const [lastCompletedSale, setLastCompletedSale] = useState<Sale | null>(null);
  const [showHeldModal, setShowHeldModal] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);

  const categories = useMemo(() => {
    const unique = Array.from(new Set(db.products.map((p) => p.category)));
    return ['All', ...unique];
  }, [db.products]);

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return db.products.filter((p) => {
      const catMatch = selectedCategory === 'All' || p.category === selectedCategory;
      if (!catMatch) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.urduName && p.urduName.toLowerCase().includes(q)) ||
        p.barcode.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
      );
    });
  }, [db.products, searchQuery, selectedCategory]);

  const showToast = (type: 'ok' | 'err', text: string) => {
    setFeedback({ type, text });
    window.setTimeout(() => {
      setFeedback((prev) => (prev?.text === text ? null : prev));
    }, 3200);
  };

  const addProductToCart = (product: Product) => {
    if (product.stock <= 0) {
      if (db.settings.soundBeepEnabled) playCounterBeep('error');
      showToast('err', `${product.name} is out of stock.`);
      return;
    }

    setCart((prev) => {
      const existing = prev.find((i) => i.productId === product.id);
      if (existing) {
        if (existing.qty + 1 > product.stock) {
          if (db.settings.soundBeepEnabled) playCounterBeep('error');
          showToast('err', `Only ${product.stock} units of ${product.name} in stock.`);
          return prev;
        }
        if (db.settings.soundBeepEnabled) playCounterBeep('scan');
        return prev.map((i) =>
          i.productId === product.id ? { ...i, qty: i.qty + 1 } : i
        );
      }
      if (db.settings.soundBeepEnabled) playCounterBeep('scan');
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          barcode: product.barcode,
          unit: product.unit,
          purchasePrice: product.purchasePrice,
          salePrice: product.salePrice,
          qty: 1,
          discount: 0,
          imageKey: product.imageKey,
        },
      ];
    });
  };

  const handleBarcodeLookup = (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return;
    const match = db.products.find(
      (p) => p.barcode.toLowerCase() === trimmed.toLowerCase()
    );
    if (match) {
      addProductToCart(match);
      setSearchQuery('');
      showToast('ok', `Scanned: ${match.name}`);
    } else {
      if (db.settings.soundBeepEnabled) playCounterBeep('error');
      showToast('err', `Barcode "${trimmed}" not found in inventory.`);
    }
  };

  useBarcodeScanner({
    enabled: !activeReceipt && !showHeldModal,
    onScan: handleBarcodeLookup,
  });

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      e.preventDefault();
      const exactBarcode = db.products.find(
        (p) => p.barcode.toLowerCase() === searchQuery.trim().toLowerCase()
      );
      if (exactBarcode) {
        addProductToCart(exactBarcode);
        setSearchQuery('');
        return;
      }
      if (filteredProducts.length === 1) {
        addProductToCart(filteredProducts[0]);
        setSearchQuery('');
      }
    }
  };

  const updateCartQty = (productId: string, nextQty: number) => {
    const product = db.products.find((p) => p.id === productId);
    if (nextQty <= 0) {
      setCart((prev) => prev.filter((i) => i.productId !== productId));
      return;
    }
    if (product && nextQty > product.stock) {
      showToast('err', `Max stock available for ${product.name}: ${product.stock}`);
      return;
    }
    setCart((prev) =>
      prev.map((i) => (i.productId === productId ? { ...i, qty: nextQty } : i))
    );
  };

  const updateCartItemDiscount = (productId: string, discount: number) => {
    setCart((prev) =>
      prev.map((i) =>
        i.productId === productId
          ? { ...i, discount: Math.max(0, Math.min(i.salePrice * i.qty, discount || 0)) }
          : i
      )
    );
  };

  const removeCartItem = (productId: string) => {
    setCart((prev) => prev.filter((i) => i.productId !== productId));
  };

  // Totals calculation
  const subtotal = useMemo(
    () =>
      cart.reduce(
        (sum, item) => sum + Math.max(0, item.salePrice * item.qty - (item.discount || 0)),
        0
      ),
    [cart]
  );

  const billDiscountAmount = useMemo(() => {
    const raw =
      discountType === 'percent'
        ? (subtotal * Math.max(0, Math.min(100, discountValue || 0))) / 100
        : Math.max(0, discountValue || 0);
    return Math.min(subtotal, Math.round(raw * 100) / 100);
  }, [subtotal, discountType, discountValue]);

  const taxableTotal = Math.max(0, subtotal - billDiscountAmount);
  const taxAmount = taxEnabled
    ? Math.round(((taxableTotal * Math.max(0, taxRate || 0)) / 100) * 100) / 100
    : 0;
  const grandTotal = Math.round((taxableTotal + taxAmount) * 100) / 100;
  const totalCost = cart.reduce((sum, i) => sum + i.purchasePrice * i.qty, 0);
  const estimatedProfit = Math.round((taxableTotal - totalCost) * 100) / 100;

  const parsedReceived =
    amountReceivedInput.trim() === ''
      ? paymentMethod === 'Udhar (Credit)'
        ? 0
        : grandTotal
      : Number(amountReceivedInput) || 0;

  const returnBalance =
    paymentMethod === 'Cash' ? Math.max(0, Math.round((parsedReceived - grandTotal) * 100) / 100) : 0;

  const resetCartState = () => {
    setCart([]);
    setDiscountValue(0);
    setDiscountType('flat');
    setTaxEnabled(db.settings.defaultTaxEnabled);
    setTaxRate(db.settings.defaultTaxRate || 0);
    setPaymentMethod('Cash');
    setAmountReceivedInput('');
    setSelectedCustomerId('');
    setBillNotes('');
    searchInputRef.current?.focus();
  };

  const handleCheckout = (shouldPrintModal: boolean) => {
    if (cart.length === 0) {
      showToast('err', 'Add at least one product to generate a bill.');
      return;
    }

    const received =
      paymentMethod === 'Cash'
        ? amountReceivedInput.trim() === ''
          ? grandTotal
          : parsedReceived
        : paymentMethod === 'Udhar (Credit)'
        ? Number(amountReceivedInput) || 0
        : grandTotal;

    const result = completeSale({
      items: cart,
      discountType,
      discountValue,
      taxEnabled,
      taxRate,
      paymentMethod,
      amountReceived: received,
      customerId: selectedCustomerId || undefined,
      notes: billNotes || undefined,
    });

    if (!result.ok || !result.sale) {
      if (db.settings.soundBeepEnabled) playCounterBeep('error');
      showToast('err', result.error || 'Could not complete bill.');
      return;
    }

    if (db.settings.soundBeepEnabled) playCounterBeep('success');
    setLastCompletedSale(result.sale);
    resetCartState();
    showToast('ok', `Saved Invoice ${result.sale.invoiceNo} (${formatRs(result.sale.grandTotal)})`);
    if (shouldPrintModal) {
      setActiveReceipt(result.sale);
    }
  };

  const handleHoldBill = () => {
    if (cart.length === 0) {
      showToast('err', 'Cart is empty — nothing to hold.');
      return;
    }
    const customer = db.customers.find((c) => c.id === selectedCustomerId);
    const label = customer
      ? `${customer.name} (${cart.length} items)`
      : `Walk-in Bill · ${formatRs(grandTotal)}`;
    holdBill({
      label,
      items: cart,
      discountType,
      discountValue,
      taxEnabled,
      taxRate,
      customerId: selectedCustomerId || undefined,
      notes: billNotes || undefined,
    });
    resetCartState();
    showToast('ok', `Bill put on hold: ${label}`);
  };

  const handleResumeHeldBill = (held: HeldBill) => {
    setCart(held.items);
    setDiscountType(held.discountType);
    setDiscountValue(held.discountValue);
    setTaxEnabled(held.taxEnabled);
    setTaxRate(held.taxRate);
    setSelectedCustomerId(held.customerId || '');
    setBillNotes(held.notes || '');
    deleteHeldBill(held.id);
    setShowHeldModal(false);
    showToast('ok', `Resumed held bill: ${held.label}`);
  };

  return (
    <div className="flex flex-col lg:flex-row gap-5 h-full min-h-[calc(100vh-116px)]">
      {/* Left Column: Search, Barcode & Product Catalog */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Search & Scanner Bar */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 mb-4">
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                ref={searchInputRef}
                data-barcode-input="true"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Scan barcode or search product name, Urdu name, category..."
                className="w-full pl-10 pr-24 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-500 hover:text-slate-800 px-2 py-1"
                >
                  Clear
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <div className="relative">
                <select
                  aria-label="Simulate USB Barcode Scan"
                  value=""
                  onChange={(e) => {
                    if (e.target.value) handleBarcodeLookup(e.target.value);
                  }}
                  className="pl-8 pr-3 py-2.5 text-xs font-medium bg-slate-50 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                >
                  <option value="">Quick Scan Barcode...</option>
                  {db.products.slice(0, 10).map((p) => (
                    <option key={p.id} value={p.barcode}>
                      {p.barcode} · {p.name}
                    </option>
                  ))}
                </select>
                <Barcode className="w-4 h-4 text-emerald-700 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              <button
                type="button"
                onClick={() =>
                  updateSettings({ soundBeepEnabled: !db.settings.soundBeepEnabled })
                }
                title={
                  db.settings.soundBeepEnabled ? 'Mute scanner beep' : 'Enable scanner beep'
                }
                className="p-2.5 border border-slate-300 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors"
              >
                {db.settings.soundBeepEnabled ? (
                  <Volume2 className="w-4 h-4 text-emerald-700" />
                ) : (
                  <VolumeX className="w-4 h-4 text-slate-400" />
                )}
              </button>
            </div>
          </div>

          {/* Category Filter Tabs */}
          <div className="flex items-center gap-1.5 mt-3 overflow-x-auto pb-1">
            {categories.map((cat) => {
              const active = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-emerald-700 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>

        {/* Toast Feedback Banner */}
        {feedback && (
          <div
            className={`mb-3 px-4 py-2.5 rounded-lg border text-xs font-medium flex items-center justify-between ${
              feedback.type === 'ok'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-red-50 border-red-200 text-red-800'
            }`}
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{feedback.text}</span>
            </div>
            {lastCompletedSale && feedback.type === 'ok' && (
              <button
                type="button"
                onClick={() => setActiveReceipt(lastCompletedSale)}
                className="text-xs font-semibold underline hover:no-underline ml-3 whitespace-nowrap"
              >
                Reprint Receipt
              </button>
            )}
          </div>
        )}

        {/* Product Grid */}
        {filteredProducts.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-10 text-center flex-1 flex flex-col items-center justify-center">
            <Search className="w-8 h-8 text-slate-300 mb-2" />
            <p className="text-sm font-semibold text-slate-800">No matching products found</p>
            <p className="text-xs text-slate-500 mt-1">
              Clear the search bar or switch category to view available kiryana stock.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('All');
              }}
              className="mt-4 px-4 py-2 text-xs font-semibold bg-emerald-700 text-white rounded-lg hover:bg-emerald-800"
            >
              Show All Products
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3.5 overflow-y-auto pr-0.5 pb-4">
            {filteredProducts.map((product) => {
              const isOut = product.stock <= 0;
              const isLow = product.stock > 0 && product.stock <= product.minStockAlert;
              const inCart = cart.find((c) => c.productId === product.id);
              return (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => addProductToCart(product)}
                  className={`group text-left bg-white border rounded-xl overflow-hidden transition-colors flex flex-col ${
                    isOut
                      ? 'border-red-200 opacity-70 cursor-not-allowed'
                      : inCart
                      ? 'border-emerald-600 ring-1 ring-emerald-600'
                      : 'border-slate-200 hover:border-emerald-500'
                  }`}
                >
                  <div className="relative aspect-[4/3] w-full bg-slate-50 overflow-hidden border-b border-slate-100">
                    <ProductImage
                      imageKey={product.imageKey}
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-200"
                    />
                    {inCart && (
                      <div className="absolute top-2 right-2 bg-emerald-700 text-white text-[11px] font-mono-num font-bold px-2 py-0.5 rounded-md shadow-sm">
                        {inCart.qty} in bill
                      </div>
                    )}
                  </div>
                  <div className="p-3 flex-1 flex flex-col justify-between gap-2">
                    <div>
                      <div className="text-xs text-slate-500 truncate">
                        {product.category} · {product.unit}
                      </div>
                      <div className="text-sm font-semibold text-slate-900 leading-snug mt-0.5 line-clamp-2">
                        {product.name}
                      </div>
                    </div>
                    <div className="pt-1 border-t border-slate-100 flex items-end justify-between gap-2">
                      <div className="text-base font-bold font-mono-num text-emerald-800">
                        {formatRs(product.salePrice)}
                      </div>
                      <div
                        className={`text-[11px] font-medium tabular-nums ${
                          isOut || isLow ? 'text-red-600 font-semibold' : 'text-slate-500'
                        }`}
                      >
                        {isOut
                          ? 'Out of stock'
                          : isLow
                          ? `Low: ${product.stock}`
                          : `Stock: ${product.stock}`}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Right Column: Active Counter Bill & Checkout */}
      <div className="w-full lg:w-[410px] xl:w-[430px] shrink-0 bg-white border border-slate-200 rounded-xl flex flex-col overflow-hidden">
        {/* Bill Header */}
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-emerald-700" />
            <h2 className="text-sm font-bold text-slate-900">Current Counter Bill</h2>
            <span className="text-xs font-mono-num text-slate-500">
              ({cart.reduce((s, i) => s + i.qty, 0)} items)
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowHeldModal(true)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 whitespace-nowrap"
            >
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              Held ({db.heldBills.length})
            </button>
            <button
              type="button"
              onClick={handleHoldBill}
              disabled={cart.length === 0}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 disabled:opacity-40 whitespace-nowrap"
            >
              <PauseCircle className="w-3.5 h-3.5" />
              Hold
            </button>
          </div>
        </div>

        {/* Cart Line Items */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 min-h-[180px] max-h-[340px] lg:max-h-none">
          {cart.length === 0 ? (
            <div className="p-8 text-center text-slate-500 flex flex-col items-center justify-center h-full">
              <Barcode className="w-8 h-8 text-slate-300 mb-2" />
              <p className="text-sm font-medium text-slate-700">Ready for next customer</p>
              <p className="text-xs text-slate-500 mt-1">
                Tap a product or scan a barcode to start billing.
              </p>
              {lastCompletedSale && (
                <button
                  type="button"
                  onClick={() => setActiveReceipt(lastCompletedSale)}
                  className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Reprint Last ({lastCompletedSale.invoiceNo})
                </button>
              )}
            </div>
          ) : (
            cart.map((item) => {
              const lineTotal = Math.max(0, item.salePrice * item.qty - (item.discount || 0));
              return (
                <div key={item.productId} className="px-4 py-2.5 hover:bg-slate-50/70">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-slate-900 truncate">
                        {item.name}
                      </div>
                      <div className="text-xs text-slate-500 font-mono-num">
                        {formatRs(item.salePrice)} / {item.unit}
                      </div>
                    </div>
                    <div className="text-sm font-bold font-mono-num text-slate-900 whitespace-nowrap">
                      {formatRs(lineTotal)}
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-2">
                    <div className="flex items-center border border-slate-300 rounded-lg bg-white overflow-hidden">
                      <button
                        type="button"
                        onClick={() => updateCartQty(item.productId, item.qty - 1)}
                        className="px-2 py-1 text-slate-600 hover:bg-slate-100"
                        aria-label="Decrease quantity"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <input
                        type="number"
                        min={1}
                        value={item.qty}
                        onChange={(e) =>
                          updateCartQty(item.productId, Math.max(1, Number(e.target.value) || 1))
                        }
                        className="w-11 text-center text-xs font-mono-num font-semibold py-1 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => updateCartQty(item.productId, item.qty + 1)}
                        className="px-2 py-1 text-slate-600 hover:bg-slate-100"
                        aria-label="Increase quantity"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <label className="text-[11px] text-slate-500">Disc Rs.</label>
                      <input
                        type="number"
                        min={0}
                        value={item.discount || ''}
                        placeholder="0"
                        onChange={(e) =>
                          updateCartItemDiscount(item.productId, Number(e.target.value) || 0)
                        }
                        className="w-16 px-2 py-1 text-xs font-mono-num border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-600"
                      />
                      <button
                        type="button"
                        onClick={() => removeCartItem(item.productId)}
                        className="p-1.5 text-slate-400 hover:text-red-600 rounded-md hover:bg-red-50"
                        aria-label="Remove item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Checkout Calculations & Payment */}
        <div className="border-t border-slate-200 bg-slate-50/80 p-4 space-y-3">
          {/* Customer & Discount Row */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-1">
                Customer (Optional / Udhar)
              </label>
              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-600"
              >
                <option value="">Walk-in Customer</option>
                {db.customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.udharBalance > 0 ? `(Bal: ${formatRs(c.udharBalance)})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-1">
                Bill Discount ({discountType === 'flat' ? 'Rs.' : '%'})
              </label>
              <div className="flex">
                <input
                  type="number"
                  min={0}
                  value={discountValue || ''}
                  placeholder="0"
                  onChange={(e) => setDiscountValue(Math.max(0, Number(e.target.value) || 0))}
                  className="w-full px-2.5 py-1.5 text-xs font-mono-num bg-white border border-slate-300 rounded-l-lg focus:outline-none focus:ring-1 focus:ring-emerald-600"
                />
                <button
                  type="button"
                  onClick={() =>
                    setDiscountType((prev) => (prev === 'flat' ? 'percent' : 'flat'))
                  }
                  className="px-2.5 py-1.5 text-xs font-semibold bg-slate-200 text-slate-800 border border-l-0 border-slate-300 rounded-r-lg hover:bg-slate-300"
                >
                  {discountType === 'flat' ? 'Rs.' : '%'}
                </button>
              </div>
            </div>
          </div>

          {/* Optional Tax Toggle */}
          <div className="flex items-center justify-between text-xs">
            <label className="inline-flex items-center gap-2 text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={taxEnabled}
                onChange={(e) => setTaxEnabled(e.target.checked)}
                className="rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
              />
              <span>Apply GST / Sales Tax</span>
            </label>
            {taxEnabled && (
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={0}
                  max={50}
                  value={taxRate}
                  onChange={(e) => setTaxRate(Math.max(0, Number(e.target.value) || 0))}
                  className="w-14 px-2 py-1 text-xs font-mono-num bg-white border border-slate-300 rounded-md text-right"
                />
                <span className="text-slate-600">%</span>
              </div>
            )}
          </div>

          {/* Summary Numbers */}
          <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-1 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal</span>
              <span className="font-mono-num">{formatRs(subtotal)}</span>
            </div>
            {billDiscountAmount > 0 && (
              <div className="flex justify-between text-amber-700">
                <span>Bill Discount</span>
                <span className="font-mono-num">-{formatRs(billDiscountAmount)}</span>
              </div>
            )}
            {taxEnabled && taxAmount > 0 && (
              <div className="flex justify-between text-slate-600">
                <span>Tax ({taxRate}%)</span>
                <span className="font-mono-num">{formatRs(taxAmount)}</span>
              </div>
            )}
            <div className="flex justify-between items-baseline pt-1.5 border-t border-slate-200">
              <span className="text-sm font-bold text-slate-900">Grand Total</span>
              <span className="text-xl font-extrabold font-mono-num text-emerald-800">
                {formatRs(grandTotal)}
              </span>
            </div>
            {activeUser?.role === 'Admin' && cart.length > 0 && (
              <div className="flex justify-between text-[11px] text-slate-500 pt-0.5">
                <span>Estimated Net Profit</span>
                <span className="font-mono-num font-semibold text-emerald-700">
                  {formatRs(estimatedProfit)}
                </span>
              </div>
            )}
          </div>

          {/* Payment Method Selector */}
          <div>
            <div className="grid grid-cols-5 gap-1">
              {(['Cash', 'Card', 'JazzCash', 'Easypaisa', 'Udhar (Credit)'] as PaymentMethod[]).map(
                (method) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => {
                      setPaymentMethod(method);
                      if (method !== 'Cash' && method !== 'Udhar (Credit)') {
                        setAmountReceivedInput(String(grandTotal));
                      } else if (method === 'Udhar (Credit)') {
                        setAmountReceivedInput('0');
                      }
                    }}
                    className={`py-1.5 px-1 text-[11px] font-semibold rounded-md border text-center transition-colors truncate ${
                      paymentMethod === method
                        ? 'bg-emerald-700 text-white border-emerald-700'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    {method === 'Udhar (Credit)' ? 'Udhar' : method}
                  </button>
                )
              )}
            </div>
          </div>

          {/* Received & Return Balance */}
          <div className="grid grid-cols-2 gap-2.5 items-end">
            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-1">
                {paymentMethod === 'Udhar (Credit)'
                  ? 'Spot Paid (Rs.)'
                  : 'Received Amount (Rs.)'}
              </label>
              <input
                type="number"
                min={0}
                value={amountReceivedInput}
                onChange={(e) => setAmountReceivedInput(e.target.value)}
                placeholder={String(grandTotal)}
                className="w-full px-3 py-2 text-sm font-mono-num font-semibold bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div className="bg-white border border-slate-200 rounded-lg px-3 py-2">
              <div className="text-[11px] text-slate-500">
                {paymentMethod === 'Udhar (Credit)' ? 'Udhar Balance' : 'Return Balance'}
              </div>
              <div className="text-sm font-bold font-mono-num text-slate-900">
                {paymentMethod === 'Udhar (Credit)'
                  ? formatRs(Math.max(0, grandTotal - (Number(amountReceivedInput) || 0)))
                  : formatRs(returnBalance)}
              </div>
            </div>
          </div>

          {paymentMethod === 'Cash' && grandTotal > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {[grandTotal, 500, 1000, 2000, 5000].map((amt, idx) => (
                <button
                  key={`${amt}-${idx}`}
                  type="button"
                  onClick={() => setAmountReceivedInput(String(amt))}
                  className="px-2 py-1 text-[11px] font-mono-num font-medium bg-white border border-slate-300 rounded hover:bg-slate-100 text-slate-700"
                >
                  {idx === 0 ? 'Exact' : formatRs(amt)}
                </button>
              ))}
            </div>
          )}

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={() => handleCheckout(false)}
              disabled={cart.length === 0}
              className="py-2.5 px-3 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 disabled:opacity-40 transition-colors"
            >
              Save Bill
            </button>
            <button
              type="button"
              onClick={() => handleCheckout(true)}
              disabled={cart.length === 0}
              className="inline-flex items-center justify-center gap-1.5 py-2.5 px-3 bg-emerald-700 text-white text-xs font-semibold rounded-lg hover:bg-emerald-800 disabled:opacity-40 transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              Save & Print
            </button>
          </div>

          {cart.length > 0 && (
            <button
              type="button"
              onClick={resetCartState}
              className="w-full py-1.5 text-xs font-medium text-slate-500 hover:text-red-600 transition-colors"
            >
              Clear Current Bill
            </button>
          )}
        </div>
      </div>

      {/* Held Bills Modal */}
      {showHeldModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">
                Held Incomplete Bills ({db.heldBills.length})
              </h3>
              <button
                type="button"
                onClick={() => setShowHeldModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 max-h-[65vh] overflow-y-auto space-y-2.5">
              {db.heldBills.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-8">
                  No held bills right now. Use &ldquo;Hold&rdquo; on the counter to pause an incomplete bill.
                </p>
              ) : (
                db.heldBills.map((held) => {
                  const estTotal = held.items.reduce(
                    (s, i) => s + Math.max(0, i.salePrice * i.qty - i.discount),
                    0
                  );
                  return (
                    <div
                      key={held.id}
                      className="border border-slate-200 rounded-lg p-3 flex items-center justify-between gap-3"
                    >
                      <div>
                        <div className="text-sm font-semibold text-slate-900">{held.label}</div>
                        <div className="text-xs text-slate-500">
                          Held at {formatPKTime(held.createdAt)} ·{' '}
                          <span className="font-mono-num font-semibold text-slate-700">
                            {formatRs(estTotal)}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleResumeHeldBill(held)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-emerald-700 text-white rounded-lg hover:bg-emerald-800"
                        >
                          <Play className="w-3.5 h-3.5" />
                          Resume
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteHeldBill(held.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50"
                          aria-label="Discard held bill"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Thermal Receipt Preview & Print */}
      {activeReceipt && (
        <ReceiptModal
          sale={activeReceipt}
          settings={db.settings}
          onClose={() => setActiveReceipt(null)}
        />
      )}
    </div>
  );
};
