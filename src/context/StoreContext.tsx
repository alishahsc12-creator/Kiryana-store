import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createInitialSeedDatabase } from '../data/seedData';
import type {
  CartItem,
  CashEntry,
  Customer,
  Expense,
  HeldBill,
  PaymentMethod,
  Product,
  Purchase,
  PurchaseItem,
  Sale,
  SaleItem,
  ShopSettings,
  StockAdjustment,
  StoreDatabase,
  Supplier,
  UserAccount,
} from '../types/pos';
import { generateId, generateInvoiceNumber } from '../utils/formatters';

const LOCAL_STORAGE_KEY = 'asan_kiryana_db_v1';
const LOCAL_BACKUP_KEY = 'asan_kiryana_autobackup_v1';
const SESSION_KEY = 'asan_kiryana_session_v1';

interface CompleteSaleInput {
  items: CartItem[];
  discountType: 'flat' | 'percent';
  discountValue: number;
  taxEnabled: boolean;
  taxRate: number;
  paymentMethod: PaymentMethod;
  amountReceived: number;
  customerId?: string;
  notes?: string;
}

interface StoreContextValue {
  db: StoreDatabase;
  activeUser: UserAccount | null;
  isLoading: boolean;
  lastBackupStatus: string;
  loginUser: (username: string, pin: string) => { ok: boolean; error?: string };
  logoutUser: () => void;
  switchUserQuick: (userId: string, pin: string) => { ok: boolean; error?: string };

  // POS & Sales
  completeSale: (input: CompleteSaleInput) => { ok: boolean; sale?: Sale; error?: string };
  processSaleReturn: (
    saleId: string,
    itemsToReturn: { productId: string; qty: number }[],
    reason: string
  ) => { ok: boolean; error?: string };
  holdBill: (bill: Omit<HeldBill, 'id' | 'createdAt'>) => HeldBill;
  deleteHeldBill: (id: string) => void;

  // Products & Stock
  addProduct: (product: Omit<Product, 'id' | 'updatedAt' | 'damagedQty'>) => Product;
  updateProduct: (id: string, patch: Partial<Product>) => void;
  deleteProduct: (id: string) => void;
  importProductsBulk: (items: Omit<Product, 'id' | 'updatedAt' | 'damagedQty'>[]) => number;
  adjustStock: (
    productId: string,
    type: StockAdjustment['type'],
    qtyDelta: number,
    reason: string
  ) => void;

  // Suppliers & Purchases
  addSupplier: (supplier: Omit<Supplier, 'id' | 'createdAt'>) => Supplier;
  updateSupplier: (id: string, patch: Partial<Supplier>) => void;
  recordPurchase: (input: {
    supplierId: string;
    invoiceNo: string;
    items: PurchaseItem[];
    paidAmount: number;
    paymentMethod: Purchase['paymentMethod'];
    notes?: string;
  }) => Purchase;
  recordSupplierPayment: (
    supplierId: string,
    amount: number,
    method: 'Cash' | 'Bank/JazzCash',
    note?: string
  ) => void;

  // Customers & Udhar
  addCustomer: (customer: Omit<Customer, 'id' | 'createdAt'>) => Customer;
  updateCustomer: (id: string, patch: Partial<Customer>) => void;
  recordCustomerPayment: (
    customerId: string,
    amount: number,
    method: string,
    note?: string
  ) => void;

  // Expenses & Cash Drawer
  addExpense: (expense: Omit<Expense, 'id' | 'recordedBy'>) => Expense;
  deleteExpense: (id: string) => void;
  addCashEntry: (entry: Omit<CashEntry, 'id' | 'recordedBy'>) => CashEntry;

  // Settings, Users & Backup
  updateSettings: (patch: Partial<ShopSettings>) => void;
  addUser: (user: Omit<UserAccount, 'id'>) => void;
  updateUser: (id: string, patch: Partial<UserAccount>) => void;
  deleteUser: (id: string) => void;
  restoreFromBackup: (data: StoreDatabase) => Promise<{ ok: boolean; error?: string }>;
  resetToDemoSeed: () => Promise<void>;
}

const StoreContext = createContext<StoreContextValue | null>(null);

