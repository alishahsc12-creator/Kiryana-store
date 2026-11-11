import React, { useMemo, useState } from 'react';
import { Printer, RotateCcw, Search, X } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import type { Sale } from '../types/pos';
import { formatPKDateTime, formatRs } from '../utils/formatters';
import { ReceiptModal } from './ReceiptModal';

export const SalesHistoryView: React.FC = () => {
  const { db, activeUser, processSaleReturn } = useStore();
  const isAdmin = activeUser?.role === 'Admin';

  const [query, setQuery] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('All');
  const [reprintSale, setReprintSale] = useState<Sale | null>(null);
  const [returnTarget, setReturnTarget] = useState<Sale | null>(null);
  const [returnQuantities, setReturnQuantities] = useState<Record<string, number>>({});
  const [returnReason, setReturnReason] = useState('');
  const [feedback, setFeedback] = useState('');

  const filteredSales = useMemo(() => {
    const q = query.trim().toLowerCase();
    return db.sales.filter((s) => {
      if (paymentFilter !== 'All' && s.paymentMethod !== paymentFilter) return false;
      if (!q) return true;
      return (
        s.invoiceNo.toLowerCase().includes(q) ||
        (s.customerName && s.customerName.toLowerCase().includes(q)) ||
        s.cashierName.toLowerCase().includes(q)
      );
    });
  }, [db.sales, query, paymentFilter]);

  const openReturnModal = (sale: Sale) => {
    const initial: Record<string, number> = {};
    for (const item of sale.items) {
      initial[item.productId] = 0;
    }
    setReturnQuantities(initial);
    setReturnReason('');
    setReturnTarget(sale);
  };

  const handleConfirmReturn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnTarget) return;
    const itemsToReturn = Object.entries(returnQuantities)
      .filter(([, qty]) => qty > 0)
      .map(([productId, qty]) => ({ productId, qty }));

    const result = processSaleReturn(returnTarget.id, itemsToReturn, returnReason);
    if (!result.ok) {
      setFeedback(result.error || 'Could not process return.');
      return;
    }
    setFeedback(`Return processed for ${returnTarget.invoiceNo}. Stock and profit updated.`);
    setReturnTarget(null);
  };

  return (
    <div className="space-y-5">
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search invoice no, customer, cashier..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-600"
          />
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto">
          {['All', 'Cash', 'Card', 'JazzCash', 'Easypaisa', 'Udhar (Credit)'].map((pm) => (
            <button
              key={pm}
              type="button"
              onClick={() => setPaymentFilter(pm)}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-md whitespace-nowrap ${
                paymentFilter === pm ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              {pm === 'Udhar (Credit)' ? 'Udhar' : pm}
            </button>
          ))}
        </div>
      </div>

      {feedback && (
        <div className="px-4 py-2.5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-lg text-xs font-medium flex justify-between">
          <span>{feedback}</span>
          <button type="button" onClick={() => setFeedback('')}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
                <th className="py-3 px-4">Invoice No</th>
                <th className="py-3 px-3">Date & Time</th>
                <th className="py-3 px-3">Customer / Cashier</th>
                <th className="py-3 px-3">Payment</th>
                <th className="py-3 px-3 text-right">Net Total</th>
                {isAdmin && <th className="py-3 px-3 text-right">Actual Profit</th>}
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredSales.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 7 : 6} className="py-10 text-center text-slate-500">
                    No matching sales invoices found.
                  </td>
                </tr>
              ) : (
                filteredSales.map((sale) => {
                  const effectiveTotal = Math.max(0, sale.grandTotal - (sale.returnedAmount || 0));
                  return (
                    <tr key={sale.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-mono-num font-bold text-slate-900">
                        {sale.invoiceNo}
                        {(sale.returnedAmount || 0) > 0 && (
                          <div className="text-[10px] font-medium text-red-600">
                            Returned: {formatRs(sale.returnedAmount)}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 text-slate-600 whitespace-nowrap">
                        {formatPKDateTime(sale.createdAt)}
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-medium text-slate-900">
                          {sale.customerName || 'Walk-in Customer'}
                        </div>
                        <div className="text-[11px] text-slate-500">{sale.cashierName}</div>
                      </td>
                      <td className="py-3 px-3 text-slate-700">{sale.paymentMethod}</td>
                      <td className="py-3 px-3 text-right font-mono-num font-bold text-slate-900">
                        {formatRs(effectiveTotal)}
                      </td>
                      {isAdmin && (
                        <td
                          className={`py-3 px-3 text-right font-mono-num font-semibold ${
                            sale.netProfit >= 0 ? 'text-emerald-700' : 'text-red-600'
                          }`}
                        >
                          {formatRs(sale.netProfit)}
                        </td>
                      )}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setReprintSale(sale)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-slate-100 text-slate-800 rounded-md hover:bg-slate-200"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            Reprint
                          </button>
                          <button
                            type="button"
                            onClick={() => openReturnModal(sale)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-md hover:bg-amber-100"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Return
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {reprintSale && (
        <ReceiptModal
          sale={reprintSale}
          settings={db.settings}
          onClose={() => setReprintSale(null)}
        />
      )}

      {/* Sales Return Modal */}
      {returnTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">
                Process Counter Return · {returnTarget.invoiceNo}
              </h3>
              <button
                type="button"
                onClick={() => setReturnTarget(null)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleConfirmReturn} className="p-5 space-y-4 text-xs">
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {returnTarget.items.map((item) => {
                  const maxReturnable = item.qty - (item.returnedQty || 0);
                  return (
                    <div
                      key={item.productId}
                      className="flex items-center justify-between gap-3 p-2.5 border border-slate-200 rounded-lg"
                    >
                      <div>
                        <div className="font-semibold text-slate-900">{item.name}</div>
                        <div className="text-slate-500 font-mono-num">
                          Sold: {item.qty} · Returned: {item.returnedQty || 0} · Rate:{' '}
                          {formatRs(item.salePrice)}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-slate-600">Return Qty</label>
                        <input
                          type="number"
                          min={0}
                          max={maxReturnable}
                          value={returnQuantities[item.productId] || 0}
                          onChange={(e) =>
                            setReturnQuantities((prev) => ({
                              ...prev,
                              [item.productId]: Math.max(
                                0,
                                Math.min(maxReturnable, Number(e.target.value) || 0)
                              ),
                            }))
                          }
                          disabled={maxReturnable <= 0}
                          className="w-16 px-2 py-1.5 border border-slate-300 rounded-md font-mono-num text-center"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Return Reason</label>
                <input
                  type="text"
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  placeholder="e.g. Customer exchanged pack, wrong size"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setReturnTarget(null)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-600 text-white rounded-lg font-semibold hover:bg-amber-700"
                >
                  Confirm Return & Restore Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
