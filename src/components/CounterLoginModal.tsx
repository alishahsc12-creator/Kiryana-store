import React, { useState } from 'react';
import { Lock, ShieldCheck, UserCheck, X } from 'lucide-react';
import { resolveShopLogo } from '../assets/productImages';
import { useStore } from '../context/StoreContext';

interface CounterLoginModalProps {
  mode: 'full_lock' | 'switch_modal';
  onClose?: () => void;
}

export const CounterLoginModal: React.FC<CounterLoginModalProps> = ({ mode, onClose }) => {
  const { db, activeUser, loginUser, switchUserQuick } = useStore();
  const [selectedUserId, setSelectedUserId] = useState<string>(
    activeUser?.id || db.users[0]?.id || 'usr_admin'
  );
  const [pin, setPin] = useState<string>('');
  const [error, setError] = useState<string>('');

  const selectedUser = db.users.find((u) => u.id === selectedUserId) ?? db.users[0];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!selectedUser) return;

    const result =
      mode === 'full_lock'
        ? loginUser(selectedUser.username, pin)
        : switchUserQuick(selectedUser.id, pin);

    if (!result.ok) {
      setError(result.error || 'Incorrect PIN');
      return;
    }
    setPin('');
    onClose?.();
  };

  const containerClasses =
    mode === 'full_lock'
      ? 'fixed inset-0 z-50 flex items-center justify-center bg-slate-100 p-4'
      : 'fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[1px]';

  return (
    <div className={containerClasses}>
      <div className="bg-white border border-slate-200 rounded-xl shadow-lg w-full max-w-md overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src={resolveShopLogo(db.settings.logoKey)}
              alt={db.settings.shopName}
              referrerPolicy="no-referrer"
              className="w-10 h-10 rounded-lg object-contain border border-slate-200 bg-white p-0.5"
            />
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {mode === 'full_lock' ? 'Counter Sign In' : 'Switch Counter User'}
              </h2>
              <p className="text-xs text-slate-500">{db.settings.shopName}</p>
            </div>
          </div>
          {mode === 'switch_modal' && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
              aria-label="Close switch user dialog"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              Select Counter Staff Role
            </label>
            <div className="grid grid-cols-1 gap-2">
              {db.users
                .filter((u) => u.active)
                .map((u) => {
                  const isSelected = u.id === selectedUserId;
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => {
                        setSelectedUserId(u.id);
                        setError('');
                      }}
                      className={`flex items-center justify-between px-3.5 py-2.5 rounded-lg border text-left transition-colors ${
                        isSelected
                          ? 'border-emerald-700 bg-emerald-50/70 text-slate-900'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        {u.role === 'Admin' ? (
                          <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
                        ) : (
                          <UserCheck className="w-4 h-4 text-slate-600 shrink-0" />
                        )}
                        <div>
                          <div className="text-sm font-semibold">{u.displayName}</div>
                          <div className="text-xs text-slate-500">
                            @{u.username} · {u.role} Access
                          </div>
                        </div>
                      </div>
                      <span className="text-xs font-mono-num text-slate-500">
                        PIN: {u.pin}
                      </span>
                    </button>
                  );
                })}
            </div>
          </div>

          <div>
            <label htmlFor="counter-pin-input" className="block text-xs font-semibold text-slate-700 mb-1.5">
              Enter 4-Digit Counter PIN
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="counter-pin-input"
                type="password"
                inputMode="numeric"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="Enter PIN (e.g. 1234 or 1111)"
                autoFocus
                className="w-full pl-9 pr-3 py-2.5 text-sm font-mono-num border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600"
              />
            </div>
            {error && (
              <p className="mt-1.5 text-xs font-medium text-red-600">{error}</p>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 pt-1">
            {selectedUser && (
              <button
                type="button"
                onClick={() => setPin(selectedUser.pin)}
                className="px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Autofill {selectedUser.role} PIN
              </button>
            )}
            <button
              type="submit"
              className="ml-auto px-5 py-2.5 bg-emerald-700 text-white text-sm font-semibold rounded-lg hover:bg-emerald-800 transition-colors"
            >
              Unlock Counter
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
