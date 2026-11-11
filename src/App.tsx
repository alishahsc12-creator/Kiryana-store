import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  Boxes,
  LayoutDashboard,
  Lock,
  LogOut,
  Menu,
  Receipt,
  Settings,
  ShoppingBag,
  Truck,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { resolveShopLogo } from './assets/productImages';
import { CounterLoginModal } from './components/CounterLoginModal';
import { CustomersExpensesView } from './components/CustomersExpensesView';
import { DashboardReportsView } from './components/DashboardReportsView';
import { PosCounterView } from './components/PosCounterView';
import { ProductsInventoryView } from './components/ProductsInventoryView';
import { PurchasesSuppliersView } from './components/PurchasesSuppliersView';
import { SalesHistoryView } from './components/SalesHistoryView';
import { SettingsSecurityView } from './components/SettingsSecurityView';
import { StoreProvider, useStore } from './context/StoreContext';
import type { AppSection } from './types/pos';
import { formatPKDate, formatPKTime } from './utils/formatters';

interface NavItem {
  id: AppSection;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'pos', label: 'Billing Counter', icon: ShoppingBag },
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'products', label: 'Products & Stock', icon: Boxes },
  { id: 'sales', label: 'Sales & Returns', icon: Receipt },
  { id: 'purchases', label: 'Purchases & Suppliers', icon: Truck, adminOnly: true },
  { id: 'customers', label: 'Customers & Udhar', icon: Users },
  { id: 'expenses', label: 'Expenses & Cashbook', icon: Wallet },
  { id: 'reports', label: 'Reports & Profit', icon: BarChart3, adminOnly: true },
  { id: 'settings', label: 'Settings & Backup', icon: Settings, adminOnly: true },
];

const WorkspaceShell: React.FC = () => {
  const { db, activeUser, lastBackupStatus, logoutUser } = useStore();
  const [activeSection, setActiveSection] = useState<AppSection>('pos');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showSwitchModal, setShowSwitchModal] = useState(false);
  const [clockNow, setClockNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setClockNow(new Date()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  // Ensure Cashier cannot stay on Admin-only sections after switching user
  useEffect(() => {
    if (activeUser?.role === 'Cashier') {
      const currentNav = NAV_ITEMS.find((n) => n.id === activeSection);
      if (currentNav?.adminOnly) {
        setActiveSection('pos');
      }
    }
  }, [activeUser, activeSection]);

  if (!activeUser) {
    return <CounterLoginModal mode="full_lock" />;
  }

  const visibleNavItems = NAV_ITEMS.filter(
    (item) => !item.adminOnly || activeUser.role === 'Admin'
  );

  const lowStockCount = db.products.filter((p) => p.stock <= p.minStockAlert).length;
  const activeNav = NAV_ITEMS.find((n) => n.id === activeSection) ?? NAV_ITEMS[0];

  const handleSelectSection = (id: AppSection) => {
    setActiveSection(id);
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#F4F6F5] text-slate-900 flex">
      {/* Desktop Sidebar */}
      <aside className="no-print hidden lg:flex lg:w-60 xl:w-64 shrink-0 bg-white border-r border-slate-200 flex-col justify-between">
        <div>
          {/* Brand */}
          <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-3">
            <img
              src={resolveShopLogo(db.settings.logoKey)}
              alt={db.settings.shopName}
              referrerPolicy="no-referrer"
              className="w-9 h-9 rounded-lg object-contain border border-slate-200 bg-white p-0.5 shrink-0"
            />
            <div className="min-w-0">
              <div className="text-sm font-extrabold tracking-tight text-slate-900 truncate">
                Asan Kiryana
              </div>
              <div className="text-[11px] text-slate-500 truncate">
                {db.settings.shopName}
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-1">
            {visibleNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelectSection(item.id)}
                  className={`w-full flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-emerald-700 text-white'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <span className="flex items-center gap-2.5 truncate">
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </span>
                  {item.id === 'products' && lowStockCount > 0 && (
                    <span
                      className={`font-mono-num text-[11px] font-bold ${
                        isActive ? 'text-red-100' : 'text-red-600'
                      }`}
                    >
                      {lowStockCount}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Counter Staff Info */}
        <div className="p-3.5 border-t border-slate-200 space-y-2.5 text-xs">
          <div className="px-2">
            <div className="font-semibold text-slate-900 truncate">{activeUser.displayName}</div>
            <div className="text-[11px] text-slate-500">
              {activeUser.role} · {lastBackupStatus}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => setShowSwitchModal(true)}
              className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 text-[11px] font-medium bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200"
            >
              <Lock className="w-3 h-3" />
              Switch
            </button>
            <button
              type="button"
              onClick={logoutUser}
              className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 text-[11px] font-medium bg-slate-100 text-slate-700 rounded-lg hover:text-red-700 hover:bg-red-50"
            >
              <LogOut className="w-3 h-3" />
              Lock
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative z-50 w-64 bg-white h-full border-r border-slate-200 flex flex-col justify-between p-4">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-3">
                <span className="text-sm font-bold text-slate-900">Counter Billing</span>
                <button type="button" onClick={() => setMobileMenuOpen(false)}>
                  <X className="w-4 h-4 text-slate-500" />
                </button>
              </div>
              <nav className="space-y-1">
                {visibleNavItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeSection === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelectSection(item.id)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-semibold ${
                        isActive
                          ? 'bg-emerald-700 text-white'
                          : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                setShowSwitchModal(true);
              }}
              className="w-full py-2 text-xs font-semibold bg-slate-100 rounded-lg text-slate-800"
            >
              Switch User ({activeUser.role})
            </button>
          </div>
        </div>
      )}

      {/* Main Content Shell */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="no-print bg-white border-b border-slate-200 px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 truncate">
                {activeNav.label}
              </h1>
              <p className="text-xs text-slate-500 truncate">
                Counter Billing – Asan Kiryana · {formatPKDate(clockNow)} · {formatPKTime(clockNow)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {activeSection !== 'pos' && (
              <button
                type="button"
                onClick={() => setActiveSection('pos')}
                className="px-3.5 py-2 text-xs font-semibold bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 whitespace-nowrap"
              >
                Open Billing Counter
              </button>
            )}
          </div>
        </header>

        {/* Active View Viewport */}
        <main className="flex-1 p-4 sm:p-5 overflow-y-auto">
          {activeSection === 'pos' && <PosCounterView />}
          {activeSection === 'dashboard' && (
            <DashboardReportsView
              key="dashboard"
              mode="dashboard"
              onNavigate={setActiveSection}
            />
          )}
          {activeSection === 'products' && <ProductsInventoryView />}
          {activeSection === 'sales' && <SalesHistoryView />}
          {activeSection === 'purchases' && <PurchasesSuppliersView />}
          {activeSection === 'customers' && (
            <CustomersExpensesView key="customers" initialTab="customers" />
          )}
          {activeSection === 'expenses' && (
            <CustomersExpensesView key="expenses" initialTab="expenses" />
          )}
          {activeSection === 'reports' && (
            <DashboardReportsView
              key="reports"
              mode="reports"
              onNavigate={setActiveSection}
            />
          )}
          {activeSection === 'settings' && <SettingsSecurityView />}
        </main>
      </div>

      {showSwitchModal && (
        <CounterLoginModal mode="switch_modal" onClose={() => setShowSwitchModal(false)} />
      )}
    </div>
  );
};

export default function App() {
  return (
    <StoreProvider>
      <WorkspaceShell />
    </StoreProvider>
  );
}
