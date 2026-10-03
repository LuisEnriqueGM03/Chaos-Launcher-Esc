import React from 'react';
import { RotateCw, CheckCircle2, AlertTriangle, Server, Sparkles, X } from 'lucide-react';

interface RefreshModpacksModalProps {
  isOpen: boolean;
  progress: number;
  statusMessage: string;
  isCompleted?: boolean;
  error?: string | null;
  onClose: () => void;
}

export const RefreshModpacksModal: React.FC<RefreshModpacksModalProps> = ({
  isOpen,
  progress,
  statusMessage,
  isCompleted = false,
  error = null,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200 select-none">
      <div className="relative w-full max-w-md minecraft-panel bg-[#160b0b] p-6 sm:p-7 overflow-hidden text-slate-200 shadow-2xl border-2 border-[#2e1414]">
        {/* Top glowing lava/emerald border line */}
        <div
          className={`absolute top-0 left-0 right-0 h-1 transition-colors duration-300 ${
            error ? 'bg-red-600' : isCompleted ? 'bg-emerald-500' : 'bg-amber-500'
          }`}
        />

        {/* Close Button when finished or errored */}
        {(isCompleted || error) && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 minecraft-btn-lava text-slate-300 hover:text-white transition cursor-pointer"
            title="Cerrar ventana"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* Header */}
        <div className="flex items-center gap-3.5 mb-5 border-b border-[#2d1212] pb-3">
          <div className="w-10 h-10 minecraft-slot flex items-center justify-center bg-black/60 border-stone-800 shrink-0">
            {error ? (
              <AlertTriangle className="w-5 h-5 text-red-400" />
            ) : isCompleted ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            ) : (
              <RotateCw className="w-5 h-5 text-amber-400 animate-spin" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <h3 className="font-minecraft text-sm sm:text-base font-bold text-white minecraft-text-shadow-lava tracking-wide">
              {error
                ? 'ERROR AL ACTUALIZAR'
                : isCompleted
                ? 'SE ACTUALIZÓ EL MODPACK'
                : 'ACTUALIZANDO MODPACK'}
            </h3>
            <p className="text-[10px] font-minecraft text-stone-400">
              ChaosLauncher Central Backend Sync
            </p>
          </div>
        </div>

        {/* Center illustration & status message */}
        <div className="space-y-4 mb-5">
          <div className={`p-3 bg-black/60 border flex items-center gap-3 ${error ? 'border-red-600/70 bg-red-950/20' : 'border-[#2d1212]'}`}>
            <Server className={`w-4 h-4 shrink-0 ${error ? 'text-red-400' : 'text-amber-400'}`} />
            <span className={`font-minecraft text-xs truncate ${error ? 'text-red-300 font-bold' : 'text-stone-200'}`}>
              {error ? error : (statusMessage || 'Sincronizando información de servidores...')}
            </span>
          </div>

          {/* Minecraft Progress Bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-[10px] font-minecraft">
              <span className="text-stone-400">PROGRESO DE SINCRONIZACIÓN</span>
              <span className="text-amber-400 font-bold">{Math.round(progress)}%</span>
            </div>

            <div className="w-full h-5 bg-black border-2 border-[#3d1818] p-0.5 relative overflow-hidden shadow-inner">
              <div
                className={`h-full transition-all duration-300 relative ${
                  error
                    ? 'bg-red-600'
                    : isCompleted
                    ? 'bg-gradient-to-r from-emerald-600 to-emerald-400'
                    : 'bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-400'
                }`}
                style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
              >
                {/* Diagonal stripes texture */}
                <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(0,0,0,0.2)_25%,transparent_25%,transparent_50%,rgba(0,0,0,0.2)_50%,rgba(0,0,0,0.2)_75%,transparent_75%,transparent)] bg-[length:12px_12px] opacity-60" />
              </div>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        {(isCompleted || error) && (
          <div className="pt-2 border-t border-[#2d1212] flex justify-end">
            <button
              onClick={onClose}
              className={`px-5 py-2 text-xs font-minecraft cursor-pointer transition ${
                isCompleted
                  ? 'minecraft-btn-green text-white font-bold'
                  : 'minecraft-btn-lava text-white'
              }`}
            >
              <span>{isCompleted ? 'LISTO' : 'CERRAR'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