function loadInitialLocalDb(): StoreDatabase {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as StoreDatabase;
      if (parsed && Array.isArray(parsed.products) && parsed.settings) {
        return parsed;
      }
    }
    const backupRaw = localStorage.getItem(LOCAL_BACKUP_KEY);
    if (backupRaw) {
      const parsedBackup = JSON.parse(backupRaw) as StoreDatabase;
      if (parsedBackup && Array.isArray(parsedBackup.products)) {
        return parsedBackup;
      }
    }
  } catch {
    // Fallback to seed
  }
  return createInitialSeedDatabase();
}

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [db, setDb] = useState<StoreDatabase>(() => loadInitialLocalDb());
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [lastBackupStatus, setLastBackupStatus] = useState<string>('Auto-saved locally');

  const [activeUserId, setActiveUserId] = useState<string | null>(() => {
    try {
      const saved = localStorage.getItem(SESSION_KEY);
      if (saved === '__LOGGED_OUT__') return null;
      if (saved) return saved;
    } catch {
      // ignore
    }
    return 'usr_admin';
  });

  const dbRef = useRef<StoreDatabase>(db);
  dbRef.current = db;

  const saveTimerRef = useRef<number | null>(null);

  const persistToServer = useCallback(async (payload: StoreDatabase) => {
    try {
      const res = await fetch('/api/store', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const json = (await res.json()) as { lastSavedAt?: string };
        setLastBackupStatus(
          `Synced ${new Date(json.lastSavedAt || Date.now()).toLocaleTimeString('en-PK', {
            hour: '2-digit',
            minute: '2-digit',
          })}`
        );
      }
    } catch {
      setLastBackupStatus('Saved offline (local backup)');
    }
  }, []);

  const commitDb = useCallback(
    (updater: (prev: StoreDatabase) => StoreDatabase) => {
      setDb((prev) => {
        const next: StoreDatabase = {
          ...updater(prev),
          lastSavedAt: new Date().toISOString(),
        };
        try {
          const serialized = JSON.stringify(next);
          localStorage.setItem(LOCAL_STORAGE_KEY, serialized);
          localStorage.setItem(LOCAL_BACKUP_KEY, serialized);
        } catch {
          // Storage quota fallback
        }
        if (saveTimerRef.current) {
          window.clearTimeout(saveTimerRef.current);
        }
        saveTimerRef.current = window.setTimeout(() => {
          void persistToServer(next);
        }, 250);
        return next;
      });
    },
    [persistToServer]
  );

  // Sync on mount from Express server disk store
  useEffect(() => {
    let cancelled = false;
    async function hydrate() {
      try {
        const res = await fetch('/api/store');
        if (res.ok) {
          const serverDb = (await res.json()) as StoreDatabase;
          if (!cancelled && serverDb && Array.isArray(serverDb.products)) {
            setDb(serverDb);
            try {
              const serialized = JSON.stringify(serverDb);
              localStorage.setItem(LOCAL_STORAGE_KEY, serialized);
              localStorage.setItem(LOCAL_BACKUP_KEY, serialized);
            } catch {
              // ignore
            }
            setLastBackupStatus('Disk & local backup active');
          }
        }
      } catch {
        setLastBackupStatus('Offline local storage active');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void hydrate();

    const handleBeforeUnload = () => {
      try {
        const serialized = JSON.stringify(dbRef.current);
        localStorage.setItem(LOCAL_STORAGE_KEY, serialized);
        localStorage.setItem(LOCAL_BACKUP_KEY, serialized);
        navigator.sendBeacon?.(
          '/api/store',
          new Blob([serialized], { type: 'application/json' })
        );
      } catch {
        // ignore
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      cancelled = true;
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  const activeUser =
    activeUserId ? db.users.find((u) => u.id === activeUserId && u.active) ?? null : null;

  const loginUser = useCallback(
    (username: string, pin: string) => {
      const normalized = username.trim().toLowerCase();
      const found = db.users.find(
        (u) => u.active && u.username.toLowerCase() === normalized && u.pin === pin.trim()
      );
      if (!found) {
        return { ok: false, error: 'Invalid username or PIN. Check your counter credentials.' };
      }
      setActiveUserId(found.id);
      localStorage.setItem(SESSION_KEY, found.id);
      return { ok: true };
    },
    [db.users]
  );

  const switchUserQuick = useCallback(
    (userId: string, pin: string) => {
      const found = db.users.find((u) => u.active && u.id === userId && u.pin === pin.trim());
      if (!found) {
        return { ok: false, error: 'Incorrect PIN for selected user.' };
      }
      setActiveUserId(found.id);
      localStorage.setItem(SESSION_KEY, found.id);
      return { ok: true };
    },
    [db.users]
  );

  const logoutUser = useCallback(() => {
    setActiveUserId(null);
    localStorage.setItem(SESSION_KEY, '__LOGGED_OUT__');
  }, []);

  const completeSale = useCallback(
    (input: CompleteSaleInput) => {
      if (input.items.length === 0) {
        return { ok: false, error: 'Cart is empty. Add items before billing.' };
      }

      const currentProducts = dbRef.current.products;
      for (const cartItem of input.items) {
        const prod = currentProducts.find((p) => p.id === cartItem.productId);
        if (!prod) {
          return { ok: false, error: `Product "${cartItem.name}" no longer exists.` };
        }
        if (cartItem.qty <= 0) {
          return { ok: false, error: `Invalid quantity for "${cartItem.name}".` };
        }
        if (cartItem.qty > prod.stock) {
          return {
            ok: false,
            error: `Insufficient stock for ${prod.name}. Available: ${prod.stock}`,
          };
        }
      }

      if (input.paymentMethod === 'Udhar (Credit)' && !input.customerId) {
        return { ok: false, error: 'Please select a customer for Udhar (Credit) billing.' };
      }

      const saleItems: SaleItem[] = input.items.map((item) => {
        const grossLine = item.salePrice * item.qty;
        const lineDiscount = Math.min(grossLine, Math.max(0, item.discount || 0));
        const lineTotal = Math.max(0, grossLine - lineDiscount);
        const costTotal = item.purchasePrice * item.qty;
        return {
          productId: item.productId,
          name: item.name,
          barcode: item.barcode,
          unit: item.unit,
          purchasePrice: item.purchasePrice,
          salePrice: item.salePrice,
          qty: item.qty,
          discount: lineDiscount,
          lineTotal,
          costTotal,
          profit: lineTotal - costTotal,
          returnedQty: 0,
        };
      });

      const subtotal = saleItems.reduce((sum, i) => sum + i.lineTotal, 0);
      const rawDiscount =
        input.discountType === 'percent'
          ? (subtotal * Math.max(0, Math.min(100, input.discountValue))) / 100
          : Math.max(0, input.discountValue);
      const billDiscountAmount = Math.min(subtotal, Math.round(rawDiscount * 100) / 100);
      const taxableAmount = Math.max(0, subtotal - billDiscountAmount);
      const taxAmount = input.taxEnabled
        ? Math.round(((taxableAmount * Math.max(0, input.taxRate)) / 100) * 100) / 100
        : 0;
      const grandTotal = Math.round((taxableAmount + taxAmount) * 100) / 100;
      const totalCost = saleItems.reduce((sum, i) => sum + i.costTotal, 0);
      const netProfit = Math.round((taxableAmount - totalCost) * 100) / 100;

      const received = Math.max(0, input.amountReceived || 0);
      if (input.paymentMethod !== 'Udhar (Credit)' && received < grandTotal) {
        return {
          ok: false,
          error: `Received amount is less than Grand Total (Rs. ${grandTotal}).`,
        };
      }

      const changeReturned =
        input.paymentMethod === 'Cash' ? Math.max(0, Math.round((received - grandTotal) * 100) / 100) : 0;

      const customer = input.customerId
        ? dbRef.current.customers.find((c) => c.id === input.customerId)
        : undefined;

      const nowISO = new Date().toISOString();
      const invoiceNo = generateInvoiceNumber(dbRef.current.sales.length, 'AK');
      const cashierName = activeUser?.displayName ?? 'Counter Staff';

      const newSale: Sale = {
        id: generateId('sal'),
        invoiceNo,
        createdAt: nowISO,
        items: saleItems,
        subtotal,
        discountType: input.discountType,
        discountValue: input.discountValue,
        billDiscountAmount,
        taxEnabled: input.taxEnabled,
        taxRate: input.taxRate,
        taxAmount,
        grandTotal,
        paymentMethod: input.paymentMethod,
        amountReceived: received,
        changeReturned,
        customerId: customer?.id,
        customerName: customer?.name,
        cashierName,
        totalCost,
        netProfit,
        returnedAmount: 0,
        returnedCost: 0,
        returns: [],
        notes: input.notes,
      };

      commitDb((prev) => {
        const updatedProducts = prev.products.map((prod) => {
          const sold = saleItems.find((s) => s.productId === prod.id);
          if (!sold) return prod;
          return {
            ...prod,
            stock: Math.max(0, prod.stock - sold.qty),
            updatedAt: nowISO,
          };
        });

        let updatedCustomers = prev.customers;
        let updatedCustomerTrx = prev.customerTransactions;
        const udharAdded =
          input.paymentMethod === 'Udhar (Credit)'
            ? Math.max(0, Math.round((grandTotal - received) * 100) / 100)
            : 0;

        if (customer && udharAdded > 0) {
          updatedCustomers = prev.customers.map((c) =>
            c.id === customer.id ? { ...c, udharBalance: c.udharBalance + udharAdded } : c
          );
          updatedCustomerTrx = [
            {
              id: generateId('ctrx'),
              customerId: customer.id,
              customerName: customer.name,
              date: nowISO,
              type: 'credit_sale',
              amount: udharAdded,
              invoiceNo,
              method: 'Udhar (Credit)',
              note:
                received > 0
                  ? `Spot paid Rs. ${received}, Udhar Rs. ${udharAdded}`
                  : 'Full bill added to Udhar ledger',
            },
            ...prev.customerTransactions,
          ];
        }

        let updatedCashEntries = prev.cashEntries;
        const cashCollected =
          input.paymentMethod === 'Cash'
            ? grandTotal
            : input.paymentMethod === 'Udhar (Credit)'
            ? Math.min(grandTotal, received)
            : 0;

        if (cashCollected > 0) {
          updatedCashEntries = [
            {
              id: generateId('csh'),
              type: 'cash_in',
              category:
                input.paymentMethod === 'Udhar (Credit)'
                  ? 'Udhar Spot Payment'
                  : 'Counter Cash Sale',
              amount: cashCollected,
              date: nowISO,
              description: `Invoice ${invoiceNo}${customer ? ` · ${customer.name}` : ''}`,
              refId: newSale.id,
              recordedBy: cashierName,
            },
            ...prev.cashEntries,
          ];
        }

        return {
          ...prev,
          products: updatedProducts,
          sales: [newSale, ...prev.sales],
          customers: updatedCustomers,
          customerTransactions: updatedCustomerTrx,
          cashEntries: updatedCashEntries,
        };
      });

      return { ok: true, sale: newSale };
    },
    [activeUser, commitDb]
  );

  const processSaleReturn = useCallback(
    (saleId: string, itemsToReturn: { productId: string; qty: number }[], reason: string) => {
      const targetSale = dbRef.current.sales.find((s) => s.id === saleId);
      if (!targetSale) return { ok: false, error: 'Sale invoice not found.' };

      const validReturns = itemsToReturn.filter((r) => r.qty > 0);
      if (validReturns.length === 0) {
        return { ok: false, error: 'Select at least 1 item quantity to return.' };
      }

      const discountRatio =
        targetSale.subtotal > 0 ? (targetSale.subtotal - targetSale.billDiscountAmount) / targetSale.subtotal : 1;

      const returnItemsDetail: {
        productId: string;
        name: string;
        qty: number;
        refundAmount: number;
        costAmount: number;
      }[] = [];

      for (const req of validReturns) {
        const line = targetSale.items.find((i) => i.productId === req.productId);
        if (!line) return { ok: false, error: 'Item not found in invoice.' };
        const alreadyReturned = line.returnedQty || 0;
        const maxReturnable = line.qty - alreadyReturned;
        if (req.qty > maxReturnable) {
          return {
            ok: false,
            error: `Cannot return ${req.qty} of ${line.name}. Max returnable: ${maxReturnable}.`,
          };
        }
        const unitNetSale = (line.lineTotal / line.qty) * discountRatio;
        const refundAmount = Math.round(unitNetSale * req.qty * 100) / 100;
        const costAmount = line.purchasePrice * req.qty;
        returnItemsDetail.push({
          productId: line.productId,
          name: line.name,
          qty: req.qty,
          refundAmount,
          costAmount,
        });
      }

      const totalRefund = Math.round(
        returnItemsDetail.reduce((sum, i) => sum + i.refundAmount, 0) * 100
      ) / 100;
      const totalCostRestored = returnItemsDetail.reduce((sum, i) => sum + i.costAmount, 0);
      const nowISO = new Date().toISOString();
      const cashierName = activeUser?.displayName ?? 'Counter Staff';

      commitDb((prev) => {
        const updatedProducts = prev.products.map((p) => {
          const ret = returnItemsDetail.find((r) => r.productId === p.id);
          if (!ret) return p;
          return { ...p, stock: p.stock + ret.qty, updatedAt: nowISO };
        });

        const updatedSales = prev.sales.map((s) => {
          if (s.id !== saleId) return s;
          const updatedItems = s.items.map((line) => {
            const ret = returnItemsDetail.find((r) => r.productId === line.productId);
            if (!ret) return line;
            return { ...line, returnedQty: (line.returnedQty || 0) + ret.qty };
          });
          const newReturnedAmount = (s.returnedAmount || 0) + totalRefund;
          const newReturnedCost = (s.returnedCost || 0) + totalCostRestored;
          const profitReversal = totalRefund - totalCostRestored;
          return {
            ...s,
            items: updatedItems,
            returnedAmount: newReturnedAmount,
            returnedCost: newReturnedCost,
            netProfit: Math.round((s.netProfit - profitReversal) * 100) / 100,
            returns: [
              ...(s.returns || []),
              {
                id: generateId('ret'),
                date: nowISO,
                items: returnItemsDetail,
                totalRefund,
                reason: reason.trim() || 'Customer counter return',
                processedBy: cashierName,
              },
            ],
          };
        });

        let updatedCustomers = prev.customers;
        let updatedCustomerTrx = prev.customerTransactions;
        let updatedCashEntries = prev.cashEntries;

        if (targetSale.paymentMethod === 'Udhar (Credit)' && targetSale.customerId) {
          updatedCustomers = prev.customers.map((c) =>
            c.id === targetSale.customerId
              ? { ...c, udharBalance: Math.max(0, c.udharBalance - totalRefund) }
              : c
          );
          updatedCustomerTrx = [
            {
              id: generateId('ctrx'),
              customerId: targetSale.customerId,
              customerName: targetSale.customerName || 'Customer',
              date: nowISO,
              type: 'payment_received',
              amount: totalRefund,
              invoiceNo: targetSale.invoiceNo,
              method: 'Sales Return',
              note: `Return credit for ${targetSale.invoiceNo}: ${reason || 'Returned items'}`,
            },
            ...prev.customerTransactions,
          ];
        } else {
          updatedCashEntries = [
            {
              id: generateId('csh'),
              type: 'cash_out',
              category: 'Sales Return Refund',
              amount: totalRefund,
              date: nowISO,
              description: `Refund on ${targetSale.invoiceNo}: ${reason || 'Customer return'}`,
              refId: targetSale.id,
              recordedBy: cashierName,
            },
            ...prev.cashEntries,
          ];
        }

        return {
          ...prev,
          products: updatedProducts,
          sales: updatedSales,
          customers: updatedCustomers,
          customerTransactions: updatedCustomerTrx,
          cashEntries: updatedCashEntries,
        };
      });

      return { ok: true };
    },
    [activeUser, commitDb]
  );

  const holdBill = useCallback(
    (bill: Omit<HeldBill, 'id' | 'createdAt'>) => {
      const held: HeldBill = {
        ...bill,
        id: generateId('hold'),
        createdAt: new Date().toISOString(),
      };
      commitDb((prev) => ({
        ...prev,
        heldBills: [held, ...prev.heldBills],
      }));
      return held;
    },
    [commitDb]
  );

  const deleteHeldBill = useCallback(
    (id: string) => {
      commitDb((prev) => ({
        ...prev,
        heldBills: prev.heldBills.filter((b) => b.id !== id),
      }));
    },
    [commitDb]
  );

  const addProduct = useCallback(
    (product: Omit<Product, 'id' | 'updatedAt' | 'damagedQty'>) => {
      const newProd: Product = {
        ...product,
        id: generateId('prd'),
        damagedQty: 0,
        updatedAt: new Date().toISOString(),
      };
      commitDb((prev) => ({
        ...prev,
        products: [newProd, ...prev.products],
      }));
      return newProd;
    },
    [commitDb]
  );

  const updateProduct = useCallback(
    (id: string, patch: Partial<Product>) => {
      commitDb((prev) => ({
        ...prev,
        products: prev.products.map((p) =>
          p.id === id ? { ...p, ...patch, updatedAt: new Date().toISOString() } : p
        ),
      }));
    },
    [commitDb]
  );

  const deleteProduct = useCallback(
    (id: string) => {
      commitDb((prev) => ({
        ...prev,
        products: prev.products.filter((p) => p.id !== id),
      }));
    },
    [commitDb]
  );

  const importProductsBulk = useCallback(
    (items: Omit<Product, 'id' | 'updatedAt' | 'damagedQty'>[]) => {
      const nowISO = new Date().toISOString();
      let importedCount = 0;
      commitDb((prev) => {
        const nextProducts = [...prev.products];
        for (const item of items) {
          if (!item.name.trim()) continue;
          const existingIdx = nextProducts.findIndex(
            (p) =>
              (item.barcode && p.barcode === item.barcode) ||
              p.name.toLowerCase() === item.name.trim().toLowerCase()
          );
          if (existingIdx >= 0) {
            nextProducts[existingIdx] = {
              ...nextProducts[existingIdx],
              ...item,
              updatedAt: nowISO,
            };
          } else {
            nextProducts.unshift({
              ...item,
              id: generateId('prd'),
              damagedQty: 0,
              updatedAt: nowISO,
            });
          }
          importedCount++;
        }
        return { ...prev, products: nextProducts };
      });
      return importedCount;
    },
    [commitDb]
  );

  const adjustStock = useCallback(
    (productId: string, type: StockAdjustment['type'], qtyDelta: number, reason: string) => {
      const nowISO = new Date().toISOString();
      const byUser = activeUser?.displayName ?? 'Admin';
      commitDb((prev) => {
        const target = prev.products.find((p) => p.id === productId);
        if (!target) return prev;
        const nextStock = Math.max(0, target.stock + qtyDelta);
        const damageIncrement =
          (type === 'damage' || type === 'expiry') && qtyDelta < 0 ? Math.abs(qtyDelta) : 0;

        return {
          ...prev,
          products: prev.products.map((p) =>
            p.id === productId
              ? {
                  ...p,
                  stock: nextStock,
                  damagedQty: p.damagedQty + damageIncrement,
                  updatedAt: nowISO,
                }
              : p
          ),
          stockAdjustments: [
            {
              id: generateId('adj'),
              productId,
              productName: target.name,
              type,
              qtyDelta,
              reason: reason.trim() || type,
              date: nowISO,
              byUser,
            },
            ...prev.stockAdjustments,
          ],
        };
      });
    },
    [activeUser, commitDb]
  );

  const addSupplier = useCallback(
    (supplier: Omit<Supplier, 'id' | 'createdAt'>) => {
      const created: Supplier = {
        ...supplier,
        id: generateId('sup'),
        createdAt: new Date().toISOString(),
      };
      commitDb((prev) => ({
        ...prev,
        suppliers: [created, ...prev.suppliers],
      }));
      return created;
    },
    [commitDb]
  );

  const updateSupplier = useCallback(
    (id: string, patch: Partial<Supplier>) => {
      commitDb((prev) => ({
        ...prev,
        suppliers: prev.suppliers.map((s) => (s.id === id ? { ...s, ...patch } : s)),
      }));
    },
    [commitDb]
  );

  const recordPurchase = useCallback(
    (input: {
      supplierId: string;
      invoiceNo: string;
      items: PurchaseItem[];
      paidAmount: number;
      paymentMethod: Purchase['paymentMethod'];
      notes?: string;
    }) => {
      const nowISO = new Date().toISOString();
      const supplier = dbRef.current.suppliers.find((s) => s.id === input.supplierId);
      const totalAmount = input.items.reduce((sum, i) => sum + i.lineTotal, 0);
      const paidAmount = Math.max(0, Math.min(totalAmount, input.paidAmount));
      const balanceDue = Math.max(0, totalAmount - paidAmount);
      const purchase: Purchase = {
        id: generateId('pur'),
        invoiceNo: input.invoiceNo.trim() || `PO-${Date.now().toString().slice(-6)}`,
        supplierId: input.supplierId,
        supplierName: supplier?.company || supplier?.name || 'Wholesale Supplier',
        date: nowISO,
        items: input.items,
        totalAmount,
        paidAmount,
        balanceDue,
        paymentMethod: input.paymentMethod,
        notes: input.notes,
      };

      const byUser = activeUser?.displayName ?? 'Admin';
      commitDb((prev) => {
        const updatedProducts = prev.products.map((prod) => {
          const line = input.items.find((i) => i.productId === prod.id);
          if (!line) return prod;
          return {
            ...prod,
            stock: prod.stock + line.qty,
            purchasePrice: line.unitCost > 0 ? line.unitCost : prod.purchasePrice,
            updatedAt: nowISO,
          };
        });

        const updatedSuppliers = prev.suppliers.map((s) =>
          s.id === input.supplierId ? { ...s, balanceOwed: s.balanceOwed + balanceDue } : s
        );

        const nextCashEntries =
          input.paymentMethod === 'Cash' && paidAmount > 0
            ? [
                {
                  id: generateId('csh'),
                  type: 'cash_out' as const,
                  category: 'Supplier Purchase',
                  amount: paidAmount,
                  date: nowISO,
                  description: `${purchase.invoiceNo} · ${purchase.supplierName}`,
                  refId: purchase.id,
                  recordedBy: byUser,
                },
                ...prev.cashEntries,
              ]
            : prev.cashEntries;

        return {
          ...prev,
          products: updatedProducts,
          suppliers: updatedSuppliers,
          purchases: [purchase, ...prev.purchases],
          cashEntries: nextCashEntries,
        };
      });

      return purchase;
    },
    [activeUser, commitDb]
  );

  const recordSupplierPayment = useCallback(
    (supplierId: string, amount: number, method: 'Cash' | 'Bank/JazzCash', note?: string) => {
      if (amount <= 0) return;
      const nowISO = new Date().toISOString();
      const byUser = activeUser?.displayName ?? 'Admin';
      commitDb((prev) => {
        const supplier = prev.suppliers.find((s) => s.id === supplierId);
        if (!supplier) return prev;
        const payAmount = Math.min(amount, supplier.balanceOwed > 0 ? supplier.balanceOwed : amount);
        return {
          ...prev,
          suppliers: prev.suppliers.map((s) =>
            s.id === supplierId
              ? { ...s, balanceOwed: Math.max(0, s.balanceOwed - payAmount) }
              : s
          ),
          supplierPayments: [
            {
              id: generateId('spay'),
              supplierId,
              supplierName: supplier.company || supplier.name,
              date: nowISO,
              amount: payAmount,
              method,
              note,
            },
            ...prev.supplierPayments,
          ],
          cashEntries:
            method === 'Cash'
              ? [
                  {
                    id: generateId('csh'),
                    type: 'cash_out',
                    category: 'Supplier Payment',
                    amount: payAmount,
                    date: nowISO,
                    description: `Paid ${supplier.company || supplier.name}${note ? ` (${note})` : ''}`,
                    recordedBy: byUser,
                  },
                  ...prev.cashEntries,
                ]
              : prev.cashEntries,
        };
      });
    },
    [activeUser, commitDb]
  );

  const addCustomer = useCallback(
    (customer: Omit<Customer, 'id' | 'createdAt'>) => {
      const created: Customer = {
        ...customer,
        id: generateId('cus'),
        createdAt: new Date().toISOString(),
      };
      commitDb((prev) => ({
        ...prev,
        customers: [created, ...prev.customers],
      }));
      return created;
    },
    [commitDb]
  );

  const updateCustomer = useCallback(
    (id: string, patch: Partial<Customer>) => {
      commitDb((prev) => ({
        ...prev,
        customers: prev.customers.map((c) => (c.id === id ? { ...c, ...patch } : c)),
      }));
    },
    [commitDb]
  );

  const recordCustomerPayment = useCallback(
    (customerId: string, amount: number, method: string, note?: string) => {
      if (amount <= 0) return;
      const nowISO = new Date().toISOString();
      const byUser = activeUser?.displayName ?? 'Counter Staff';
      commitDb((prev) => {
        const customer = prev.customers.find((c) => c.id === customerId);
        if (!customer) return prev;
        return {
          ...prev,
          customers: prev.customers.map((c) =>
            c.id === customerId
              ? { ...c, udharBalance: Math.max(0, c.udharBalance - amount) }
              : c
          ),
          customerTransactions: [
            {
              id: generateId('ctrx'),
              customerId,
              customerName: customer.name,
              date: nowISO,
              type: 'payment_received',
              amount,
              method,
              note: note || 'Udhar recovery payment',
            },
            ...prev.customerTransactions,
          ],
          cashEntries:
            method === 'Cash'
              ? [
                  {
                    id: generateId('csh'),
                    type: 'cash_in',
                    category: 'Udhar Recovery',
                    amount,
                    date: nowISO,
                    description: `Udhar received from ${customer.name}`,
                    recordedBy: byUser,
                  },
                  ...prev.cashEntries,
                ]
              : prev.cashEntries,
        };
      });
    },
    [activeUser, commitDb]
  );

  const addExpense = useCallback(
    (expense: Omit<Expense, 'id' | 'recordedBy'>) => {
      const byUser = activeUser?.displayName ?? 'Admin';
      const created: Expense = {
        ...expense,
        id: generateId('exp'),
        recordedBy: byUser,
      };
      commitDb((prev) => ({
        ...prev,
        expenses: [created, ...prev.expenses],
        cashEntries: expense.paidFromCashDrawer
          ? [
              {
                id: generateId('csh'),
                type: 'cash_out',
                category: `Expense · ${expense.category}`,
                amount: expense.amount,
                date: expense.date,
                description: expense.title,
                refId: created.id,
                recordedBy: byUser,
              },
              ...prev.cashEntries,
            ]
          : prev.cashEntries,
      }));
      return created;
    },
    [activeUser, commitDb]
  );

  const deleteExpense = useCallback(
    (id: string) => {
      commitDb((prev) => ({
        ...prev,
        expenses: prev.expenses.filter((e) => e.id !== id),
        cashEntries: prev.cashEntries.filter((c) => c.refId !== id),
      }));
    },
    [commitDb]
  );

  const addCashEntry = useCallback(
    (entry: Omit<CashEntry, 'id' | 'recordedBy'>) => {
      const byUser = activeUser?.displayName ?? 'Counter Staff';
      const created: CashEntry = {
        ...entry,
        id: generateId('csh'),
        recordedBy: byUser,
      };
      commitDb((prev) => ({
        ...prev,
        cashEntries: [created, ...prev.cashEntries],
      }));
      return created;
    },
    [activeUser, commitDb]
  );

  const updateSettings = useCallback(
    (patch: Partial<ShopSettings>) => {
      commitDb((prev) => ({
        ...prev,
        settings: { ...prev.settings, ...patch },
      }));
    },
    [commitDb]
  );

  const addUser = useCallback(
    (user: Omit<UserAccount, 'id'>) => {
      commitDb((prev) => ({
        ...prev,
        users: [...prev.users, { ...user, id: generateId('usr') }],
      }));
    },
    [commitDb]
  );

  const updateUser = useCallback(
    (id: string, patch: Partial<UserAccount>) => {
      commitDb((prev) => ({
        ...prev,
        users: prev.users.map((u) => (u.id === id ? { ...u, ...patch } : u)),
      }));
    },
    [commitDb]
  );

  const deleteUser = useCallback(
    (id: string) => {
      commitDb((prev) => ({
        ...prev,
        users: prev.users.filter((u) => u.id !== id),
      }));
    },
    [commitDb]
  );

  const restoreFromBackup = useCallback(async (data: StoreDatabase) => {
    if (!data || !Array.isArray(data.products) || !data.settings) {
      return { ok: false, error: 'Invalid backup JSON file. Missing store structure.' };
    }
    try {
      const res = await fetch('/api/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const restored = res.ok ? ((await res.json()) as StoreDatabase) : data;
      setDb(restored);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(restored));
      localStorage.setItem(LOCAL_BACKUP_KEY, JSON.stringify(restored));
      setLastBackupStatus('Restored from backup');
      return { ok: true };
    } catch {
      setDb(data);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
      localStorage.setItem(LOCAL_BACKUP_KEY, JSON.stringify(data));
      setLastBackupStatus('Restored locally');
      return { ok: true };
    }
  }, []);

  const resetToDemoSeed = useCallback(async () => {
    try {
      const res = await fetch('/api/reset-seed', { method: 'POST' });
      const fresh = res.ok ? ((await res.json()) as StoreDatabase) : createInitialSeedDatabase();
      setDb(fresh);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(fresh));
      localStorage.setItem(LOCAL_BACKUP_KEY, JSON.stringify(fresh));
      setLastBackupStatus('Reset to initial store data');
    } catch {
      const fresh = createInitialSeedDatabase();
      setDb(fresh);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(fresh));
    }
  }, []);

  return (
    <StoreContext.Provider
      value={{
        db,
        activeUser,
        isLoading,
        lastBackupStatus,
        loginUser,
        logoutUser,
        switchUserQuick,
        completeSale,
        processSaleReturn,
        holdBill,
        deleteHeldBill,
        addProduct,
        updateProduct,
        deleteProduct,
        importProductsBulk,
        adjustStock,
        addSupplier,
        updateSupplier,
        recordPurchase,
        recordSupplierPayment,
        addCustomer,
        updateCustomer,
        recordCustomerPayment,
        addExpense,
        deleteExpense,
        addCashEntry,
        updateSettings,
        addUser,
        updateUser,
        deleteUser,
        restoreFromBackup,
        resetToDemoSeed,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
};

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside StoreProvider');
  return ctx;
}
