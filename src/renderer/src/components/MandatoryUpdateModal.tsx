import React from 'react';
import { Download, ArrowRight, Loader2, X } from 'lucide-react';
import { ModpackManifest, DownloadProgress } from '../vite-env';
import logoTransparent from '../assets/logo_transparent.png';

interface MandatoryUpdateModalProps {
  isOpen: boolean;
  manifest: ModpackManifest | null;
  currentVersion: string | null;
  progress: DownloadProgress | null;
  isDownloading: boolean;
  onStartUpdate: () => void;
  onClose?: () => void;
}

export const MandatoryUpdateModal: React.FC<MandatoryUpdateModalProps> = ({
  isOpen,
  manifest,
  currentVersion,
  progress,
  isDownloading,
  onStartUpdate,
  onClose,
}) => {
  if (!isOpen || !manifest) return null;

  const isFirstInstall = !currentVersion;

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 MB';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  const formatSpeed = (bytesPerSec: number) => {
    if (!bytesPerSec || bytesPerSec === 0) return '';
    const mbSec = bytesPerSec / (1024 * 1024);
    return `${mbSec.toFixed(2)} MB/s`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200 select-none">
      <div className="relative w-full max-w-lg minecraft-panel bg-[#160b0b] p-6 sm:p-7 overflow-hidden text-slate-200">
        {/* Header alert line */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-amber-500" />

        {/* Close Button (only when not actively downloading) */}
        {onClose && !isDownloading && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 minecraft-btn-lava text-slate-300 hover:text-white transition cursor-pointer"
            title="Cerrar ventana"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* Header with Modpack Logo */}
        <div className="flex items-center gap-4 mb-5">
          <div className="minecraft-slot w-14 h-14 p-1 flex items-center justify-center shrink-0">
            <img
              src={manifest.iconUrl || logoTransparent}
              alt={manifest.name}
              className="w-full h-full object-cover"
              style={{ imageRendering: 'pixelated' }}
              onError={(e) => {
                (e.target as HTMLImageElement).src = logoTransparent;
              }}
            />
          </div>
          <div className="pr-6">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-black/60 text-amber-300 border border-amber-800/60">
                {isFirstInstall ? 'INSTALACIÓN REQUERIDA' : 'ACTUALIZACIÓN DISPONIBLE'}
              </span>
            </div>
            <h3 className="font-gamer font-bold text-xl sm:text-2xl text-white tracking-wide mt-1 minecraft-text-shadow-lava">
              {isFirstInstall ? `INSTALAR ${manifest.name.toUpperCase()}` : `ACTUALIZAR ${manifest.name.toUpperCase()}`}
            </h3>
            <p className="text-xs text-amber-200/70 mt-0.5">
              {isFirstInstall
                ? 'Descarga los componentes necesarios para conectarte al servidor'
                : 'Se requiere la última versión para ingresar al servidor'}
            </p>
          </div>
        </div>

        {/* Version Badges */}
        <div className="flex items-center justify-between p-3 minecraft-card bg-black/40 mb-6">
          <div className="text-center">
            <div className="text-[10px] text-stone-400 uppercase">Tu Versión</div>
            <div className="text-xs font-semibold text-stone-300 mt-0.5">
              {currentVersion ? `v${currentVersion}` : 'Sin instalar'}
            </div>
          </div>

          <ArrowRight className="w-4 h-4 text-amber-400 shrink-0" />

          <div className="text-center">
            <div className="text-[10px] text-amber-400 uppercase font-semibold">
              {isFirstInstall ? 'Versión Modpack' : 'Nueva Versión'}
            </div>
            <div className="text-xs font-bold text-white bg-amber-950/80 px-2 py-0.5 border border-amber-600/50 mt-0.5">
              v{manifest.version}
            </div>
          </div>

          <div className="text-right">
            <div className="text-[10px] text-stone-400 uppercase">Minecraft & Loader</div>
            <div className="text-xs font-semibold text-amber-300 mt-0.5">
              {manifest.minecraftVersion} ({manifest.loader.type})
            </div>
          </div>
        </div>

        {/* Progress or Action Button */}
        {isDownloading ? (
          <div className="space-y-3">
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-amber-300 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                {progress?.stage === 'verifying'
                  ? 'Verificando archivos y firmas SHA-1...'
                  : progress?.stage === 'extracting'
                  ? 'Extrayendo e instalando mods...'
                  : 'Descargando paquete de mods...'}
              </span>
              <span className="font-bold text-white">{progress?.percent || 0}%</span>
            </div>

            {/* Minecraft Pixel Progress Bar */}
            <div className="w-full h-5 minecraft-slot bg-black/90 p-0.5 relative overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-400 transition-all duration-300"
                style={{
                  width: `${progress?.percent || 0}%`,
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -1px 0 rgba(0,0,0,0.4)'
                }}
              />
            </div>

            <div className="flex justify-between text-[11px] text-stone-400">
              <span>
                {progress ? `${formatBytes(progress.transferredBytes)} / ${formatBytes(progress.totalBytes)}` : 'Iniciando descarga...'}
              </span>
              <span>{progress ? formatSpeed(progress.speedBytesPerSec) : ''}</span>
            </div>
          </div>
        ) : (
          <button
            onClick={onStartUpdate}
            className="w-full py-3.5 px-4 minecraft-btn-amber text-white font-bold text-base tracking-wider flex items-center justify-center gap-2.5 cursor-pointer uppercase"
          >
            <Download className="w-5 h-5 text-white" />
            <span className="minecraft-text-shadow-amber">
              {isFirstInstall ? 'DESCARGAR E INSTALAR MODPACK' : 'ACTUALIZAR MODPACK AHORA'}
            </span>
          </button>
        )}
      </div>
    </div>
  );
};
