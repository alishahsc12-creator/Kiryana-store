import React, { useMemo, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  Plus,
  Trash2,
  UserPlus,
  Wallet,
  X,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import type { Customer, ExpenseCategory } from '../types/pos';
import { formatPKDateTime, formatRs, getPKDateKey } from '../utils/formatters';

const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'Rent',
  'Electricity & Utility',
  'Staff Salary',
  'Transport & Freight',
  'Packaging & Bags',
  'Shop Maintenance',
  'Other',
];

export const CustomersExpensesView: React.FC<{ initialTab?: 'customers' | 'expenses' }> = ({
  initialTab = 'customers',
}) => {
  const {
    db,
    activeUser,
    addCustomer,
    recordCustomerPayment,
    addExpense,
    deleteExpense,
    addCashEntry,
  } = useStore();

  const isAdmin = activeUser?.role === 'Admin';
  const [tab, setTab] = useState<'customers' | 'expenses' | 'cashbook'>(initialTab);
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [payCustomer, setPayCustomer] = useState<Customer | null>(null);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showCashModal, setShowCashModal] = useState<'cash_in' | 'cash_out' | null>(null);
  const [statusMsg, setStatusMsg] = useState('');

  // Customer form
  const [cusName, setCusName] = useState('');
  const [cusPhone, setCusPhone] = useState('');
  const [cusAddress, setCusAddress] = useState('');
  const [cusLimit, setCusLimit] = useState('15000');

  // Udhar payment form
  const [udharPayAmt, setUdharPayAmt] = useState('');
  const [udharPayMethod, setUdharPayMethod] = useState('Cash');
  const [udharPayNote, setUdharPayNote] = useState('');

  // Expense form
  const [expTitle, setExpTitle] = useState('');
  const [expCategory, setExpCategory] = useState<ExpenseCategory>('Packaging & Bags');
  const [expAmount, setExpAmount] = useState('');
  const [expFromDrawer, setExpFromDrawer] = useState(true);
  const [expNote, setExpNote] = useState('');

  // Cash entry form
  const [cashCategory, setCashCategory] = useState('');
  const [cashAmount, setCashAmount] = useState('');
  const [cashDesc, setCashDesc] = useState('');

  const totalUdharReceivable = useMemo(
    () => db.customers.reduce((sum, c) => sum + c.udharBalance, 0),
    [db.customers]
  );

  const todayKey = getPKDateKey(new Date());
  const todayCashIn = useMemo(
    () =>
      db.cashEntries
        .filter((e) => getPKDateKey(e.date) === todayKey && e.type === 'cash_in')
        .reduce((sum, e) => sum + e.amount, 0),
    [db.cashEntries, todayKey]
  );
  const todayCashOut = useMemo(
    () =>
      db.cashEntries
        .filter((e) => getPKDateKey(e.date) === todayKey && e.type === 'cash_out')
        .reduce((sum, e) => sum + e.amount, 0),
    [db.cashEntries, todayKey]
  );
  const netCashDrawer = todayCashIn - todayCashOut;

  const handleAddCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cusName.trim()) return;
    const created = addCustomer({
      name: cusName.trim(),
      phone: cusPhone.trim(),
      address: cusAddress.trim(),
      udharBalance: 0,
      creditLimit: Math.max(0, Number(cusLimit) || 10000),
    });
    setCusName('');
    setCusPhone('');
    setCusAddress('');
    setShowAddCustomer(false);
    setStatusMsg(`Added customer: ${created.name}`);
  };

  const handleReceiveUdhar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payCustomer) return;
    const amt = Number(udharPayAmt) || 0;
    if (amt <= 0) return;
    recordCustomerPayment(payCustomer.id, amt, udharPayMethod, udharPayNote);
    setStatusMsg(`Received ${formatRs(amt)} Udhar payment from ${payCustomer.name}.`);
    setPayCustomer(null);
    setUdharPayAmt('');
    setUdharPayNote('');
  };

  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(expAmount) || 0;
    if (!expTitle.trim() || amt <= 0) return;
    addExpense({
      title: expTitle.trim(),
      category: expCategory,
      amount: amt,
      date: new Date().toISOString(),
      paidFromCashDrawer: expFromDrawer,
      note: expNote.trim(),
    });
    setExpTitle('');
    setExpAmount('');
    setExpNote('');
    setShowAddExpense(false);
    setStatusMsg(`Recorded expense: ${expTitle} (${formatRs(amt)})`);
  };

  const handleAddCashEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!showCashModal) return;
    const amt = Number(cashAmount) || 0;
    if (amt <= 0) return;
    addCashEntry({
      type: showCashModal,
      category:
        cashCategory.trim() ||
        (showCashModal === 'cash_in' ? 'Opening / Owner Deposit' : 'Counter Withdrawal'),
      amount: amt,
      date: new Date().toISOString(),
      description: cashDesc.trim() || 'Counter register entry',
    });
    setStatusMsg(
      `Logged ${showCashModal === 'cash_in' ? 'Cash-In' : 'Cash-Out'} of ${formatRs(amt)}.`
    );
    setShowCashModal(null);
    setCashCategory('');
    setCashAmount('');
    setCashDesc('');
  };

  return (
    <div className="space-y-5">
      {/* Header Tabs & Summary */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-center p-1 bg-slate-100 rounded-lg w-fit">
          <button
            type="button"
            onClick={() => setTab('customers')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md whitespace-nowrap ${
              tab === 'customers' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            }`}
          >
            Customers & Udhar ({db.customers.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('expenses')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md whitespace-nowrap ${
              tab === 'expenses' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            }`}
          >
            Shop Expenses ({db.expenses.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('cashbook')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md whitespace-nowrap ${
              tab === 'cashbook' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            }`}
          >
            Daily Cash-In / Cash-Out
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {tab === 'customers' && (
            <button
              type="button"
              onClick={() => setShowAddCustomer(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-emerald-700 text-white rounded-lg hover:bg-emerald-800"
            >
              <UserPlus className="w-3.5 h-3.5" />
              Add Customer
            </button>
          )}
          {tab === 'expenses' && (
            <button
              type="button"
              onClick={() => setShowAddExpense(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-emerald-700 text-white rounded-lg hover:bg-emerald-800"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Expense
            </button>
          )}
          {tab === 'cashbook' && (
            <>
              <button
                type="button"
                onClick={() => setShowCashModal('cash_in')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-emerald-700 text-white rounded-lg hover:bg-emerald-800"
              >
                <ArrowDownLeft className="w-3.5 h-3.5" />
                Cash-In
              </button>
              <button
                type="button"
                onClick={() => setShowCashModal('cash_out')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800"
              >
                <ArrowUpRight className="w-3.5 h-3.5" />
                Cash-Out
              </button>
            </>
          )}
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

      {/* Tab 1: Customers & Udhar */}
      {tab === 'customers' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="text-xs text-slate-500">Total Udhar Receivable</div>
              <div className="text-2xl font-bold font-mono-num text-red-600 mt-1">
                {formatRs(totalUdharReceivable)}
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="text-xs text-slate-500">Customers with Active Udhar</div>
              <div className="text-2xl font-bold font-mono-num text-slate-900 mt-1">
                {db.customers.filter((c) => c.udharBalance > 0).length}
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="text-xs text-slate-500">Total Registered Customers</div>
              <div className="text-2xl font-bold font-mono-num text-slate-900 mt-1">
                {db.customers.length}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {db.customers.map((cus) => (
              <div
                key={cus.id}
                className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between gap-3"
              >
                <div>
                  <h4 className="text-sm font-bold text-slate-900">{cus.name}</h4>
                  <p className="text-xs text-slate-500 mt-0.5 font-mono-num">{cus.phone}</p>
                  <p className="text-xs text-slate-500 mt-1">{cus.address || 'Local Area'}</p>
                </div>
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <div>
                    <div className="text-[11px] text-slate-500">Udhar Balance</div>
                    <div
                      className={`text-base font-bold font-mono-num ${
                        cus.udharBalance > 0 ? 'text-red-600' : 'text-emerald-700'
                      }`}
                    >
                      {formatRs(cus.udharBalance)}
                    </div>
                  </div>
                  {cus.udharBalance > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setPayCustomer(cus);
                        setUdharPayAmt(String(cus.udharBalance));
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-emerald-700 text-white rounded-lg hover:bg-emerald-800"
                    >
                      <Banknote className="w-3.5 h-3.5" />
                      Receive Payment
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Customer Udhar Transaction History */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 text-xs font-bold text-slate-800">
              Recent Udhar Khata Transactions
            </div>
            <div className="divide-y divide-slate-100 text-xs">
              {db.customerTransactions.slice(0, 12).map((trx) => (
                <div key={trx.id} className="px-4 py-2.5 flex items-center justify-between gap-3">
                  <div>
                    <span className="font-semibold text-slate-900">{trx.customerName}</span>
                    <span className="text-slate-500">
                      {' '}
                      · {trx.type === 'credit_sale' ? 'Udhar Sale' : 'Payment Received'} ·{' '}
                      {trx.note || trx.method}
                    </span>
                  </div>
                  <div className="text-right whitespace-nowrap">
                    <span
                      className={`font-mono-num font-bold ${
                        trx.type === 'credit_sale' ? 'text-red-600' : 'text-emerald-700'
                      }`}
                    >
                      {trx.type === 'credit_sale' ? '+' : '-'}
                      {formatRs(trx.amount)}
                    </span>
                    <span className="text-slate-400 ml-2">{formatPKDateTime(trx.date)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Shop Expenses */}
      {tab === 'expenses' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-3">Expense Title</th>
                  <th className="py-3 px-3">Category</th>
                  <th className="py-3 px-3">Source</th>
                  <th className="py-3 px-3 text-right">Amount</th>
                  {isAdmin && <th className="py-3 px-4 text-right">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {db.expenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                      {formatPKDateTime(exp.date)}
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-semibold text-slate-900">{exp.title}</div>
                      {exp.note && <div className="text-[11px] text-slate-500">{exp.note}</div>}
                    </td>
                    <td className="py-3 px-3 text-slate-700">{exp.category}</td>
                    <td className="py-3 px-3 text-slate-600">
                      {exp.paidFromCashDrawer ? 'Counter Cash Drawer' : 'Bank / Owner'}
                    </td>
                    <td className="py-3 px-3 text-right font-mono-num font-bold text-red-600">
                      {formatRs(exp.amount)}
                    </td>
                    {isAdmin && (
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => deleteExpense(exp.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 rounded"
                          aria-label="Delete expense"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Daily Cash-In / Cash-Out */}
      {tab === 'cashbook' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="text-xs text-slate-500">Today&apos;s Cash-In</div>
              <div className="text-2xl font-bold font-mono-num text-emerald-700 mt-1">
                {formatRs(todayCashIn)}
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="text-xs text-slate-500">Today&apos;s Cash-Out</div>
              <div className="text-2xl font-bold font-mono-num text-red-600 mt-1">
                {formatRs(todayCashOut)}
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-500">Net Counter Cash Drawer Today</div>
                <div className="text-2xl font-bold font-mono-num text-slate-900 mt-1">
                  {formatRs(netCashDrawer)}
                </div>
              </div>
              <Wallet className="w-6 h-6 text-emerald-700" />
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
                    <th className="py-3 px-4">Date & Time</th>
                    <th className="py-3 px-3">Type</th>
                    <th className="py-3 px-3">Category</th>
                    <th className="py-3 px-3">Description</th>
                    <th className="py-3 px-3">Staff</th>
                    <th className="py-3 px-4 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {db.cashEntries.map((entry) => (
                    <tr key={entry.id} className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-4 text-slate-600 whitespace-nowrap">
                        {formatPKDateTime(entry.date)}
                      </td>
                      <td className="py-2.5 px-3 font-semibold">
                        <span
                          className={
                            entry.type === 'cash_in' ? 'text-emerald-700' : 'text-red-600'
                          }
                        >
                          {entry.type === 'cash_in' ? 'Cash-In' : 'Cash-Out'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-700">{entry.category}</td>
                      <td className="py-2.5 px-3 text-slate-600">{entry.description}</td>
                      <td className="py-2.5 px-3 text-slate-500">{entry.recordedBy}</td>
                      <td
                        className={`py-2.5 px-4 text-right font-mono-num font-bold ${
                          entry.type === 'cash_in' ? 'text-emerald-700' : 'text-red-600'
                        }`}
                      >
                        {entry.type === 'cash_in' ? '+' : '-'}
                        {formatRs(entry.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Add Customer Modal */}
      {showAddCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">Add Kiryana Customer</h3>
              <button type="button" onClick={() => setShowAddCustomer(false)}>
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleAddCustomer} className="p-5 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Customer Name *</label>
                <input
                  required
                  type="text"
                  value={cusName}
                  onChange={(e) => setCusName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Phone Number *</label>
                <input
                  required
                  type="text"
                  value={cusPhone}
                  onChange={(e) => setCusPhone(e.target.value)}
                  placeholder="0300-1234567"
                  className="w-full px-3 py-2 font-mono-num border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Street / Mohalla</label>
                <input
                  type="text"
                  value={cusAddress}
                  onChange={(e) => setCusAddress(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Udhar Credit Limit (Rs.)
                </label>
                <input
                  type="number"
                  min={0}
                  value={cusLimit}
                  onChange={(e) => setCusLimit(e.target.value)}
                  className="w-full px-3 py-2 font-mono-num border border-slate-300 rounded-lg"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddCustomer(false)}
                  className="px-4 py-2 bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-700 text-white font-semibold rounded-lg"
                >
                  Save Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Receive Udhar Payment Modal */}
      {payCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">
                Receive Udhar · {payCustomer.name}
              </h3>
              <button type="button" onClick={() => setPayCustomer(null)}>
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleReceiveUdhar} className="p-5 space-y-3 text-xs">
              <div>
                Pending Udhar Balance:{' '}
                <span className="font-mono-num font-bold text-red-600">
                  {formatRs(payCustomer.udharBalance)}
                </span>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Received Amount (Rs.)
                </label>
                <input
                  required
                  type="number"
                  min={1}
                  max={payCustomer.udharBalance}
                  value={udharPayAmt}
                  onChange={(e) => setUdharPayAmt(e.target.value)}
                  className="w-full px-3 py-2 font-mono-num border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Payment Method</label>
                <select
                  value={udharPayMethod}
                  onChange={(e) => setUdharPayMethod(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                >
                  <option value="Cash">Cash (Add to Counter Drawer)</option>
                  <option value="JazzCash">JazzCash</option>
                  <option value="Easypaisa">Easypaisa</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Note</label>
                <input
                  type="text"
                  value={udharPayNote}
                  onChange={(e) => setUdharPayNote(e.target.value)}
                  placeholder="Optional receipt note"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPayCustomer(null)}
                  className="px-4 py-2 bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-700 text-white font-semibold rounded-lg"
                >
                  Save Recovery
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Expense Modal */}
      {showAddExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">Record Shop Expense</h3>
              <button type="button" onClick={() => setShowAddExpense(false)}>
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleAddExpense} className="p-5 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Expense Title *</label>
                <input
                  required
                  type="text"
                  value={expTitle}
                  onChange={(e) => setExpTitle(e.target.value)}
                  placeholder="e.g. Shop Electricity Bill, Loader Rent"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Category</label>
                <select
                  value={expCategory}
                  onChange={(e) => setExpCategory(e.target.value as ExpenseCategory)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                >
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Amount (Rs.) *</label>
                <input
                  required
                  type="number"
                  min={1}
                  value={expAmount}
                  onChange={(e) => setExpAmount(e.target.value)}
                  className="w-full px-3 py-2 font-mono-num border border-slate-300 rounded-lg"
                />
              </div>
              <label className="inline-flex items-center gap-2 text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={expFromDrawer}
                  onChange={(e) => setExpFromDrawer(e.target.checked)}
                />
                <span>Paid from Counter Cash Drawer (log Cash-Out)</span>
              </label>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Note</label>
                <input
                  type="text"
                  value={expNote}
                  onChange={(e) => setExpNote(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddExpense(false)}
                  className="px-4 py-2 bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-700 text-white font-semibold rounded-lg"
                >
                  Save Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cash-In / Cash-Out Modal */}
      {showCashModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">
                {showCashModal === 'cash_in' ? 'Record Cash-In' : 'Record Cash-Out'}
              </h3>
              <button type="button" onClick={() => setShowCashModal(null)}>
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleAddCashEntry} className="p-5 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Category</label>
                <input
                  type="text"
                  value={cashCategory}
                  onChange={(e) => setCashCategory(e.target.value)}
                  placeholder={
                    showCashModal === 'cash_in'
                      ? 'e.g. Opening Float, Owner Cash Deposit'
                      : 'e.g. Owner Withdrawal, Bank Deposit'
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Amount (Rs.) *</label>
                <input
                  required
                  type="number"
                  min={1}
                  value={cashAmount}
                  onChange={(e) => setCashAmount(e.target.value)}
                  className="w-full px-3 py-2 font-mono-num border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Description</label>
                <input
                  type="text"
                  value={cashDesc}
                  onChange={(e) => setCashDesc(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCashModal(null)}
                  className="px-4 py-2 bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-700 text-white font-semibold rounded-lg"
                >
                  Save Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
