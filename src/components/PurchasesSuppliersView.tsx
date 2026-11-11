import React, { useState } from 'react';
import { Banknote, Building2, Plus, Trash2, Truck, X } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import type { Purchase, PurchaseItem, Supplier } from '../types/pos';
import { formatPKDateTime, formatRs } from '../utils/formatters';

export const PurchasesSuppliersView: React.FC = () => {
  const { db, addSupplier, recordPurchase, recordSupplierPayment } = useStore();
  const [tab, setTab] = useState<'purchases' | 'suppliers'>('purchases');
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [paySupplierTarget, setPaySupplierTarget] = useState<Supplier | null>(null);
  const [statusMsg, setStatusMsg] = useState('');

  // Supplier form
  const [supName, setSupName] = useState('');
  const [supCompany, setSupCompany] = useState('');
  const [supPhone, setSupPhone] = useState('');
  const [supAddress, setSupAddress] = useState('');

  // Purchase form
  const [purSupplierId, setPurSupplierId] = useState(db.suppliers[0]?.id || '');
  const [purInvoiceNo, setPurInvoiceNo] = useState('');
  const [purItems, setPurItems] = useState<PurchaseItem[]>([]);
  const [purPaid, setPurPaid] = useState('');
  const [purMethod, setPurMethod] = useState<Purchase['paymentMethod']>('Cash');
  const [purNotes, setPurNotes] = useState('');

  // Supplier payment form
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<'Cash' | 'Bank/JazzCash'>('Cash');
  const [payNote, setPayNote] = useState('');

  const totalPayable = db.suppliers.reduce((sum, s) => sum + s.balanceOwed, 0);

  const handleAddSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supCompany.trim() && !supName.trim()) return;
    const created = addSupplier({
      name: supName.trim() || supCompany.trim(),
      company: supCompany.trim() || supName.trim(),
      phone: supPhone.trim(),
      address: supAddress.trim(),
      balanceOwed: 0,
    });
    setPurSupplierId(created.id);
    setSupName('');
    setSupCompany('');
    setSupPhone('');
    setSupAddress('');
    setShowSupplierModal(false);
    setStatusMsg(`Added supplier: ${created.company}`);
  };

  const openNewPurchaseModal = () => {
    const firstProd = db.products[0];
    setPurSupplierId(db.suppliers[0]?.id || '');
    setPurInvoiceNo(`PO-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${db.purchases.length + 1}`);
    setPurItems(
      firstProd
        ? [
            {
              productId: firstProd.id,
              productName: firstProd.name,
              qty: 10,
              unitCost: firstProd.purchasePrice,
              lineTotal: firstProd.purchasePrice * 10,
            },
          ]
        : []
    );
    setPurPaid('');
    setPurMethod('Cash');
    setPurNotes('');
    setShowPurchaseModal(true);
  };

  const addPurchaseRow = () => {
    const firstProd = db.products[0];
    if (!firstProd) return;
    setPurItems((prev) => [
      ...prev,
      {
        productId: firstProd.id,
        productName: firstProd.name,
        qty: 5,
        unitCost: firstProd.purchasePrice,
        lineTotal: firstProd.purchasePrice * 5,
      },
    ]);
  };

  const updatePurchaseRow = (idx: number, patch: Partial<PurchaseItem>) => {
    setPurItems((prev) =>
      prev.map((row, i) => {
        if (i !== idx) return row;
        const updated = { ...row, ...patch };
        if (patch.productId) {
          const prod = db.products.find((p) => p.id === patch.productId);
          if (prod) {
            updated.productName = prod.name;
            updated.unitCost = prod.purchasePrice;
          }
        }
        updated.lineTotal = Math.round(updated.qty * updated.unitCost * 100) / 100;
        return updated;
      })
    );
  };

  const purchaseTotal = purItems.reduce((sum, i) => sum + i.lineTotal, 0);

  const handleSavePurchase = (e: React.FormEvent) => {
    e.preventDefault();
    if (!purSupplierId || purItems.length === 0) return;
    const paid = purPaid.trim() === '' ? purchaseTotal : Math.max(0, Number(purPaid) || 0);
    const created = recordPurchase({
      supplierId: purSupplierId,
      invoiceNo: purInvoiceNo,
      items: purItems,
      paidAmount: paid,
      paymentMethod: purMethod,
      notes: purNotes,
    });
    setShowPurchaseModal(false);
    setStatusMsg(
      `Recorded Purchase ${created.invoiceNo} (${formatRs(created.totalAmount)}). Inventory stock updated.`
    );
  };

  const handleSupplierPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!paySupplierTarget) return;
    const amt = Number(payAmount) || 0;
    if (amt <= 0) return;
    recordSupplierPayment(paySupplierTarget.id, amt, payMethod, payNote);
    setStatusMsg(`Paid ${formatRs(amt)} to ${paySupplierTarget.company}`);
    setPaySupplierTarget(null);
    setPayAmount('');
    setPayNote('');
  };

  return (
    <div className="space-y-5">
      {/* Top Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex items-center p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setTab('purchases')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md ${
                tab === 'purchases' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              Stock Purchases ({db.purchases.length})
            </button>
            <button
              type="button"
              onClick={() => setTab('suppliers')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md ${
                tab === 'suppliers' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              Suppliers ({db.suppliers.length})
            </button>
          </div>
          <div className="text-xs text-slate-600 ml-2">
            Total Supplier Payable:{' '}
            <span className="font-mono-num font-bold text-red-600">{formatRs(totalPayable)}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowSupplierModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
          >
            <Building2 className="w-3.5 h-3.5" />
            Add Supplier
          </button>
          <button
            type="button"
            onClick={openNewPurchaseModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-emerald-700 text-white rounded-lg hover:bg-emerald-800"
          >
            <Plus className="w-3.5 h-3.5" />
            Record Stock Purchase
          </button>
        </div>
      </div>

      {statusMsg && (
        <div className="px-4 py-2.5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-lg text-xs font-medium flex justify-between">
          <span>{statusMsg}</span>
          <button type="button" onClick={() => setStatusMsg('')}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {tab === 'purchases' ? (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
                  <th className="py-3 px-4">Purchase Invoice</th>
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3">Supplier</th>
                  <th className="py-3 px-3">Items</th>
                  <th className="py-3 px-3 text-right">Total Bill</th>
                  <th className="py-3 px-3 text-right">Paid</th>
                  <th className="py-3 px-4 text-right">Balance Due</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {db.purchases.map((pur) => (
                  <tr key={pur.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-mono-num font-bold text-slate-900">
                      {pur.invoiceNo}
                    </td>
                    <td className="py-3 px-3 text-slate-600 whitespace-nowrap">
                      {formatPKDateTime(pur.date)}
                    </td>
                    <td className="py-3 px-3 font-medium text-slate-900">{pur.supplierName}</td>
                    <td className="py-3 px-3 text-slate-600">
                      {pur.items.map((i) => `${i.productName} (${i.qty})`).join(', ')}
                    </td>
                    <td className="py-3 px-3 text-right font-mono-num font-semibold text-slate-900">
                      {formatRs(pur.totalAmount)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono-num text-emerald-700">
                      {formatRs(pur.paidAmount)}
                    </td>
                    <td
                      className={`py-3 px-4 text-right font-mono-num font-bold ${
                        pur.balanceDue > 0 ? 'text-red-600' : 'text-slate-500'
                      }`}
                    >
                      {formatRs(pur.balanceDue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {db.suppliers.map((sup) => (
            <div
              key={sup.id}
              className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between gap-3"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">{sup.company}</h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Contact: {sup.name} · {sup.phone}
                    </p>
                  </div>
                  <Truck className="w-4 h-4 text-slate-400 shrink-0" />
                </div>
                <p className="text-xs text-slate-500 mt-2">{sup.address}</p>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <div>
                  <div className="text-[11px] text-slate-500">Outstanding Payable</div>
                  <div
                    className={`text-base font-bold font-mono-num ${
                      sup.balanceOwed > 0 ? 'text-red-600' : 'text-emerald-700'
                    }`}
                  >
                    {formatRs(sup.balanceOwed)}
                  </div>
                </div>
                {sup.balanceOwed > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setPaySupplierTarget(sup);
                      setPayAmount(String(sup.balanceOwed));
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-emerald-700 text-white rounded-lg hover:bg-emerald-800"
                  >
                    <Banknote className="w-3.5 h-3.5" />
                    Pay Balance
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Supplier Modal */}
      {showSupplierModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">Add Wholesale Supplier</h3>
              <button type="button" onClick={() => setShowSupplierModal(false)}>
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleAddSupplier} className="p-5 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Company / Mandi Name *
                </label>
                <input
                  required
                  type="text"
                  value={supCompany}
                  onChange={(e) => setSupCompany(e.target.value)}
                  placeholder="e.g. Akbari Mandi Flour Traders"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Contact Person</label>
                <input
                  type="text"
                  value={supName}
                  onChange={(e) => setSupName(e.target.value)}
                  placeholder="e.g. Haji Rashid"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Phone Number *</label>
                <input
                  required
                  type="text"
                  value={supPhone}
                  onChange={(e) => setSupPhone(e.target.value)}
                  placeholder="0300-1234567"
                  className="w-full px-3 py-2 font-mono-num border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Market Address</label>
                <input
                  type="text"
                  value={supAddress}
                  onChange={(e) => setSupAddress(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSupplierModal(false)}
                  className="px-4 py-2 bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-700 text-white font-semibold rounded-lg"
                >
                  Save Supplier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Stock Purchase Modal */}
      {showPurchaseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">
                Record Stock Purchase (Auto-Updates Inventory)
              </h3>
              <button type="button" onClick={() => setShowPurchaseModal(false)}>
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleSavePurchase} className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Supplier *</label>
                  <select
                    required
                    value={purSupplierId}
                    onChange={(e) => setPurSupplierId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    {db.suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.company}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Purchase Invoice No
                  </label>
                  <input
                    type="text"
                    value={purInvoiceNo}
                    onChange={(e) => setPurInvoiceNo(e.target.value)}
                    className="w-full px-3 py-2 font-mono-num border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-slate-700">Purchased Products</label>
                  <button
                    type="button"
                    onClick={addPurchaseRow}
                    className="text-xs font-semibold text-emerald-700 hover:underline"
                  >
                    + Add Line Item
                  </button>
                </div>

                {purItems.map((row, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-12 gap-2 items-center p-2 bg-slate-50 border border-slate-200 rounded-lg"
                  >
                    <select
                      value={row.productId}
                      onChange={(e) => updatePurchaseRow(idx, { productId: e.target.value })}
                      className="col-span-5 px-2 py-1.5 border border-slate-300 rounded bg-white"
                    >
                      {db.products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.unit})
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min={1}
                      value={row.qty}
                      onChange={(e) =>
                        updatePurchaseRow(idx, { qty: Math.max(1, Number(e.target.value) || 1) })
                      }
                      placeholder="Qty"
                      className="col-span-2 px-2 py-1.5 border border-slate-300 rounded font-mono-num bg-white"
                    />
                    <input
                      type="number"
                      min={0}
                      value={row.unitCost}
                      onChange={(e) =>
                        updatePurchaseRow(idx, {
                          unitCost: Math.max(0, Number(e.target.value) || 0),
                        })
                      }
                      placeholder="Cost Rs."
                      className="col-span-2 px-2 py-1.5 border border-slate-300 rounded font-mono-num bg-white"
                    />
                    <div className="col-span-2 text-right font-mono-num font-bold text-slate-900">
                      {formatRs(row.lineTotal)}
                    </div>
                    <button
                      type="button"
                      onClick={() => setPurItems((prev) => prev.filter((_, i) => i !== idx))}
                      className="col-span-1 text-slate-400 hover:text-red-600 flex justify-center"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-200">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Total Bill</label>
                  <div className="px-3 py-2 bg-slate-100 rounded-lg font-mono-num font-bold text-slate-900">
                    {formatRs(purchaseTotal)}
                  </div>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Paid Now (Rs.)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={purchaseTotal}
                    value={purPaid}
                    placeholder={String(purchaseTotal)}
                    onChange={(e) => setPurPaid(e.target.value)}
                    className="w-full px-3 py-2 font-mono-num border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Payment Mode</label>
                  <select
                    value={purMethod}
                    onChange={(e) => setPurMethod(e.target.value as Purchase['paymentMethod'])}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="Cash">Cash (From Counter)</option>
                    <option value="Bank/JazzCash">Bank / JazzCash</option>
                    <option value="Credit">Supplier Credit (Khata)</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPurchaseModal(false)}
                  className="px-4 py-2 bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-700 text-white font-semibold rounded-lg hover:bg-emerald-800"
                >
                  Save Purchase & Add Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pay Supplier Balance Modal */}
      {paySupplierTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">
                Pay Supplier · {paySupplierTarget.company}
              </h3>
              <button type="button" onClick={() => setPaySupplierTarget(null)}>
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleSupplierPayment} className="p-5 space-y-3 text-xs">
              <div>
                Current Balance Owed:{' '}
                <span className="font-mono-num font-bold text-red-600">
                  {formatRs(paySupplierTarget.balanceOwed)}
                </span>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Payment Amount (Rs.)
                </label>
                <input
                  required
                  type="number"
                  min={1}
                  max={paySupplierTarget.balanceOwed}
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full px-3 py-2 font-mono-num border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Payment Method</label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value as 'Cash' | 'Bank/JazzCash')}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                >
                  <option value="Cash">Cash (Deduct from Counter Drawer)</option>
                  <option value="Bank/JazzCash">Bank / JazzCash</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Note</label>
                <input
                  type="text"
                  value={payNote}
                  onChange={(e) => setPayNote(e.target.value)}
                  placeholder="Receipt / reference number"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPaySupplierTarget(null)}
                  className="px-4 py-2 bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-700 text-white font-semibold rounded-lg"
                >
                  Confirm Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
