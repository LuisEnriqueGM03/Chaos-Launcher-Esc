import React from 'react';
import { RefreshCw, FolderOpen, Trash2, Sparkles, Sliders, AlertCircle } from 'lucide-react';
import { OptionalMod } from '../../vite-env';

interface ModsTabProps {
  optionalMods: OptionalMod[];
  disabledMods: string[];
  statusMsg: string | null;
  isInstalled: boolean;
  handleRefreshModpack: () => void | Promise<void>;
  handleToggleMod: (mod: OptionalMod) => void | Promise<void>;
  handleDeleteClick: () => void;
  isDownloading: boolean;
  onOpenFolder: () => void;
}

export const ModsTab: React.FC<ModsTabProps> = ({ optionalMods, disabledMods, statusMsg, isInstalled, handleRefreshModpack, handleToggleMod, handleDeleteClick, isDownloading, onOpenFolder }) => {
  return (
    <div className="relative z-10 w-full max-w-3xl max-h-[82%] overflow-y-auto minecraft-panel rounded-none p-6 sm:p-7 animate-in fade-in duration-200">
      {/* Header de Instalaciones & Ajustes de Mods */}
      <div className="flex items-center justify-between pb-4 border-b-2 border-black">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-none minecraft-slot text-amber-400">
            <Sliders className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-minecraft font-bold text-lg text-white tracking-wide minecraft-text-shadow-lava">
              AJUSTES DE RENDIMIENTO & MODS
            </h3>
            <p className="text-xs text-amber-400/90 font-minecraft mt-0.5">
              Personaliza los mods pesados según la potencia de tu PC
            </p>
          </div>
        </div>

        {/* Botones de herramientas del juego */}
        <div className="flex items-center gap-2">
          <button
            disabled={isDownloading}
            onClick={onOpenFolder}
            className={`minecraft-btn-lava rounded-none flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-200 font-minecraft ${
              isDownloading ? 'opacity-40 cursor-not-allowed pointer-events-none' : 'cursor-pointer'
            }`}
            title="Abrir carpeta de mods en el explorador"
          >
            <FolderOpen className="w-4 h-4 text-orange-400" />
            <span>Carpeta</span>
          </button>

          <button
            disabled={isDownloading}
            onClick={handleRefreshModpack}
            className={`minecraft-btn-lava rounded-none p-2 text-slate-300 transition ${
              isDownloading ? 'opacity-40 cursor-not-allowed pointer-events-none' : 'hover:text-white cursor-pointer'
            }`}
            title="Recomprobar archivos"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Mensaje de feedback al cambiar mod */}
      {statusMsg && (
        <div className="mt-4 p-3 rounded-none minecraft-card border-amber-600/50 text-amber-200 text-xs font-minecraft flex items-center gap-2 animate-in fade-in duration-150">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{statusMsg}</span>
        </div>
      )}

      {/* Lista de Mods Opcionales */}
      <div className="py-4 space-y-3">
        {optionalMods.length === 0 ? (
          <div className="text-center py-6 text-xs text-slate-400 font-minecraft">
            Cargando opciones de optimización...
          </div>
        ) : (
          optionalMods.map((mod) => {
            const isEnabled = !disabledMods.includes(mod.file);

            return (
              <div
                key={mod.id}
                className={`p-4 rounded-none minecraft-card flex items-center justify-between gap-4 transition ${
                  isEnabled
                    ? 'border-amber-600/50'
                    : 'opacity-70'
                }`}
              >
                <div className="space-y-1.5 flex-1 pr-2">
                  <div className="flex items-center gap-2.5">
                    <span className="font-minecraft font-bold text-sm text-white minecraft-text-shadow-lava">
                      {mod.name}
                    </span>
                    <span
                      className={`text-[9px] font-minecraft font-bold px-2 py-0.5 rounded-none ${
                        isEnabled
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/40 minecraft-text-shadow'
                          : 'bg-black text-slate-500 border border-slate-700/40'
                      }`}
                    >
                      {isEnabled ? 'ACTIVADO' : 'DESACTIVADO'}
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed font-sans">
                    {mod.description}
                  </p>
                  <p className="text-[10px] text-amber-500/70 font-mono">
                    {mod.file}
                  </p>
                </div>

                {/* Toggle Switch estilo Minecraft pixelado */}
                <button
                  onClick={() => handleToggleMod(mod)}
                  className={`relative inline-flex h-6 w-12 shrink-0 cursor-pointer rounded-none border-2 border-black transition-colors ${
                    isEnabled
                      ? 'bg-[#388534]'
                      : 'bg-[#292929]'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-5 bg-white border border-black shadow transition-transform ${
                      isEnabled ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Footer de Installations */}
      <div className="pt-3 border-t-2 border-black flex items-center justify-between text-xs text-slate-400 font-minecraft">
        <span className="flex items-center gap-1.5 text-amber-300 text-xs">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          Los cambios se aplican al instante antes de iniciar el juego.
        </span>

        {isInstalled && (
          <button
            onClick={handleDeleteClick}
            className="minecraft-btn-lava rounded-none flex items-center gap-1.5 px-3 py-1.5 text-red-300 text-xs font-minecraft transition cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5 text-red-400" />
            <span>Eliminar Modpack</span>
          </button>
        )}
      </div>
    </div>
  );
};
