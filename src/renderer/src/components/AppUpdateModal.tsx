import React, { useState, useEffect } from 'react';
import { Download, Sparkles, RefreshCw, CheckCircle2, ArrowRight, AlertTriangle } from 'lucide-react';
import { renderSafeMarkdown } from '../utils/safeMarkdown';
import { AppUpdateInfo, AppUpdateProgress } from '../vite-env';
import logoSquare from '../assets/logo_desk_square.png';

interface AppUpdateModalProps {
  isOpen: boolean;
  updateInfo: AppUpdateInfo | null;
  progress: AppUpdateProgress | null;
  isDownloading: boolean;
  isDownloaded: boolean;
  errorMessage?: string | null;
  currentVersion?: string;
  onStartDownload: () => void;
  onQuitAndInstall: () => void;
}

export const AppUpdateModal: React.FC<AppUpdateModalProps> = ({
  isOpen,
  updateInfo,
  progress,
  isDownloading,
  isDownloaded,
  errorMessage,
  currentVersion = '1.0.0',
  onStartDownload,
  onQuitAndInstall,
}) => {
  const [countdown, setCountdown] = useState(5);

  // Cuenta regresiva automática al finalizar la descarga
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isDownloaded && isOpen) {
      setCountdown(5);
      timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            onQuitAndInstall();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isDownloaded, isOpen, onQuitAndInstall]);

  if (!isOpen || !updateInfo) return null;

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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200 select-none">
      <div className="relative w-full max-w-lg minecraft-panel bg-[#160b0b] p-6 sm:p-7 overflow-hidden text-slate-200 shadow-2xl border-2 border-red-900/80">
        {/* Glow de borde superior */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-red-600 via-orange-500 to-amber-500" />

        {/* Header */}
        <div className="flex items-center gap-4 mb-5">
          <div className="minecraft-slot w-14 h-14 p-1 flex items-center justify-center shrink-0 bg-black/60 border-2 border-red-950">
            <img
              src={logoSquare}
              alt="Chaos Launcher"
              className="w-full h-full object-cover"
              style={{ imageRendering: 'pixelated' }}
            />
          </div>
          <div className="pr-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-red-950 text-red-300 border border-red-700/60 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-red-400" />
                ACTUALIZACIÓN OBLIGATORIA
              </span>
            </div>
            <h3 className="font-gamer font-bold text-xl sm:text-2xl text-white tracking-wide mt-1 minecraft-text-shadow-lava">
              CHAOS LAUNCHER
            </h3>
            <div className="flex items-center gap-2 text-xs text-stone-300 mt-0.5">
              <span className="font-mono bg-black/50 px-1.5 py-0.5 border border-white/10 text-stone-400">
                v{currentVersion}
              </span>
              <ArrowRight className="w-3 h-3 text-orange-400 shrink-0" />
              <span className="font-mono font-bold bg-orange-950/80 px-1.5 py-0.5 border border-orange-600/50 text-orange-300">
                v{updateInfo.version}
              </span>
            </div>
          </div>
        </div>

        {/* Estado 1: Disponible para descargar */}
        {!isDownloading && !isDownloaded && (
          <div className="space-y-4">
            <p className="text-xs text-stone-300 leading-relaxed">
              Existe una nueva versión oficial de <span className="text-white font-bold">Chaos Launcher</span>.
              Para garantizar la estabilidad y compatibilidad con los servidores, es necesario actualizar antes de continuar.
            </p>

            {/* Error previo si ocurrió */}
            {errorMessage && (
              <div className="p-3 bg-red-950/90 border-2 border-red-700 text-red-200 text-xs flex items-center gap-2.5">
                <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
                <div>
                  <span className="font-bold block">Error al actualizar:</span>
                  <span className="text-[11px] text-red-300">{errorMessage}</span>
                </div>
              </div>
            )}

            {/* Notas del parche */}
            <div className="minecraft-card bg-black/60 p-3 max-h-40 overflow-y-auto space-y-1.5 border border-red-950/50">
              <span className="text-[10px] font-bold text-orange-400 uppercase tracking-wider block">
                Novedades de la versión:
              </span>
              {updateInfo.releaseNotes ? (
                <div
                  className="text-xs text-stone-300 font-sans leading-relaxed prose prose-invert max-w-none [&_p]:my-1 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_a]:text-orange-400 [&_a]:underline [&_strong]:text-white [&_h1]:text-sm [&_h2]:text-xs [&_h3]:text-xs [&_h1]:font-bold [&_h2]:font-bold [&_li]:my-0.5"
                  dangerouslySetInnerHTML={{
                    __html: (() => {
                      try {
                        return renderSafeMarkdown(updateInfo.releaseNotes);
                      } catch {
                        return '';
                      }
                    })(),
                  }}
                />
              ) : (
                <p className="text-xs text-stone-400 italic">
                  Mejoras de rendimiento, estabilidad y nuevas funciones de Chaos Launcher.
                </p>
              )}
            </div>

            {/* Botón centrado único */}
            <div className="pt-2 flex justify-center">
              <button
                type="button"
                onClick={onStartDownload}
                className="w-full py-3.5 minecraft-btn-green text-white font-bold text-base tracking-wider flex items-center justify-center gap-2.5 transition cursor-pointer uppercase shadow-xl"
              >
                <Download className="w-5 h-5 text-green-200" />
                <span className="minecraft-text-shadow-green">
                  {errorMessage ? 'REINTENTAR ACTUALIZAR' : 'DESCARGAR Y ACTUALIZAR'}
                </span>
              </button>
            </div>
          </div>
        )}

        {/* Estado 2: Descargando */}
        {isDownloading && (
          <div className="space-y-4 py-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-orange-300 flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-orange-400 animate-spin" />
                Descargando actualización del Launcher...
              </span>
              <span className="font-mono font-bold text-white text-sm bg-black/60 px-2 py-0.5 border border-orange-900/60">
                {progress?.percent || 0}%
              </span>
            </div>

            {/* Barra de progreso */}
            <div className="w-full h-4 bg-black/80 minecraft-slot p-0.5 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-orange-600 via-amber-500 to-yellow-400 transition-all duration-200 ease-out shadow-[0_0_10px_rgba(245,158,11,0.5)]"
                style={{ width: `${Math.max(2, Math.min(100, progress?.percent || 0))}%` }}
              />
            </div>

            {/* Estadísticas de descarga */}
            <div className="flex items-center justify-between text-[11px] text-stone-400 font-mono">
              <span>
                {formatBytes(progress?.transferred || 0)} / {formatBytes(progress?.total || 0)}
              </span>
              {progress?.bytesPerSecond ? (
                <span className="text-orange-400">{formatSpeed(progress.bytesPerSecond)}</span>
              ) : null}
            </div>

            <p className="text-[10px] text-stone-400 italic text-center pt-1">
              Por favor, no cierres el launcher durante la descarga.
            </p>
          </div>
        )}

        {/* Estado 3: Completado y listo para reiniciar */}
        {isDownloaded && (
          <div className="space-y-4 py-2 text-center animate-in fade-in duration-300">
            <div className="flex flex-col items-center justify-center gap-2">
              <CheckCircle2 className="w-12 h-12 text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
              <h4 className="font-gamer font-bold text-lg text-emerald-300 tracking-wide minecraft-text-shadow-green">
                ¡ACTUALIZACIÓN DESCARGADA CON ÉXITO!
              </h4>
            </div>

            <p className="text-xs text-stone-300 max-w-sm mx-auto">
              Chaos Launcher se cerrará y reiniciará automáticamente para aplicar la nueva versión en{' '}
              <span className="font-bold text-orange-400 font-mono text-sm">{countdown}s</span>.
            </p>

            <div className="pt-2">
              <button
                type="button"
                onClick={onQuitAndInstall}
                className="w-full py-3.5 minecraft-btn-green text-white font-bold text-sm tracking-wider flex items-center justify-center gap-2 transition cursor-pointer uppercase shadow-lg"
              >
                <Sparkles className="w-4 h-4 text-emerald-200" />
                <span className="minecraft-text-shadow-green">REINICIAR Y APLICAR AHORA</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
