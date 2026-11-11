export type UserRole = 'Admin' | 'Cashier';

export interface UserAccount {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
  pin: string;
  active: boolean;
}

export interface Product {
  id: string;
  name: string;
  urduName?: string;
  barcode: string;
  category: string;
  unit: string;
  purchasePrice: number;
  salePrice: number;
  stock: number;
  minStockAlert: number;
  expiryDate?: string;
  damagedQty: number;
  imageKey: string;
  updatedAt: string;
}

export interface CartItem {
  productId: string;
  name: string;
  barcode: string;
  unit: string;
  purchasePrice: number;
  salePrice: number;
  qty: number;
  discount: number; // flat Rs. discount on this line
  imageKey: string;
}

export type PaymentMethod = 'Cash' | 'Card' | 'JazzCash' | 'Easypaisa' | 'Udhar (Credit)';

export interface SaleItem {
  productId: string;
  name: string;
  barcode: string;
  unit: string;
  purchasePrice: number;
  salePrice: number;
  qty: number;
  discount: number;
  lineTotal: number;
  costTotal: number;
  profit: number;
  returnedQty?: number;
}

export interface SaleReturnRecord {
  id: string;
  date: string;
  items: {
    productId: string;
    name: string;
    qty: number;
    refundAmount: number;
    costAmount: number;
  }[];
  totalRefund: number;
  reason: string;
  processedBy: string;
}

export interface Sale {
  id: string;
  invoiceNo: string;
  createdAt: string;
  items: SaleItem[];
  subtotal: number;
  discountType: 'flat' | 'percent';
  discountValue: number;
  billDiscountAmount: number;
  taxEnabled: boolean;
  taxRate: number;
  taxAmount: number;
  grandTotal: number;
  paymentMethod: PaymentMethod;
  amountReceived: number;
  changeReturned: number;
  customerId?: string;
  customerName?: string;
  cashierName: string;
  totalCost: number;
  netProfit: number;
  returnedAmount: number;
  returnedCost: number;
  returns: SaleReturnRecord[];
  notes?: string;
}

export interface HeldBill {
  id: string;
  label: string;
  createdAt: string;
  items: CartItem[];
  discountType: 'flat' | 'percent';
  discountValue: number;
  taxEnabled: boolean;
  taxRate: number;
  customerId?: string;
  notes?: string;
}

export interface StockAdjustment {
  id: string;
  productId: string;
  productName: string;
  type: 'restock' | 'damage' | 'expiry' | 'correction';
  qtyDelta: number;
  reason: string;
  date: string;
  byUser: string;
}

export interface Supplier {
  id: string;
  name: string;
  company: string;
  phone: string;
  address: string;
  balanceOwed: number;
  createdAt: string;
}

export interface PurchaseItem {
  productId: string;
  productName: string;
  qty: number;
  unitCost: number;
  lineTotal: number;
}

export interface Purchase {
  id: string;
  invoiceNo: string;
  supplierId: string;
  supplierName: string;
  date: string;
  items: PurchaseItem[];
  totalAmount: number;
  paidAmount: number;
  balanceDue: number;
  paymentMethod: 'Cash' | 'Bank/JazzCash' | 'Credit';
  notes?: string;
}

export interface SupplierPayment {
  id: string;
  supplierId: string;
  supplierName: string;
  date: string;
  amount: number;
  method: 'Cash' | 'Bank/JazzCash';
  note?: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string;
  udharBalance: number;
  creditLimit: number;
  createdAt: string;
}

export interface CustomerTransaction {
  id: string;
  customerId: string;
  customerName: string;
  date: string;
  type: 'credit_sale' | 'payment_received';
  amount: number;
  invoiceNo?: string;
  method?: string;
  note?: string;
}

export type ExpenseCategory =
  | 'Rent'
  | 'Electricity & Utility'
  | 'Staff Salary'
  | 'Transport & Freight'
  | 'Packaging & Bags'
  | 'Shop Maintenance'
  | 'Other';

export interface Expense {
  id: string;
  title: string;
  category: ExpenseCategory;
  amount: number;
  date: string;
  paidFromCashDrawer: boolean;
  note?: string;
  recordedBy: string;
}

export interface CashEntry {
  id: string;
  type: 'cash_in' | 'cash_out';
  category: string;
  amount: number;
  date: string;
  description: string;
  refId?: string;
  recordedBy: string;
}

export interface ShopSettings {
  shopName: string;
  tagline: string;
  address: string;
  phone: string;
  ntnNumber: string;
  logoKey: string;
  printerWidth: '58mm' | '80mm';
  defaultTaxEnabled: boolean;
  defaultTaxRate: number;
  receiptFooter: string;
  soundBeepEnabled: boolean;
}

export interface StoreDatabase {
  version: number;
  lastSavedAt: string;
  settings: ShopSettings;
  users: UserAccount[];
  products: Product[];
  sales: Sale[];
  heldBills: HeldBill[];
  stockAdjustments: StockAdjustment[];
  suppliers: Supplier[];
  purchases: Purchase[];
  supplierPayments: SupplierPayment[];
  customers: Customer[];
  customerTransactions: CustomerTransaction[];
  expenses: Expense[];
  cashEntries: CashEntry[];
}

export type AppSection =
  | 'pos'
  | 'dashboard'
  | 'products'
  | 'sales'
  | 'purchases'
  | 'customers'
  | 'expenses'
  | 'reports'
  | 'settings';
