import React, { useState } from 'react';
import { Printer, X } from 'lucide-react';
import { resolveShopLogo } from '../assets/productImages';
import type { Sale, ShopSettings } from '../types/pos';
import { formatPKDate, formatPKTime, formatRs } from '../utils/formatters';

interface ReceiptModalProps {
  sale: Sale;
  settings: ShopSettings;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ sale, settings, onClose }) => {
  const [paperWidth, setPaperWidth] = useState<'58mm' | '80mm'>(settings.printerWidth);
  const logoSrc = resolveShopLogo(settings.logoKey);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[1px]">
      <div className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden">
        {/* Modal Toolbar */}
        <div className="no-print flex items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-slate-50">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Receipt Preview · {sale.invoiceNo}
            </h3>
            <p className="text-xs text-slate-500">Thermal printer ready ({paperWidth})</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center p-0.5 bg-slate-200/80 rounded-lg">
              <button
                type="button"
                onClick={() => setPaperWidth('58mm')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  paperWidth === '58mm'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                58mm
              </button>
              <button
                type="button"
                onClick={() => setPaperWidth('80mm')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  paperWidth === '80mm'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                80mm
              </button>
            </div>
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-700 text-white text-xs font-semibold rounded-lg hover:bg-emerald-800 transition-colors whitespace-nowrap"
            >
              <Printer className="w-3.5 h-3.5" />
              Print Receipt
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close receipt preview"
              className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-200/70 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Thermal Receipt Scroll Canvas */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-100 flex justify-center">
          <div
            id="printable-receipt-area"
            style={{ width: paperWidth === '58mm' ? '220px' : '302px' }}
            className="bg-white text-slate-950 p-4 border border-slate-300 shadow-sm font-mono text-[11px] leading-snug h-fit"
          >
            {/* Shop Header */}
            <div className="text-center pb-2.5 border-b border-dashed border-slate-400">
              <img
                src={logoSrc}
                alt={settings.shopName}
                referrerPolicy="no-referrer"
                className="w-10 h-10 object-contain mx-auto mb-1.5 rounded"
              />
              <div className="font-bold text-[13px] tracking-tight uppercase">
                {settings.shopName}
              </div>
              <div className="text-[10px] text-slate-700 mt-0.5">{settings.address}</div>
              <div className="text-[10px] text-slate-700">Tel: {settings.phone}</div>
              {settings.ntnNumber && (
                <div className="text-[10px] text-slate-600">NTN: {settings.ntnNumber}</div>
              )}
            </div>

            {/* Invoice Metadata */}
            <div className="py-2 border-b border-dashed border-slate-400 text-[10px] space-y-0.5">
              <div className="flex justify-between">
                <span>Invoice:</span>
                <span className="font-semibold">{sale.invoiceNo}</span>
              </div>
              <div className="flex justify-between">
                <span>Date:</span>
                <span>{formatPKDate(sale.createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span>Time:</span>
                <span>{formatPKTime(sale.createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span>Cashier:</span>
                <span className="truncate max-w-[140px]">{sale.cashierName}</span>
              </div>
              {sale.customerName && (
                <div className="flex justify-between">
                  <span>Customer:</span>
                  <span className="font-semibold truncate max-w-[140px]">{sale.customerName}</span>
                </div>
              )}
            </div>

            {/* Line Items */}
            <div className="py-2 border-b border-dashed border-slate-400">
              <div className="flex justify-between font-bold text-[10px] pb-1 border-b border-slate-300 mb-1">
                <span>ITEM</span>
                <span>TOTAL</span>
              </div>
              <div className="space-y-1.5">
                {sale.items.map((item) => (
                  <div key={item.productId} className="text-[10px]">
                    <div className="font-semibold leading-tight">{item.name}</div>
                    <div className="flex justify-between text-slate-700">
                      <span>
                        {item.qty} x {formatRs(item.salePrice)}
                        {item.discount > 0 ? ` (-${formatRs(item.discount)})` : ''}
                      </span>
                      <span className="font-semibold text-slate-950">
                        {formatRs(item.lineTotal)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Totals */}
            <div className="py-2 border-b border-dashed border-slate-400 space-y-1 text-[10px]">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>{formatRs(sale.subtotal)}</span>
              </div>
              {sale.billDiscountAmount > 0 && (
                <div className="flex justify-between">
                  <span>Discount:</span>
                  <span>-{formatRs(sale.billDiscountAmount)}</span>
                </div>
              )}
              {sale.taxEnabled && sale.taxAmount > 0 && (
                <div className="flex justify-between">
                  <span>Tax ({sale.taxRate}%):</span>
                  <span>{formatRs(sale.taxAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-[13px] font-bold pt-1 border-t border-slate-300">
                <span>GRAND TOTAL:</span>
                <span>{formatRs(sale.grandTotal)}</span>
              </div>
            </div>

            {/* Payment Details */}
            <div className="py-2 border-b border-dashed border-slate-400 space-y-0.5 text-[10px]">
              <div className="flex justify-between">
                <span>Payment Mode:</span>
                <span className="font-semibold">{sale.paymentMethod}</span>
              </div>
              <div className="flex justify-between">
                <span>Amount Received:</span>
                <span>{formatRs(sale.amountReceived)}</span>
              </div>
              {sale.paymentMethod === 'Cash' && (
                <div className="flex justify-between font-bold">
                  <span>Return Balance:</span>
                  <span>{formatRs(sale.changeReturned)}</span>
                </div>
              )}
              {sale.paymentMethod === 'Udhar (Credit)' &&
                sale.grandTotal - sale.amountReceived > 0 && (
                  <div className="flex justify-between font-bold">
                    <span>Udhar Balance Added:</span>
                    <span>{formatRs(sale.grandTotal - sale.amountReceived)}</span>
                  </div>
                )}
            </div>

            {/* Footer */}
            <div className="pt-2.5 text-center text-[10px] text-slate-700 space-y-1">
              <p>{settings.receiptFooter}</p>
              <p className="text-[9px] text-slate-500 pt-1">Counter Billing – Asan Kiryana</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
