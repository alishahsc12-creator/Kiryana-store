import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Download,
  FileSpreadsheet,
  FileText,
  Printer,
  TrendingUp,
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { useStore } from '../context/StoreContext';
import type { AppSection } from '../types/pos';
import { formatPKDate, formatPKDateTime, formatRs, getPKDateKey } from '../utils/formatters';
import { ProductImage } from './ProductImage';

type PeriodFilter = 'daily' | 'weekly' | 'monthly' | 'all';

interface DashboardReportsViewProps {
  mode: 'dashboard' | 'reports';
  onNavigate: (section: AppSection) => void;
}

export const DashboardReportsView: React.FC<DashboardReportsViewProps> = ({
  mode,
  onNavigate,
}) => {
  const { db } = useStore();
  const [period, setPeriod] = useState<PeriodFilter>(mode === 'dashboard' ? 'daily' : 'monthly');

  const todayKey = getPKDateKey(new Date());

  const periodRangeStart = useMemo(() => {
    const now = new Date();
    if (period === 'daily') {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      return d;
    }
    if (period === 'weekly') {
      const d = new Date(now);
      d.setDate(d.getDate() - 6);
      d.setHours(0, 0, 0, 0);
      return d;
    }
    if (period === 'monthly') {
      const d = new Date(now.getFullYear(), now.getMonth(), 1);
      d.setHours(0, 0, 0, 0);
      return d;
    }
    return new Date(2000, 0, 1);
  }, [period]);

  const filteredSales = useMemo(
    () =>
      db.sales.filter((s) => {
        if (period === 'daily') return getPKDateKey(s.createdAt) === todayKey;
        return new Date(s.createdAt) >= periodRangeStart;
      }),
    [db.sales, period, periodRangeStart, todayKey]
  );

  const filteredExpenses = useMemo(
    () =>
      db.expenses.filter((e) => {
        if (period === 'daily') return getPKDateKey(e.date) === todayKey;
        return new Date(e.date) >= periodRangeStart;
      }),
    [db.expenses, period, periodRangeStart, todayKey]
  );

  const filteredPurchases = useMemo(
    () =>
      db.purchases.filter((p) => {
        if (period === 'daily') return getPKDateKey(p.date) === todayKey;
        return new Date(p.date) >= periodRangeStart;
      }),
    [db.purchases, period, periodRangeStart, todayKey]
  );

  const metrics = useMemo(() => {
    const grossRevenue = filteredSales.reduce(
      (sum, s) => sum + Math.max(0, s.grandTotal - (s.returnedAmount || 0)),
      0
    );
    const totalTax = filteredSales.reduce((sum, s) => sum + (s.taxAmount || 0), 0);
    const totalDiscounts = filteredSales.reduce((sum, s) => sum + (s.billDiscountAmount || 0), 0);
    const totalReturns = filteredSales.reduce((sum, s) => sum + (s.returnedAmount || 0), 0);
    const netCOGS = filteredSales.reduce(
      (sum, s) => sum + Math.max(0, s.totalCost - (s.returnedCost || 0)),
      0
    );
    const grossTradingProfit = filteredSales.reduce((sum, s) => sum + s.netProfit, 0);
    const totalExpenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
    const netActualProfit = grossTradingProfit - totalExpenses;
    const totalPurchasesCost = filteredPurchases.reduce((sum, p) => sum + p.totalAmount, 0);

    return {
      invoiceCount: filteredSales.length,
      grossRevenue,
      totalTax,
      totalDiscounts,
      totalReturns,
      netCOGS,
      grossTradingProfit,
      totalExpenses,
      netActualProfit,
      totalPurchasesCost,
    };
  }, [filteredSales, filteredExpenses, filteredPurchases]);

  const todayMetrics = useMemo(() => {
    const todaySales = db.sales.filter((s) => getPKDateKey(s.createdAt) === todayKey);
    const todayExp = db.expenses.filter((e) => getPKDateKey(e.date) === todayKey);
    const revenue = todaySales.reduce(
      (sum, s) => sum + Math.max(0, s.grandTotal - (s.returnedAmount || 0)),
      0
    );
    const tradingProfit = todaySales.reduce((sum, s) => sum + s.netProfit, 0);
    const expenses = todayExp.reduce((sum, e) => sum + e.amount, 0);
    return {
      salesCount: todaySales.length,
      revenue,
      netProfit: tradingProfit - expenses,
      expenses,
    };
  }, [db.sales, db.expenses, todayKey]);

  const lowStockProducts = useMemo(
    () => db.products.filter((p) => p.stock <= p.minStockAlert),
    [db.products]
  );

  const inventoryValue = useMemo(
    () => db.products.reduce((sum, p) => sum + p.purchasePrice * p.stock, 0),
    [db.products]
  );

  const bestSellingProducts = useMemo(() => {
    const map = new Map<
      string,
      {
        productId: string;
        name: string;
        qtySold: number;
        revenue: number;
        profit: number;
        imageKey?: string;
      }
    >();

    for (const sale of filteredSales) {
      for (const item of sale.items) {
        const netQty = Math.max(0, item.qty - (item.returnedQty || 0));
        if (netQty <= 0) continue;
        const ratio = item.qty > 0 ? netQty / item.qty : 0;
        const existing = map.get(item.productId);
        const prod = db.products.find((p) => p.id === item.productId);
        if (existing) {
          existing.qtySold += netQty;
          existing.revenue += item.lineTotal * ratio;
          existing.profit += item.profit * ratio;
        } else {
          map.set(item.productId, {
            productId: item.productId,
            name: item.name,
            qtySold: netQty,
            revenue: item.lineTotal * ratio,
            profit: item.profit * ratio,
            imageKey: prod?.imageKey,
          });
        }
      }
    }

    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  }, [filteredSales, db.products]);

  // Last 7 days bar series
  const dailySeries = useMemo(() => {
    const days: { label: string; key: string; revenue: number; profit: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = getPKDateKey(d);
      const label = d.toLocaleDateString('en-PK', {
        day: '2-digit',
        month: 'short',
        timeZone: 'Asia/Karachi',
      });
      const daySales = db.sales.filter((s) => getPKDateKey(s.createdAt) === key);
      const revenue = daySales.reduce(
        (sum, s) => sum + Math.max(0, s.grandTotal - (s.returnedAmount || 0)),
        0
      );
      const profit = daySales.reduce((sum, s) => sum + s.netProfit, 0);
      days.push({ label, key, revenue, profit });
    }
    return days;
  }, [db.sales]);

  const maxChartRevenue = Math.max(1000, ...dailySeries.map((d) => d.revenue));

  const periodLabel =
    period === 'daily'
      ? 'Today'
      : period === 'weekly'
      ? 'Last 7 Days'
      : period === 'monthly'
      ? 'This Month'
      : 'All Time';

  const handleDownloadPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(db.settings.shopName, 14, 18);
    doc.setFontSize(10);
    doc.text(
      `Sales & Profit Report (${periodLabel}) · Generated ${formatPKDateTime(new Date())}`,
      14,
      25
    );

    autoTable(doc, {
      startY: 32,
      head: [['Financial Metric', 'Amount (PKR)']],
      body: [
        ['Invoices Count', String(metrics.invoiceCount)],
        ['Net Sales Revenue', formatRs(metrics.grossRevenue)],
        ['Cost of Goods Sold (COGS)', formatRs(metrics.netCOGS)],
        ['Gross Trading Profit (after discounts & returns)', formatRs(metrics.grossTradingProfit)],
        ['Operating Shop Expenses', formatRs(metrics.totalExpenses)],
        ['Net Actual Profit', formatRs(metrics.netActualProfit)],
        ['Stock Purchases Recorded', formatRs(metrics.totalPurchasesCost)],
      ],
      theme: 'grid',
      headStyles: { fillColor: [4, 120, 87] },
    });

    const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || 95;

    autoTable(doc, {
      startY: finalY + 10,
      head: [['Best-Selling Product', 'Units Sold', 'Revenue', 'Gross Profit']],
      body: bestSellingProducts.slice(0, 12).map((item) => [
        item.name,
        String(item.qtySold),
        formatRs(item.revenue),
        formatRs(item.profit),
      ]),
      theme: 'striped',
      headStyles: { fillColor: [15, 23, 42] },
    });

    doc.save(`asan-kiryana-report-${period}-${todayKey}.pdf`);
  };

  const handleDownloadExcel = () => {
    const summaryRows = [
      { Metric: 'Report Period', Value: periodLabel },
      { Metric: 'Total Invoices', Value: metrics.invoiceCount },
      { Metric: 'Net Sales Revenue (Rs.)', Value: metrics.grossRevenue },
      { Metric: 'Cost of Goods Sold (Rs.)', Value: metrics.netCOGS },
      { Metric: 'Gross Trading Profit (Rs.)', Value: metrics.grossTradingProfit },
      { Metric: 'Shop Expenses (Rs.)', Value: metrics.totalExpenses },
      { Metric: 'Net Actual Profit (Rs.)', Value: metrics.netActualProfit },
      { Metric: 'Purchases Total (Rs.)', Value: metrics.totalPurchasesCost },
    ];

    const salesRows = filteredSales.map((s) => ({
      InvoiceNo: s.invoiceNo,
      DateTime: formatPKDateTime(s.createdAt),
      Customer: s.customerName || 'Walk-in',
      PaymentMethod: s.paymentMethod,
      Subtotal_Rs: s.subtotal,
      Discount_Rs: s.billDiscountAmount,
      Tax_Rs: s.taxAmount,
      GrandTotal_Rs: s.grandTotal,
      Returned_Rs: s.returnedAmount || 0,
      Cost_Rs: s.totalCost - (s.returnedCost || 0),
      NetProfit_Rs: s.netProfit,
    }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), 'Profit Summary');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(salesRows), 'Sales Invoices');
    XLSX.writeFile(wb, `asan-kiryana-report-${period}-${todayKey}.xlsx`);
  };

  return (
    <div id="printable-report-area" className="space-y-5">
      {/* Period Selector & Export Actions */}
      <div className="no-print bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg w-fit">
          {(
            [
              ['daily', 'Daily (Today)'],
              ['weekly', 'Weekly (7 Days)'],
              ['monthly', 'Monthly'],
              ['all', 'All Time'],
            ] as [PeriodFilter, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setPeriod(key)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                period === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
          >
            <Printer className="w-3.5 h-3.5" />
            Print Report
          </button>
          <button
            type="button"
            onClick={handleDownloadPDF}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
          >
            <FileText className="w-3.5 h-3.5 text-red-600" />
            Download PDF
          </button>
          <button
            type="button"
            onClick={handleDownloadExcel}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-emerald-700 text-white rounded-lg hover:bg-emerald-800"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Download Excel
          </button>
        </div>
      </div>

      {/* Top KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500">
            {mode === 'dashboard' ? "Today's Sales Revenue" : `${periodLabel} Revenue`}
          </div>
          <div className="text-2xl font-extrabold font-mono-num text-slate-900 mt-1">
            {formatRs(mode === 'dashboard' ? todayMetrics.revenue : metrics.grossRevenue)}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {mode === 'dashboard'
              ? `${todayMetrics.salesCount} bills today`
              : `${metrics.invoiceCount} bills in period`}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500">
            {mode === 'dashboard' ? "Today's Net Profit" : `${periodLabel} Net Profit`}
          </div>
          <div
            className={`text-2xl font-extrabold font-mono-num mt-1 ${
              (mode === 'dashboard' ? todayMetrics.netProfit : metrics.netActualProfit) >= 0
                ? 'text-emerald-700'
                : 'text-red-600'
            }`}
          >
            {formatRs(mode === 'dashboard' ? todayMetrics.netProfit : metrics.netActualProfit)}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            After purchase cost, discounts & expenses
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500">{periodLabel} Expenses</div>
          <div className="text-2xl font-extrabold font-mono-num text-red-600 mt-1">
            {formatRs(metrics.totalExpenses)}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Purchases in period: {formatRs(metrics.totalPurchasesCost)}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500">Inventory & Low Stock</div>
          <div className="flex items-baseline gap-3 mt-1">
            <span className="text-2xl font-extrabold font-mono-num text-slate-900">
              {db.products.length}
            </span>
            <span
              className={`text-sm font-bold font-mono-num ${
                lowStockProducts.length > 0 ? 'text-red-600' : 'text-emerald-700'
              }`}
            >
              {lowStockProducts.length} Low Stock
            </span>
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Stock Cost Value: {formatRs(inventoryValue)}
          </div>
        </div>
      </div>

      {/* Purchase vs Sales Smart Profit Calculation + 7-Day Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Smart Profit Breakdown */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-900">
                Purchase vs Sales Profit ({periodLabel})
              </h3>
              <TrendingUp className="w-4 h-4 text-emerald-700" />
            </div>
            <div className="divide-y divide-slate-100 text-xs">
              <div className="py-2.5 flex justify-between">
                <span className="text-slate-600">Net Sales Revenue (after returns)</span>
                <span className="font-mono-num font-semibold text-slate-900">
                  {formatRs(metrics.grossRevenue)}
                </span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-slate-600">Discounts Given on Bills</span>
                <span className="font-mono-num text-amber-700">
                  -{formatRs(metrics.totalDiscounts)}
                </span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-slate-600">Purchase Cost of Sold Items (COGS)</span>
                <span className="font-mono-num text-slate-700">
                  -{formatRs(metrics.netCOGS)}
                </span>
              </div>
              <div className="py-2.5 flex justify-between font-semibold">
                <span className="text-slate-800">Gross Trading Profit</span>
                <span className="font-mono-num text-emerald-700">
                  {formatRs(metrics.grossTradingProfit)}
                </span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-slate-600">Shop Operating Expenses</span>
                <span className="font-mono-num text-red-600">
                  -{formatRs(metrics.totalExpenses)}
                </span>
              </div>
              <div className="py-3 flex justify-between text-sm font-bold">
                <span className="text-slate-900">Net Actual Profit</span>
                <span
                  className={`font-mono-num ${
                    metrics.netActualProfit >= 0 ? 'text-emerald-700' : 'text-red-600'
                  }`}
                >
                  {formatRs(metrics.netActualProfit)}
                </span>
              </div>
            </div>
          </div>
          <p className="text-[11px] text-slate-500 pt-2 border-t border-slate-100">
            Calculated automatically using each product&apos;s purchase price, sale price,
            bill/item discounts, customer returns, and recorded expenses.
          </p>
        </div>

        {/* 7-Day Sales & Profit Bar Chart */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Last 7 Days Sales & Profit</h3>
              <p className="text-xs text-slate-500">
                Daily counter revenue compared with trading profit (PKR)
              </p>
            </div>
            <div className="flex items-center gap-4 text-[11px] text-slate-600">
              <span>Emerald: Revenue</span>
              <span>Dark Slate: Profit</span>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-3 items-end h-52 pt-4">
            {dailySeries.map((day) => {
              const revPct = Math.round((day.revenue / maxChartRevenue) * 100);
              const profPct = Math.round((Math.max(0, day.profit) / maxChartRevenue) * 100);
              return (
                <div key={day.key} className="flex flex-col items-center h-full justify-end gap-1.5">
                  <div className="text-[10px] font-mono-num text-slate-600 font-semibold">
                    {day.revenue > 0 ? formatRs(day.revenue) : '—'}
                  </div>
                  <div className="w-full flex items-end justify-center gap-1 h-36 bg-slate-50 rounded-lg px-1.5 pt-2">
                    <div
                      style={{ height: `${Math.max(day.revenue > 0 ? 6 : 0, revPct)}%` }}
                      title={`Revenue: ${formatRs(day.revenue)}`}
                      className="w-1/2 bg-emerald-600 rounded-t transition-all"
                    />
                    <div
                      style={{ height: `${Math.max(day.profit > 0 ? 6 : 0, profPct)}%` }}
                      title={`Profit: ${formatRs(day.profit)}`}
                      className="w-1/2 bg-slate-800 rounded-t transition-all"
                    />
                  </div>
                  <div className="text-[11px] text-slate-500 whitespace-nowrap">{day.label}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Best-Selling Products & Low-Stock Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">
              Best-Selling Products ({periodLabel})
            </h3>
            <span className="text-xs text-slate-500">Ranked by revenue</span>
          </div>
          <div className="divide-y divide-slate-100 text-xs">
            {bestSellingProducts.length === 0 ? (
              <p className="p-8 text-center text-slate-500">
                No sales recorded in this date range yet.
              </p>
            ) : (
              bestSellingProducts.slice(0, 8).map((item, idx) => (
                <div key={item.productId} className="px-5 py-2.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-mono-num text-slate-400 w-4">{idx + 1}.</span>
                    <div className="w-9 h-9 rounded-md overflow-hidden border border-slate-200 shrink-0">
                      <ProductImage imageKey={item.imageKey} alt={item.name} />
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900 truncate">{item.name}</div>
                      <div className="text-[11px] text-slate-500 font-mono-num">
                        {item.qtySold} sold
                      </div>
                    </div>
                  </div>
                  <div className="text-right whitespace-nowrap">
                    <div className="font-mono-num font-bold text-slate-900">
                      {formatRs(item.revenue)}
                    </div>
                    <div className="text-[11px] font-mono-num text-emerald-700">
                      Profit: {formatRs(item.profit)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Low Stock Alert Panel */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
          <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              <h3 className="text-sm font-bold text-slate-900">Low-Stock Alerts</h3>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('products')}
              className="no-print text-xs font-semibold text-emerald-700 hover:underline"
            >
              Manage Stock
            </button>
          </div>
          <div className="divide-y divide-slate-100 text-xs flex-1">
            {lowStockProducts.length === 0 ? (
              <div className="p-8 text-center text-emerald-700 font-medium">
                All products are stocked above minimum threshold.
              </div>
            ) : (
              lowStockProducts.map((p) => (
                <div key={p.id} className="px-5 py-3 flex items-center justify-between gap-3 bg-red-50/30">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-md overflow-hidden border border-red-200 shrink-0">
                      <ProductImage imageKey={p.imageKey} alt={p.name} />
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900 truncate">{p.name}</div>
                      <div className="text-[11px] text-slate-500">
                        Min Alert: {p.minStockAlert} · {p.unit}
                      </div>
                    </div>
                  </div>
                  <div className="text-right whitespace-nowrap">
                    <span className="font-mono-num font-bold text-red-600">
                      {p.stock} left
                    </span>
                    <div className="text-[10px] font-semibold text-red-600">RESTOCK</div>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="no-print px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs">
            <span className="text-slate-600">Quick Backup Export</span>
            <a
              href="/api/backup"
              className="inline-flex items-center gap-1 font-semibold text-emerald-700 hover:underline"
            >
              <Download className="w-3.5 h-3.5" />
              Download Store Backup
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
