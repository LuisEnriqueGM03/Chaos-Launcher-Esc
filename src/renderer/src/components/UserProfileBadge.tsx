import React, { useState } from 'react';
import { LogOut, UserPlus, Users, ChevronDown, ShieldCheck, User } from 'lucide-react';
import { UserAccount } from '../vite-env';

interface UserProfileBadgeProps {
  activeAccount: UserAccount | null;
  accounts: UserAccount[];
  onLogout: () => void;
  onSwitchAccount: (id: string) => void;
  onOpenLoginModal: () => void;
}

export const UserProfileBadge: React.FC<UserProfileBadgeProps> = ({
  activeAccount,
  accounts,
  onLogout,
  onSwitchAccount,
  onOpenLoginModal,
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  if (!activeAccount) {
    return (
      <button
        onClick={onOpenLoginModal}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 text-xs font-medium transition shadow-sm hover:shadow-neon-cyan/20"
      >
        <UserPlus className="w-3.5 h-3.5" />
        <span>Iniciar Sesión</span>
      </button>
    );
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-2 bg-[#121826]/80 backdrop-blur-md border border-white/10 rounded-xl p-1.5 pr-2.5 shadow-lg">
        {/* Avatar Head */}
        <div className="relative">
          <img
            src={activeAccount.skinUrl}
            alt={activeAccount.name}
            className="w-8 h-8 rounded-lg bg-black/40 border border-white/10 object-cover shadow"
            onError={(e) => {
              // Fallback si la imagen no carga
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
          {activeAccount.type === 'microsoft' ? (
            <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-cyan-500 flex items-center justify-center text-[9px] text-black font-bold shadow-neon-cyan">
              ✓
            </div>
          ) : (
            <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-purple-600 flex items-center justify-center text-[9px] text-white font-bold">
              •
            </div>
          )}
        </div>

        {/* User Info */}
        <div className="flex flex-col text-left">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-white tracking-wide max-w-[120px] truncate">
              {activeAccount.name}
            </span>
          </div>
          <span className={`text-[10px] uppercase font-mono font-bold tracking-wider ${
            activeAccount.type === 'microsoft' ? 'text-cyan-400' : 'text-purple-400'
          }`}>
            {activeAccount.type === 'microsoft' ? 'Premium' : 'No Premium'}
          </span>
        </div>

        {/* Action Dropdown Toggle */}
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="p-1 rounded-md hover:bg-white/10 text-slate-400 hover:text-white transition ml-1"
          title="Opciones de cuenta"
        >
          <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`} />
        </button>

        {/* Direct Logout Button */}
        <button
          onClick={onLogout}
          className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 border border-red-500/20 transition ml-0.5"
          title="Cerrar Sesión"
        >
          <LogOut className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Dropdown Menu */}
      {dropdownOpen && (
        <div className="absolute right-0 top-12 w-56 rounded-xl bg-[#0f1422] border border-white/10 shadow-2xl p-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="px-2.5 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Cambiar Cuenta
          </div>

          <div className="max-h-40 overflow-y-auto space-y-1">
            {accounts.map((acc) => (
              <button
                key={acc.id}
                onClick={() => {
                  onSwitchAccount(acc.id);
                  setDropdownOpen(false);
                }}
                className={`w-full flex items-center justify-between p-2 rounded-lg text-left text-xs transition ${
                  acc.id === activeAccount.id
                    ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                    : 'hover:bg-white/5 text-slate-300'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <img src={acc.skinUrl} alt={acc.name} className="w-5 h-5 rounded bg-black/40" />
                  <span className="truncate">{acc.name}</span>
                </div>
                <span className="text-[10px] text-slate-500">
                  {acc.type === 'microsoft' ? 'MS' : 'OFF'}
                </span>
              </button>
            ))}
          </div>

          <div className="h-[1px] bg-white/10 my-1" />

          <button
            onClick={() => {
              onOpenLoginModal();
              setDropdownOpen(false);
            }}
            className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-white/10 text-xs text-slate-200 transition"
          >
            <UserPlus className="w-3.5 h-3.5 text-cyan-400" />
            <span>Agregar otra cuenta</span>
          </button>

          <button
            onClick={() => {
              onLogout();
              setDropdownOpen(false);
            }}
            className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-red-500/10 text-xs text-red-400 hover:text-red-300 transition"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Cerrar sesión activa</span>
          </button>
        </div>
      )}
    </div>
  );
};
