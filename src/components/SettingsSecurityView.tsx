import React, { useRef, useState } from 'react';
import {
  Download,
  Plus,
  RotateCcw,
  Save,
  Shield,
  Trash2,
  Upload,
  UserCheck,
} from 'lucide-react';
import { resolveShopLogo } from '../assets/productImages';
import { useStore } from '../context/StoreContext';
import type { StoreDatabase, UserRole } from '../types/pos';
import { formatPKDateTime } from '../utils/formatters';

export const SettingsSecurityView: React.FC = () => {
  const {
    db,
    activeUser,
    lastBackupStatus,
    updateSettings,
    addUser,
    updateUser,
    deleteUser,
    restoreFromBackup,
    resetToDemoSeed,
  } = useStore();

  const [shopName, setShopName] = useState(db.settings.shopName);
  const [tagline, setTagline] = useState(db.settings.tagline);
  const [address, setAddress] = useState(db.settings.address);
  const [phone, setPhone] = useState(db.settings.phone);
  const [ntnNumber, setNtnNumber] = useState(db.settings.ntnNumber);
  const [logoKey, setLogoKey] = useState(db.settings.logoKey);
  const [printerWidth, setPrinterWidth] = useState<'58mm' | '80mm'>(db.settings.printerWidth);
  const [defaultTaxEnabled, setDefaultTaxEnabled] = useState(db.settings.defaultTaxEnabled);
  const [defaultTaxRate, setDefaultTaxRate] = useState(String(db.settings.defaultTaxRate));
  const [receiptFooter, setReceiptFooter] = useState(db.settings.receiptFooter);
  const [soundBeepEnabled, setSoundBeepEnabled] = useState(db.settings.soundBeepEnabled);

  // New user form
  const [newUsername, setNewUsername] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('Cashier');
  const [newPin, setNewPin] = useState('');

  const [statusMsg, setStatusMsg] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const restoreInputRef = useRef<HTMLInputElement>(null);

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings({
      shopName: shopName.trim() || 'Asan Kiryana Store',
      tagline: tagline.trim(),
      address: address.trim(),
      phone: phone.trim(),
      ntnNumber: ntnNumber.trim(),
      logoKey,
      printerWidth,
      defaultTaxEnabled,
      defaultTaxRate: Math.max(0, Number(defaultTaxRate) || 0),
      receiptFooter: receiptFooter.trim(),
      soundBeepEnabled,
    });
    setStatusMsg('Shop profile, thermal printer & receipt settings saved.');
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setLogoKey(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim() || !newPin.trim()) return;
    addUser({
      username: newUsername.trim().toLowerCase(),
      displayName: newDisplayName.trim() || newUsername.trim(),
      role: newRole,
      pin: newPin.trim(),
      active: true,
    });
    setNewUsername('');
    setNewDisplayName('');
    setNewPin('');
    setStatusMsg('Added new counter user account.');
  };

  const handleDownloadJsonBackup = () => {
    const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `asan-kiryana-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setStatusMsg('Downloaded complete store backup JSON file.');
  };

  const handleRestoreFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as StoreDatabase;
      const res = await restoreFromBackup(parsed);
      if (res.ok) {
        setStatusMsg('Store database restored successfully from backup!');
      } else {
        setStatusMsg(res.error || 'Backup file could not be restored.');
      }
    } catch {
      setStatusMsg('Invalid JSON backup file.');
    } finally {
      if (restoreInputRef.current) restoreInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {statusMsg && (
        <div className="px-4 py-2.5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-lg text-xs font-medium">
          {statusMsg}
        </div>
      )}

      {/* Shop Profile & Thermal Printer Settings */}
      <form
        onSubmit={handleSaveSettings}
        className="bg-white border border-slate-200 rounded-xl p-5 space-y-4"
      >
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Shop Details & Thermal Receipt Settings
            </h3>
            <p className="text-xs text-slate-500">
              Printed on 58mm/80mm receipts and PDF reports
            </p>
          </div>
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-700 text-white text-xs font-semibold rounded-lg hover:bg-emerald-800"
          >
            <Save className="w-3.5 h-3.5" />
            Save Settings
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Shop Name</label>
            <input
              type="text"
              value={shopName}
              onChange={(e) => setShopName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Phone Number</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3 py-2 font-mono-num border border-slate-300 rounded-lg"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block font-semibold text-slate-700 mb-1">Shop Address</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Tagline</label>
            <input
              type="text"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              NTN / Trade License (Optional)
            </label>
            <input
              type="text"
              value={ntnNumber}
              onChange={(e) => setNtnNumber(e.target.value)}
              className="w-full px-3 py-2 font-mono-num border border-slate-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Default Thermal Receipt Width
            </label>
            <div className="flex gap-2">
              {(['58mm', '80mm'] as const).map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => setPrinterWidth(w)}
                  className={`flex-1 py-2 px-3 rounded-lg border font-semibold ${
                    printerWidth === w
                      ? 'bg-emerald-700 text-white border-emerald-700'
                      : 'bg-white text-slate-700 border-slate-300'
                  }`}
                >
                  {w} Thermal Roll
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Shop Logo</label>
            <div className="flex items-center gap-3">
              <img
                src={resolveShopLogo(logoKey)}
                alt="Shop Logo"
                referrerPolicy="no-referrer"
                className="w-11 h-11 rounded-lg object-contain border border-slate-200 p-0.5"
              />
              <input
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="text-[11px] text-slate-500 file:mr-2 file:py-1 file:px-2.5 file:rounded file:border file:border-slate-300 file:bg-slate-50"
              />
            </div>
          </div>

          <div className="md:col-span-2">
            <label className="block font-semibold text-slate-700 mb-1">
              Receipt Footer Message
            </label>
            <input
              type="text"
              value={receiptFooter}
              onChange={(e) => setReceiptFooter(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>

          <div className="flex items-center gap-4">
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={defaultTaxEnabled}
                onChange={(e) => setDefaultTaxEnabled(e.target.checked)}
              />
              <span className="font-medium text-slate-700">Enable Default GST Tax</span>
            </label>
            {defaultTaxEnabled && (
              <input
                type="number"
                min={0}
                max={50}
                value={defaultTaxRate}
                onChange={(e) => setDefaultTaxRate(e.target.value)}
                className="w-16 px-2 py-1 border border-slate-300 rounded font-mono-num"
              />
            )}
          </div>

          <div className="flex items-center">
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={soundBeepEnabled}
                onChange={(e) => setSoundBeepEnabled(e.target.checked)}
              />
              <span className="font-medium text-slate-700">
                Enable Barcode Scanner & Counter Beep Sound
              </span>
            </label>
          </div>
        </div>
      </form>

      {/* Admin & Cashier User Accounts */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
          <Shield className="w-4 h-4 text-emerald-700" />
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Counter Staff & Role Access (Admin / Cashier)
            </h3>
            <p className="text-xs text-slate-500">
              Admin has full profit, inventory & settings access; Cashier has fast billing,
              receipts & Udhar lookup.
            </p>
          </div>
        </div>

        <div className="divide-y divide-slate-100 text-xs">
          {db.users.map((u) => (
            <div key={u.id} className="py-2.5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <UserCheck className="w-4 h-4 text-slate-500" />
                <div>
                  <div className="font-semibold text-slate-900">
                    {u.displayName}{' '}
                    <span className="text-slate-400 font-normal">(@{u.username})</span>
                  </div>
                  <div className="text-[11px] text-slate-500">Role: {u.role}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-slate-500">PIN:</label>
                <input
                  type="text"
                  value={u.pin}
                  onChange={(e) => updateUser(u.id, { pin: e.target.value })}
                  className="w-20 px-2 py-1 border border-slate-300 rounded font-mono-num text-center"
                />
                {u.id !== activeUser?.id && db.users.length > 1 && (
                  <button
                    type="button"
                    onClick={() => deleteUser(u.id)}
                    className="p-1.5 text-slate-400 hover:text-red-600 rounded"
                    aria-label="Remove user"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        <form
          onSubmit={handleCreateUser}
          className="grid grid-cols-1 sm:grid-cols-5 gap-2 pt-3 border-t border-slate-200 text-xs"
        >
          <input
            required
            type="text"
            value={newUsername}
            onChange={(e) => setNewUsername(e.target.value)}
            placeholder="Username (e.g. ali)"
            className="px-3 py-2 border border-slate-300 rounded-lg"
          />
          <input
            required
            type="text"
            value={newDisplayName}
            onChange={(e) => setNewDisplayName(e.target.value)}
            placeholder="Full Name"
            className="px-3 py-2 border border-slate-300 rounded-lg"
          />
          <select
            value={newRole}
            onChange={(e) => setNewRole(e.target.value as UserRole)}
            className="px-3 py-2 border border-slate-300 rounded-lg bg-white"
          >
            <option value="Cashier">Cashier</option>
            <option value="Admin">Admin</option>
          </select>
          <input
            required
            type="text"
            value={newPin}
            onChange={(e) => setNewPin(e.target.value)}
            placeholder="4-digit PIN"
            className="px-3 py-2 font-mono-num border border-slate-300 rounded-lg"
          />
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-1 px-3 py-2 bg-slate-900 text-white font-semibold rounded-lg hover:bg-slate-800"
          >
            <Plus className="w-3.5 h-3.5" />
            Add User
          </button>
        </form>
      </div>

      {/* Automatic & Manual Backup / Restore */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="border-b border-slate-200 pb-3">
          <h3 className="text-sm font-bold text-slate-900">
            Automatic Backup & Manual Restore
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Every bill, product update, supplier ledger, and Udhar entry is automatically saved to
            disk and browser storage. Status: {lastBackupStatus} · Last saved{' '}
            {formatPKDateTime(db.lastSavedAt)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs">
          <button
            type="button"
            onClick={handleDownloadJsonBackup}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-700 text-white font-semibold rounded-lg hover:bg-emerald-800"
          >
            <Download className="w-3.5 h-3.5" />
            Download Full Backup (.JSON)
          </button>

          <input
            ref={restoreInputRef}
            type="file"
            accept=".json"
            onChange={handleRestoreFile}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => restoreInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-300 text-slate-800 font-semibold rounded-lg hover:bg-slate-50"
          >
            <Upload className="w-3.5 h-3.5" />
            Restore Backup (.JSON)
          </button>

          {!confirmReset ? (
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className="ml-auto inline-flex items-center gap-1.5 px-3 py-2 text-red-600 border border-red-200 rounded-lg hover:bg-red-50 font-medium"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Initial Store Data
            </button>
          ) : (
            <div className="ml-auto flex items-center gap-2">
              <span className="text-red-700 font-semibold">Reset all records?</span>
              <button
                type="button"
                onClick={async () => {
                  await resetToDemoSeed();
                  setConfirmReset(false);
                  setStatusMsg('Store reset to initial Pakistani Kiryana seed data.');
                }}
                className="px-3 py-1.5 bg-red-600 text-white rounded-lg font-semibold"
              >
                Confirm Reset
              </button>
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
