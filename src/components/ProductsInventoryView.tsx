import React, { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Download,
  Edit3,
  PackagePlus,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { IMAGE_PRESET_OPTIONS } from '../assets/productImages';
import { useStore } from '../context/StoreContext';
import type { Product, StockAdjustment } from '../types/pos';
import { formatPKDateTime, formatRs } from '../utils/formatters';
import { ProductImage } from './ProductImage';

const DEFAULT_CATEGORIES = [
  'Atta & Grains',
  'Oil & Ghee',
  'Tea & Dairy',
  'Spices & Lentils',
  'Beverages',
  'Household & Care',
  'Snacks & Bakery',
];

export const ProductsInventoryView: React.FC = () => {
  const {
    db,
    activeUser,
    addProduct,
    updateProduct,
    deleteProduct,
    importProductsBulk,
    adjustStock,
  } = useStore();

  const isAdmin = activeUser?.role === 'Admin';
  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'low_stock' | 'expiring'>('all');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showProductForm, setShowProductForm] = useState(false);
  const [adjustTarget, setAdjustTarget] = useState<Product | null>(null);
  const [statusMsg, setStatusMsg] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form states
  const [name, setName] = useState('');
  const [urduName, setUrduName] = useState('');
  const [barcode, setBarcode] = useState('');
  const [category, setCategory] = useState(DEFAULT_CATEGORIES[0]);
  const [unit, setUnit] = useState('1kg Pack');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [stock, setStock] = useState('');
  const [minStockAlert, setMinStockAlert] = useState('8');
  const [expiryDate, setExpiryDate] = useState('');
  const [imageKey, setImageKey] = useState('chakki_atta');

  // Stock adjustment states
  const [adjType, setAdjType] = useState<StockAdjustment['type']>('damage');
  const [adjQty, setAdjQty] = useState('1');
  const [adjReason, setAdjReason] = useState('');

  const lowStockCount = useMemo(
    () => db.products.filter((p) => p.stock <= p.minStockAlert).length,
    [db.products]
  );

  const expiringSoonCount = useMemo(() => {
    const horizon = new Date();
    horizon.setDate(horizon.getDate() + 45);
    return db.products.filter((p) => p.expiryDate && new Date(p.expiryDate) <= horizon).length;
  }, [db.products]);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    const horizon = new Date();
    horizon.setDate(horizon.getDate() + 45);

    return db.products.filter((p) => {
      if (filterMode === 'low_stock' && p.stock > p.minStockAlert) return false;
      if (filterMode === 'expiring' && (!p.expiryDate || new Date(p.expiryDate) > horizon)) {
        return false;
      }
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.urduName && p.urduName.toLowerCase().includes(q)) ||
        p.barcode.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
      );
    });
  }, [db.products, search, filterMode]);

  const openAddModal = () => {
    setEditingProduct(null);
    setName('');
    setUrduName('');
    setBarcode(`896100${Math.floor(1000000 + Math.random() * 8999999)}`);
    setCategory(DEFAULT_CATEGORIES[0]);
    setUnit('1kg Pack');
    setPurchasePrice('');
    setSalePrice('');
    setStock('10');
    setMinStockAlert('8');
    setExpiryDate('');
    setImageKey('chakki_atta');
    setShowProductForm(true);
  };

  const openEditModal = (p: Product) => {
    setEditingProduct(p);
    setName(p.name);
    setUrduName(p.urduName || '');
    setBarcode(p.barcode);
    setCategory(p.category);
    setUnit(p.unit);
    setPurchasePrice(String(p.purchasePrice));
    setSalePrice(String(p.salePrice));
    setStock(String(p.stock));
    setMinStockAlert(String(p.minStockAlert));
    setExpiryDate(p.expiryDate || '');
    setImageKey(p.imageKey);
    setShowProductForm(true);
  };

  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const payload = {
      name: name.trim(),
      urduName: urduName.trim() || undefined,
      barcode: barcode.trim() || `896${Date.now().toString().slice(-10)}`,
      category: category.trim() || 'General',
      unit: unit.trim() || '1 Unit',
      purchasePrice: Math.max(0, Number(purchasePrice) || 0),
      salePrice: Math.max(0, Number(salePrice) || 0),
      stock: Math.max(0, Number(stock) || 0),
      minStockAlert: Math.max(0, Number(minStockAlert) || 5),
      expiryDate: expiryDate || undefined,
      imageKey,
    };

    if (editingProduct) {
      updateProduct(editingProduct.id, payload);
      setStatusMsg(`Updated product: ${payload.name}`);
    } else {
      addProduct(payload);
      setStatusMsg(`Added new product: ${payload.name}`);
    }
    setShowProductForm(false);
  };

  const handleCustomPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setImageKey(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAdjustSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustTarget) return;
    const qty = Math.max(1, Number(adjQty) || 1);
    const delta = adjType === 'restock' ? qty : -qty;
    adjustStock(adjustTarget.id, adjType, delta, adjReason);
    setStatusMsg(`Adjusted stock for ${adjustTarget.name} (${delta > 0 ? `+${delta}` : delta})`);
    setAdjustTarget(null);
    setAdjQty('1');
    setAdjReason('');
  };

  const handleExportExcel = (format: 'xlsx' | 'csv') => {
    const rows = db.products.map((p) => ({
      Name: p.name,
      UrduName: p.urduName || '',
      Barcode: p.barcode,
      Category: p.category,
      Unit: p.unit,
      PurchasePrice_Rs: p.purchasePrice,
      SalePrice_Rs: p.salePrice,
      Stock: p.stock,
      MinStockAlert: p.minStockAlert,
      ExpiryDate: p.expiryDate || '',
      DamagedQty: p.damagedQty,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Kiryana Products');
    XLSX.writeFile(wb, `asan-kiryana-products.${format}`);
    setStatusMsg(`Exported ${rows.length} products as .${format.toUpperCase()}`);
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const firstSheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet);

      const mapped = rows
        .map((r) => ({
          name: String(r.Name ?? r.name ?? '').trim(),
          urduName: r.UrduName ? String(r.UrduName) : undefined,
          barcode: String(r.Barcode ?? r.barcode ?? `896${Date.now().toString().slice(-8)}`),
          category: String(r.Category ?? r.category ?? 'General'),
          unit: String(r.Unit ?? r.unit ?? '1 Unit'),
          purchasePrice: Number(r.PurchasePrice_Rs ?? r.PurchasePrice ?? r.purchasePrice ?? 0) || 0,
          salePrice: Number(r.SalePrice_Rs ?? r.SalePrice ?? r.salePrice ?? 0) || 0,
          stock: Number(r.Stock ?? r.stock ?? 0) || 0,
          minStockAlert: Number(r.MinStockAlert ?? r.minStockAlert ?? 5) || 5,
          expiryDate: r.ExpiryDate ? String(r.ExpiryDate) : undefined,
          imageKey: 'chakki_atta',
        }))
        .filter((x) => x.name.length > 0);

      const count = importProductsBulk(mapped);
      setStatusMsg(`Imported/updated ${count} products from ${file.name}.`);
    } catch {
      setStatusMsg('Failed to read Excel/CSV file. Verify column headers (Name, Barcode, Category, PurchasePrice_Rs, SalePrice_Rs, Stock).');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-5">
      {/* Header Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, barcode, category..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          <div className="flex items-center p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setFilterMode('all')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                filterMode === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              All ({db.products.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('low_stock')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                filterMode === 'low_stock'
                  ? 'bg-red-600 text-white shadow-sm'
                  : lowStockCount > 0
                  ? 'text-red-600 font-semibold'
                  : 'text-slate-600'
              }`}
            >
              Low Stock ({lowStockCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('expiring')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                filterMode === 'expiring'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-slate-600'
              }`}
            >
              Expiring Soon ({expiringSoonCount})
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => handleExportExcel('xlsx')}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            Export Excel
          </button>
          <button
            type="button"
            onClick={() => handleExportExcel('csv')}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
          {isAdmin && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleImportFile}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 whitespace-nowrap"
              >
                <Upload className="w-3.5 h-3.5" />
                Import Excel/CSV
              </button>
              <button
                type="button"
                onClick={openAddModal}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Product
              </button>
            </>
          )}
        </div>
      </div>

      {statusMsg && (
        <div className="px-4 py-2.5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-lg text-xs font-medium flex justify-between items-center">
          <span>{statusMsg}</span>
          <button type="button" onClick={() => setStatusMsg('')} className="text-emerald-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Low Stock Alert Banner */}
      {lowStockCount > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-red-800 text-xs font-semibold">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            <span>
              Low Stock Alert: {lowStockCount} product{lowStockCount > 1 ? 's are' : ' is'} at or
              below minimum counter stock level. Restock soon.
            </span>
          </div>
          {filterMode !== 'low_stock' && (
            <button
              type="button"
              onClick={() => setFilterMode('low_stock')}
              className="text-xs font-semibold text-red-700 underline hover:no-underline whitespace-nowrap"
            >
              View Low Stock
            </button>
          )}
        </div>
      )}

      {/* Products Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
                <th className="py-3 px-4">Product</th>
                <th className="py-3 px-3">Barcode</th>
                <th className="py-3 px-3">Category</th>
                {isAdmin && <th className="py-3 px-3 text-right">Purchase</th>}
                <th className="py-3 px-3 text-right">Sale Price</th>
                {isAdmin && <th className="py-3 px-3 text-right">Margin</th>}
                <th className="py-3 px-3 text-right">Stock</th>
                <th className="py-3 px-3">Expiry</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredProducts.map((p) => {
                const isLow = p.stock <= p.minStockAlert;
                const margin = p.salePrice - p.purchasePrice;
                return (
                  <tr
                    key={p.id}
                    className={`hover:bg-slate-50/80 transition-colors ${
                      isLow ? 'bg-red-50/40' : ''
                    }`}
                  >
                    <td className="py-2.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-lg overflow-hidden border border-slate-200 bg-slate-50 shrink-0">
                          <ProductImage imageKey={p.imageKey} alt={p.name} />
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900">{p.name}</div>
                          <div className="text-[11px] text-slate-500">
                            {p.unit}
                            {p.urduName ? ` · ${p.urduName}` : ''}
                            {p.damagedQty > 0 ? ` · Damaged: ${p.damagedQty}` : ''}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 font-mono-num text-slate-600">{p.barcode}</td>
                    <td className="py-2.5 px-3 text-slate-600">{p.category}</td>
                    {isAdmin && (
                      <td className="py-2.5 px-3 text-right font-mono-num text-slate-600">
                        {formatRs(p.purchasePrice)}
                      </td>
                    )}
                    <td className="py-2.5 px-3 text-right font-mono-num font-bold text-slate-900">
                      {formatRs(p.salePrice)}
                    </td>
                    {isAdmin && (
                      <td className="py-2.5 px-3 text-right font-mono-num text-emerald-700 font-medium">
                        {formatRs(margin)}
                      </td>
                    )}
                    <td className="py-2.5 px-3 text-right">
                      <span
                        className={`font-mono-num font-bold ${
                          isLow ? 'text-red-600' : 'text-slate-900'
                        }`}
                      >
                        {p.stock}
                      </span>
                      {isLow && (
                        <div className="text-[10px] font-semibold text-red-600">
                          {p.stock === 0 ? 'OUT OF STOCK' : `LOW (Min ${p.minStockAlert})`}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 font-mono-num">
                      {p.expiryDate || '—'}
                    </td>
                    <td className="py-2.5 px-4 text-right whitespace-nowrap">
                      {isAdmin ? (
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setAdjustTarget(p);
                              setAdjType('restock');
                              setAdjQty('5');
                              setAdjReason('');
                            }}
                            title="Adjust / Damage Stock"
                            className="p-1.5 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-md"
                          >
                            <PackagePlus className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditModal(p)}
                            title="Edit Product"
                            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              deleteProduct(p.id);
                              setStatusMsg(`Removed product: ${p.name}`);
                            }}
                            title="Delete Product"
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400">View Only</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Stock Adjustments Log */}
      {db.stockAdjustments.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <h3 className="text-sm font-bold text-slate-900 mb-3">
            Stock Adjustments, Expiry & Damaged Write-Off Log
          </h3>
          <div className="divide-y divide-slate-100 text-xs">
            {db.stockAdjustments.slice(0, 8).map((adj) => (
              <div key={adj.id} className="py-2 flex items-center justify-between gap-3">
                <div>
                  <span className="font-semibold text-slate-900">{adj.productName}</span>
                  <span className="text-slate-500"> · {adj.type.toUpperCase()} · {adj.reason}</span>
                </div>
                <div className="text-right whitespace-nowrap">
                  <span
                    className={`font-mono-num font-bold ${
                      adj.qtyDelta >= 0 ? 'text-emerald-700' : 'text-red-600'
                    }`}
                  >
                    {adj.qtyDelta > 0 ? `+${adj.qtyDelta}` : adj.qtyDelta}
                  </span>
                  <span className="text-slate-400 ml-2">{formatPKDateTime(adj.date)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add / Edit Product Modal */}
      {showProductForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">
                {editingProduct ? `Edit Product · ${editingProduct.name}` : 'Add New Kiryana Product'}
              </h3>
              <button
                type="button"
                onClick={() => setShowProductForm(false)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Product Name *</label>
                  <input
                    required
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Chakki Fresh Atta"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Urdu / Local Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={urduName}
                    onChange={(e) => setUrduName(e.target.value)}
                    placeholder="e.g. چکی آٹا"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Barcode</label>
                  <input
                    type="text"
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    className="w-full px-3 py-2 font-mono-num border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  >
                    {DEFAULT_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Pack / Unit</label>
                  <input
                    type="text"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    placeholder="e.g. 1kg Pack, 5L Bottle"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Expiry Date</label>
                  <input
                    type="date"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    className="w-full px-3 py-2 font-mono-num border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Purchase Price (Rs.) *
                  </label>
                  <input
                    required
                    type="number"
                    min={0}
                    step="any"
                    value={purchasePrice}
                    onChange={(e) => setPurchasePrice(e.target.value)}
                    className="w-full px-3 py-2 font-mono-num border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Sale Price (Rs.) *
                  </label>
                  <input
                    required
                    type="number"
                    min={0}
                    step="any"
                    value={salePrice}
                    onChange={(e) => setSalePrice(e.target.value)}
                    className="w-full px-3 py-2 font-mono-num border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Stock Quantity *</label>
                  <input
                    required
                    type="number"
                    min={0}
                    value={stock}
                    onChange={(e) => setStock(e.target.value)}
                    className="w-full px-3 py-2 font-mono-num border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Low Stock Alert Threshold
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={minStockAlert}
                    onChange={(e) => setMinStockAlert(e.target.value)}
                    className="w-full px-3 py-2 font-mono-num border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
              </div>

              {/* Product Photo Selector / Upload */}
              <div className="border-t border-slate-200 pt-3">
                <label className="block font-semibold text-slate-700 mb-2">Product Photo</label>
                <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                  <div className="w-16 h-16 rounded-lg overflow-hidden border border-slate-200 shrink-0">
                    <ProductImage imageKey={imageKey} alt={name || 'Product preview'} />
                  </div>
                  <div className="flex-1 space-y-2 w-full">
                    <select
                      value={imageKey.startsWith('data:') ? 'custom' : imageKey}
                      onChange={(e) => {
                        if (e.target.value !== 'custom') setImageKey(e.target.value);
                      }}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                    >
                      {IMAGE_PRESET_OPTIONS.map((opt) => (
                        <option key={opt.key} value={opt.key}>
                          {opt.label}
                        </option>
                      ))}
                      {imageKey.startsWith('data:') && <option value="custom">Uploaded Photo</option>}
                    </select>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleCustomPhotoUpload}
                      className="block w-full text-[11px] text-slate-500 file:mr-3 file:py-1 file:px-3 file:rounded-md file:border file:border-slate-300 file:text-xs file:font-medium file:bg-slate-50 hover:file:bg-slate-100"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowProductForm(false)}
                  className="px-4 py-2 text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 font-semibold"
                >
                  {editingProduct ? 'Save Changes' : 'Add Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock Adjustment / Damaged Stock Modal */}
      {adjustTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">
                Adjust Stock · {adjustTarget.name}
              </h3>
              <button
                type="button"
                onClick={() => setAdjustTarget(null)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleAdjustSubmit} className="p-5 space-y-3.5 text-xs">
              <div className="text-slate-600">
                Current Stock:{' '}
                <span className="font-mono-num font-bold text-slate-900">{adjustTarget.stock}</span>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Adjustment Type</label>
                <select
                  value={adjType}
                  onChange={(e) => setAdjType(e.target.value as StockAdjustment['type'])}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                >
                  <option value="restock">Add Stock (Restock / Count Correction +)</option>
                  <option value="damage">Damaged / Broken Stock (-)</option>
                  <option value="expiry">Expired Stock Write-off (-)</option>
                  <option value="correction">Shrinkage / Missing Correction (-)</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Quantity</label>
                <input
                  required
                  type="number"
                  min={1}
                  value={adjQty}
                  onChange={(e) => setAdjQty(e.target.value)}
                  className="w-full px-3 py-2 font-mono-num border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Reason / Note</label>
                <input
                  type="text"
                  value={adjReason}
                  onChange={(e) => setAdjReason(e.target.value)}
                  placeholder="e.g. Torn bag, expired shelf batch, recount"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAdjustTarget(null)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-700 text-white rounded-lg font-semibold hover:bg-emerald-800"
                >
                  Apply Stock Update
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
