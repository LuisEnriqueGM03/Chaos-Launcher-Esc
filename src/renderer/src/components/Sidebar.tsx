import React, { useState } from 'react';
import { 
  Settings as SettingsIcon, 
  ChevronDown, 
  LogOut, 
  UserPlus,
  Trash2,
  RefreshCw
} from 'lucide-react';
import { UserAccount, ModpackItem } from '../vite-env';
import logoTransparent from '../assets/logo_transparent.png';

interface SidebarProps {
  activeAccount: UserAccount | null;
  accounts: UserAccount[];
  modpacks?: ModpackItem[];
  selectedModpackTag?: string | null;
  onSelectModpack?: (tag: string) => void;
  onRefreshModpacks?: () => void;
  isDownloading?: boolean;
  activeNavTab: string;
  onSelectNavTab: (tab: string) => void;
  onLogout: () => void;
  onSwitchAccount: (id: string) => void;
  onDeleteAccount?: (id: string) => void;
  onOpenLoginModal: () => void;
  onOpenSettings: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeAccount,
  accounts,
  modpacks = [],
  selectedModpackTag,
  onSelectModpack,
  onRefreshModpacks,
  isDownloading = false,
  activeNavTab,
  onSelectNavTab,
  onLogout,
  onSwitchAccount,
  onDeleteAccount,
  onOpenLoginModal,
  onOpenSettings,
}) => {
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);

  return (
    <aside className="w-56 h-full bg-[#110808] border-r-2 border-black flex flex-col justify-between select-none relative z-30">
      {/* 1. Header Profile (Estilo Minecraft Slot / Card) */}
      <div className="p-3 border-b-2 border-black relative">
        {activeAccount ? (
          <div>
            <div 
              onClick={() => {
                if (isDownloading) return;
                setAccountMenuOpen(!accountMenuOpen);
              }}
              className={`flex items-center gap-2.5 p-2 rounded-none minecraft-card transition ${
                isDownloading ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer active:translate-y-0.5'
              } group`}
            >
              {/* Avatar Head en ranura estilo slot Minecraft */}
              <div className="w-8 h-8 minecraft-slot flex items-center justify-center shrink-0">
                <img
                  src={activeAccount.skinUrl}
                  alt={activeAccount.name}
                  className="w-7 h-7 object-cover shadow-sm"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://mc-heads.net/avatar/Steve/100';
                  }}
                />
              </div>

              {/* Name & Type */}
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-white truncate font-minecraft minecraft-text-shadow-lava">
                  {activeAccount.name}
                </div>
                <div className="text-[10px] text-emerald-400 font-minecraft font-semibold truncate mt-0.5">
                  {activeAccount.type === 'microsoft' ? 'Premium' : 'Offline'}
                </div>
              </div>

              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 group-hover:text-white transition-transform ${
                accountMenuOpen ? 'rotate-180' : ''
              }`} />
            </div>
          </div>
        ) : (
          <button
            onClick={onOpenLoginModal}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-none minecraft-btn-green text-white font-minecraft font-bold text-xs tracking-wider minecraft-text-shadow cursor-pointer"
          >
            <UserPlus className="w-4 h-4 shrink-0 filter drop-shadow-[1px_1px_0_#143e10]" />
            <span>INICIAR SESIÓN</span>
          </button>
        )}

        {/* Dropdown Menu de Cuentas estilo Minecraft Panel */}
        {accountMenuOpen && (
          <div className="absolute top-full left-2 right-2 mt-1.5 rounded-none minecraft-panel p-2 z-50 animate-in fade-in duration-150 space-y-1">
            <div className="px-2 py-1 text-[10px] font-minecraft uppercase tracking-wider text-amber-400/90 border-b border-[#2d1212] mb-1">
              Cuentas Guardadas
            </div>

            <div className="max-h-36 overflow-y-auto space-y-1">
              {accounts.map((acc) => (
                <div
                  key={acc.id}
                  className={`w-full flex items-center justify-between p-1.5 rounded-none text-left text-xs transition group/acc ${
                    activeAccount?.id === acc.id
                      ? 'minecraft-card border-red-500/60 font-bold'
                      : 'hover:bg-white/5 text-slate-300'
                  }`}
                >
                  <button
                    onClick={() => {
                      onSwitchAccount(acc.id);
                      setAccountMenuOpen(false);
                    }}
                    className="flex-1 flex items-center gap-2 truncate text-left cursor-pointer"
                  >
                    <div className="w-5 h-5 minecraft-slot flex items-center justify-center shrink-0">
                      <img src={acc.skinUrl} alt={acc.name} className="w-4 h-4 object-cover" />
                    </div>
                    <span className="truncate font-minecraft text-white text-xs">{acc.name}</span>
                  </button>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[9px] font-minecraft text-emerald-400">
                      {acc.type === 'microsoft' ? 'Prem' : 'Off'}
                    </span>
                    {accounts.length > 1 && onDeleteAccount && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteAccount(acc.id);
                        }}
                        className="opacity-0 group-hover/acc:opacity-100 p-1 hover:text-red-400 text-slate-500 transition cursor-pointer"
                        title="Eliminar cuenta guardada"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="h-[1px] bg-[#2d1212] my-1" />

            <button
              onClick={() => {
                onOpenLoginModal();
                setAccountMenuOpen(false);
              }}
              className="w-full flex items-center gap-2 p-1.5 rounded-none hover:bg-white/10 text-xs font-minecraft text-slate-200 transition cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5 text-amber-400" />
              <span>Agregar otra cuenta</span>
            </button>

            <button
              onClick={() => {
                onLogout();
                setAccountMenuOpen(false);
              }}
              className="w-full flex items-center gap-2 p-1.5 rounded-none hover:bg-red-950/60 text-xs font-minecraft text-red-400 transition cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5 text-red-400" />
              <span>Cerrar Sesión</span>
            </button>
          </div>
        )}
      </div>

      {/* 2. Middle Navigation Items (Minecraft Button Style) */}
      <nav className="flex-1 py-4 px-2 space-y-2 overflow-y-auto">
        {/* CHAOS LAUNCHER */}
        <button
          type="button"
          disabled={isDownloading}
          onClick={() => {
            if (isDownloading) return;
            onSelectNavTab('play');
          }}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-none transition ${
            isDownloading
              ? 'opacity-40 cursor-not-allowed pointer-events-none'
              : 'cursor-pointer active:translate-y-0.5'
          } ${
            activeNavTab === 'play'
              ? 'minecraft-btn-lava border-l-4 border-l-red-500'
              : 'text-slate-300 hover:text-white hover:bg-white/5 border border-transparent hover:border-black'
          }`}
          title={isDownloading ? 'Descarga en progreso...' : 'Ir a Chaos Launcher'}
        >
          <img 
            src={logoTransparent} 
            alt="Chaos" 
            className="w-5 h-5 object-contain filter drop-shadow-[0_0_5px_rgba(255,60,0,0.8)] shrink-0" 
          />
          <div className="text-left">
            <div className="font-minecraft font-bold tracking-wide text-xs text-white leading-none minecraft-text-shadow-lava">
              CHAOS LAUNCHER
            </div>
          </div>
        </button>

        {/* SECTION: MODPACKS DEL SERVIDOR */}
        <div className="pt-2">
          {/* Botón Actualizar Lista con estética full Minecraft 3D */}
          {onRefreshModpacks && (
            <div className="px-1 pt-0.5 pb-2">
              <button
                type="button"
                disabled={isDownloading}
                onClick={onRefreshModpacks}
                className={`w-full py-2 px-2 minecraft-btn-amber text-[10px] font-minecraft font-bold text-white flex items-center justify-center gap-2 transition ${
                  isDownloading
                    ? 'opacity-40 cursor-not-allowed pointer-events-none'
                    : 'cursor-pointer active:translate-y-0.5'
                } minecraft-text-shadow`}
                title={isDownloading ? 'Descarga en progreso...' : 'Actualizar lista de modpacks desde el backend'}
              >
                <RefreshCw className="w-3.5 h-3.5 text-amber-300 filter drop-shadow-[1px_1px_0_#4a2a00]" />
                <span>ACTUALIZAR LISTA</span>
              </button>
            </div>
          )}

          <div className="px-2 py-1 text-[9px] font-minecraft uppercase tracking-wider text-amber-400/90 mb-1 flex items-center justify-between border-b border-[#2d1212]">
            <span>MODPACK ({modpacks.length})</span>
          </div>

          <div className="space-y-1.5 mt-1.5">
            {modpacks.length === 0 ? (
              <div className="px-2 py-3 text-[10px] text-stone-500 font-minecraft text-center italic border border-black/40 bg-black/20">
                Sin modpacks descargados
              </div>
            ) : (
              modpacks.map((mp) => {
                const isSelected = activeNavTab === 'modpack' && selectedModpackTag === mp.tag;
                return (
                  <button
                    key={mp.tag}
                    disabled={isDownloading}
                    onClick={() => {
                      if (isDownloading) return;
                      onSelectModpack?.(mp.tag);
                      onSelectNavTab('modpack');
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-none transition text-left ${
                      isDownloading ? 'opacity-40 cursor-not-allowed pointer-events-none' : 'cursor-pointer'
                    } ${
                      isSelected
                        ? 'minecraft-btn-amber border-l-4 border-l-amber-400'
                        : 'text-slate-300 hover:text-white hover:bg-white/5 border border-transparent hover:border-black'
                    }`}
                  >
                    <div className="w-5 h-5 flex items-center justify-center shrink-0">
                      <img 
                        src={mp.iconUrl || logoTransparent} 
                        alt={mp.name} 
                        className="w-5 h-5 rounded-none object-cover shadow-sm border border-black" 
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = logoTransparent;
                        }}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-minecraft font-bold tracking-wide text-xs text-white leading-tight truncate minecraft-text-shadow-amber">
                        {mp.name}
                      </div>
                      <div className="text-[9px] text-amber-300/80 font-minecraft font-semibold truncate mt-0.5">
                        {mp.minecraftVersion} • {mp.loaderType}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </nav>

      {/* 3. Bottom Settings Button (Minecraft Button Style) */}
      <div className="p-3 border-t-2 border-black">
        <button
          onClick={onOpenSettings}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-none minecraft-btn-lava text-xs text-slate-200 transition cursor-pointer font-minecraft"
        >
          <SettingsIcon className="w-4 h-4 text-slate-300" />
          <span>Ajustes Globales</span>
        </button>
      </div>
    </aside>
  );
};
