import React, { useState, useEffect } from 'react';
import { 
  Play, 
  Settings, 
  RefreshCw, 
  FolderOpen, 
  Loader2, 
  Download, 
  Trash2,
  Anvil,
  ChevronDown,
  UserPlus,
  Sparkles,
  Sliders,
  CheckCircle2,
  AlertCircle,
  Cpu,
  Coffee,
  Check,
  ShieldCheck,
  Clock,
  ExternalLink,
  X
} from 'lucide-react';
import { marked } from 'marked';
import { DiscordPixelIcon } from './DiscordPixelIcon';
import { ModpackManifest, ModpackItem, DownloadProgress, LauncherConfig, UserAccount, OptionalMod, JavaInstallation } from '../vite-env';
import netherBg from '../assets/nether_bg.jpg';

interface MimicServerCardProps {
  activeAccount: UserAccount | null;
  modpack?: ModpackItem | null;
  manifest: ModpackManifest | null;
  config: LauncherConfig | null;
  isDownloading: boolean;
  downloadProgress: DownloadProgress | null;
  isGameRunning: boolean;
  onLaunch: () => void;
  onSyncMods: () => void;
  onCancelSync?: () => void;
  onOpenUpdateModal?: () => void;
  onDeleteModpack?: () => void;
  onOpenFolder: () => void;
  onRefresh: () => void;
  onRefreshModpackList?: () => void;
  onOpenLoginModal: () => void;
  onConfigChange?: (updatedConfig: LauncherConfig) => void;
}

export const MimicServerCard: React.FC<MimicServerCardProps> = ({
  activeAccount,
  modpack,
  manifest,
  config,
  isDownloading,
  downloadProgress,
  isGameRunning,
  onLaunch,
  onSyncMods,
  onCancelSync,
  onOpenUpdateModal,
  onDeleteModpack,
  onOpenFolder,
  onRefresh,
  onRefreshModpackList,
  onOpenLoginModal,
  onConfigChange,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'play' | 'mods' | 'rules' | 'discord' | 'changelog' | 'settings'>('play');
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  // Estado del servidor (En línea / Desconectado)
  const [serverStatus, setServerStatus] = useState<{ online: boolean; players: number; max: number } | null>(null);
  const [checkingServer, setCheckingServer] = useState(true);

  // Mods opcionales para la pestaña Installations
  const [optionalMods, setOptionalMods] = useState<OptionalMod[]>([]);
  const [disabledMods, setDisabledMods] = useState<string[]>([]);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  // Estados de Settings (RAM & Java)
  const [ramMb, setRamMb] = useState(config?.allocatedRamMb || 4096);
  const [totalSystemRamMb, setTotalSystemRamMb] = useState(16384);
  const [javaList, setJavaList] = useState<JavaInstallation[]>([]);
  const [selectedJava, setSelectedJava] = useState(config?.javaPath || '');
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [isJavaDropdownOpen, setIsJavaDropdownOpen] = useState(false);

  // Valores derivados (DESPUÉS de inicializar todos los estados)
  const hasOptionalMods = Boolean(
    modpack?.hasOptionalMods !== false &&
    ((modpack?.optionalMods && modpack.optionalMods.length > 0) ||
      (manifest?.optionalMods && manifest.optionalMods.length > 0) ||
      optionalMods.length > 0)
  );
  const hasRules = Boolean(modpack?.hasRules || manifest?.hasRules);
  const hasDiscord = Boolean(modpack?.hasDiscord || manifest?.hasDiscord);
  const hasChangelog = modpack?.hasChangelog !== false && manifest?.hasChangelog !== false;

  const rulesContent = modpack?.rulesContent || manifest?.rulesContent || '';
  const discordUrl = modpack?.discordUrl || manifest?.discordUrl || '';
  const changelogList =
    manifest?.changelog && manifest.changelog.length > 0
      ? manifest.changelog
      : modpack?.changelog || [];

  // Sincronizar estado cuando cambie config
  useEffect(() => {
    if (config) {
      if (config.allocatedRamMb) setRamMb(config.allocatedRamMb);
      setSelectedJava(config.javaPath || '');
    }
  }, [config]);

  // Cargar memoria total del sistema y lista de Java
  useEffect(() => {
    if (!window.chaosAPI) return;
    window.chaosAPI.system.getSystemMemory().then((mb) => {
      if (mb > 0) setTotalSystemRamMb(mb);
    }).catch(console.error);

    window.chaosAPI.system.getJavaList().then((list) => {
      setJavaList(list);
    }).catch(console.error);
  }, []);

  const handleSaveSettings = async (overrideRam?: number, overrideJava?: string) => {
    const targetRam = overrideRam ?? ramMb;
    const targetJava = overrideJava !== undefined ? overrideJava : selectedJava;
    try {
      if (window.chaosAPI) {
        const updated = await window.chaosAPI.config.update({
          allocatedRamMb: targetRam,
          javaPath: targetJava,
        });
        onConfigChange?.(updated);
      }
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 2200);
    } catch (err) {
      console.error('Error al guardar ajustes:', err);
    }
  };

  const serverIp = modpack?.serverIp || manifest?.server?.ip || '';
  const modpackName = modpack?.name || manifest?.name || 'Servidor Minecraft';
  const modpackLoaderType = (modpack?.loaderType || manifest?.loader?.type || 'fabric').toLowerCase();
  const modpackLoaderVer = modpack?.loaderVersion || manifest?.loader?.version || '';
  const modpackMcVer = modpack?.minecraftVersion || manifest?.minecraftVersion || '1.20.1';
  const recommendedRam = modpack?.recommendedRam || manifest?.recommendedRam || 4096;
  const wallpaperUrl = modpack?.wallpaperUrl || manifest?.wallpaperUrl || netherBg;
  const iconUrl = modpack?.iconUrl || manifest?.iconUrl;

  const installedVersion = config?.installedModpackVersion;
  const isInstalled = Boolean(installedVersion);
  const isUpToDate = isInstalled && installedVersion === manifest?.version;

  // Comprobar estado del servidor periódicamente
  useEffect(() => {
    checkServerStatus();
    const interval = setInterval(checkServerStatus, 25000);
    return () => clearInterval(interval);
  }, [serverIp]);

  const checkServerStatus = async () => {
    if (!serverIp) {
      setCheckingServer(false);
      setServerStatus(null);
      return;
    }
    try {
      if (window.chaosAPI?.system?.getServerStatus) {
        const res = await window.chaosAPI.system.getServerStatus(serverIp);
        setServerStatus(res);
      } else {
        const res = await fetch(`https://api.mcsrvstat.us/3/${serverIp}`);
        const data = await res.json();
        setServerStatus({
          online: Boolean(data?.online),
          players: data?.players?.online || 0,
          max: data?.players?.max || 20,
        });
      }
    } catch {
      setServerStatus({ online: false, players: 0, max: 20 });
    } finally {
      setCheckingServer(false);
    }
  };

  // Cargar mods opcionales para Installations
  useEffect(() => {
    loadOptionalMods();
  }, [modpack?.tag, modpack?.optionalMods, manifest?.optionalMods]);

  // Si se eliminaron los mods opcionales estando en la pestaña mods, regresar a play
  useEffect(() => {
    if (activeSubTab === 'mods' && !hasOptionalMods) {
      setActiveSubTab('play');
    }
  }, [hasOptionalMods, activeSubTab]);

  const loadOptionalMods = async () => {
    const tag = modpack?.tag;
    if (!tag) return;
    try {
      const res = await window.chaosAPI?.modpack?.getOptionalMods(tag);
      if (res && Array.isArray(res.optionalMods)) {
        setOptionalMods(res.optionalMods);
        setDisabledMods(res.disabled || []);
        return;
      }
    } catch (err) {
      console.warn('Error al cargar mods opcionales de API:', err);
    }
    if (manifest && Array.isArray(manifest.optionalMods)) {
      setOptionalMods(manifest.optionalMods);
    } else if (modpack && Array.isArray(modpack.optionalMods)) {
      setOptionalMods(modpack.optionalMods);
    } else {
      setOptionalMods([]);
    }
  };

  const handleRefreshModpack = async () => {
    if (isDownloading) return;
    await onRefresh();
    await loadOptionalMods();
  };

  const handleRefreshModpackList = async () => {
    if (isDownloading) return;
    if (onRefreshModpackList) {
      await onRefreshModpackList();
    } else {
      await onRefresh();
    }
    await loadOptionalMods();
  };

  const handleToggleMod = async (mod: OptionalMod) => {
    const isCurrentlyDisabled = disabledMods.includes(mod.file);
    const willEnable = isCurrentlyDisabled;

    try {
      const res = await window.chaosAPI?.modpack?.toggleOptionalMod(mod.file, willEnable);
      if (res) {
        setDisabledMods(res.currentDisabled);
        setStatusMsg(
          willEnable
            ? `✅ "${mod.name}" activado correctamente.`
            : `⚡ "${mod.name}" desactivado (.disabled). Mayor rendimiento liberado.`
        );
        setTimeout(() => setStatusMsg(null), 3000);
      }
    } catch (err: any) {
      setStatusMsg(`❌ Error: ${err.message || 'No se pudo cambiar el mod'}`);
    }
  };

  const handleDeleteClick = () => {
    setProfileMenuOpen(false);
    if (
      window.confirm(
        `¿Estás seguro de que deseas eliminar "${modpackName}" de la lista y de la memoria?\n\nEsto borrará todas las carpetas, archivos descargados y datos en memoria de este modpack.`
      )
    ) {
      onDeleteModpack?.();
    }
  };

  return (
    <div className="h-full w-full flex flex-col justify-between relative overflow-hidden select-none bg-[#0a0606]">
      {/* 1. TOP SUB-HEADER (Color del Launcher #110808 con borde negro estilo Minecraft) */}
      <div className="relative z-20 bg-[#110808] border-b-2 border-black px-8 pt-3 pb-0 flex items-center justify-between">
        <div className="flex flex-col">
          {/* Categoría superior */}
          <span className="text-[10px] font-minecraft font-bold tracking-widest text-amber-400 uppercase minecraft-text-shadow-amber">
            {modpackName.toUpperCase()}: SERVER EDITION
          </span>

          {/* Pestañas horizontales estilo Minecraft Tab */}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <button
              type="button"
              disabled={isDownloading}
              onClick={() => {
                if (isDownloading) return;
                setActiveSubTab('play');
              }}
              className={`px-4 py-1.5 text-xs font-minecraft tracking-wider transition rounded-none ${
                isDownloading ? 'opacity-40 cursor-not-allowed pointer-events-none' : 'cursor-pointer'
              } ${
                activeSubTab === 'play'
                  ? 'minecraft-btn-lava border-b-3 border-b-emerald-400 font-bold text-white'
                  : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              Play
            </button>

            {hasOptionalMods && (
              <button
                type="button"
                disabled={isDownloading}
                onClick={() => {
                  if (isDownloading) return;
                  setActiveSubTab('mods');
                  loadOptionalMods();
                }}
                className={`px-4 py-1.5 text-xs font-minecraft tracking-wider transition rounded-none ${
                  isDownloading ? 'opacity-40 cursor-not-allowed pointer-events-none' : 'cursor-pointer'
                } ${
                  activeSubTab === 'mods'
                    ? 'minecraft-btn-lava border-b-3 border-b-emerald-400 font-bold text-white'
                    : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
                }`}
              >
                Mods
              </button>
            )}

            {hasRules && (
              <button
                type="button"
                disabled={isDownloading}
                onClick={() => {
                  if (isDownloading) return;
                  setActiveSubTab('rules');
                }}
                className={`px-4 py-1.5 text-xs font-minecraft tracking-wider transition rounded-none ${
                  isDownloading ? 'opacity-40 cursor-not-allowed pointer-events-none' : 'cursor-pointer'
                } ${
                  activeSubTab === 'rules'
                    ? 'minecraft-btn-lava border-b-3 border-b-cyan-400 font-bold text-white'
                    : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
                }`}
              >
                Normas
              </button>
            )}

            {hasDiscord && (
              <button
                type="button"
                disabled={isDownloading}
                onClick={() => {
                  if (isDownloading) return;
                  setActiveSubTab('discord');
                }}
                className={`px-4 py-1.5 text-xs font-minecraft tracking-wider transition rounded-none flex items-center gap-1.5 ${
                  isDownloading ? 'opacity-40 cursor-not-allowed pointer-events-none' : 'cursor-pointer'
                } ${
                  activeSubTab === 'discord'
                    ? 'minecraft-btn-lava border-b-3 border-b-[#5865F2] font-bold text-white'
                    : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
                }`}
              >
                <DiscordPixelIcon className="w-3.5 h-3.5 text-[#828bf7]" />
                <span>Discord</span>
              </button>
            )}

            {hasChangelog && (
              <button
                type="button"
                disabled={isDownloading}
                onClick={() => {
                  if (isDownloading) return;
                  setActiveSubTab('changelog');
                }}
                className={`px-4 py-1.5 text-xs font-minecraft tracking-wider transition rounded-none ${
                  isDownloading ? 'opacity-40 cursor-not-allowed pointer-events-none' : 'cursor-pointer'
                } ${
                  activeSubTab === 'changelog'
                    ? 'minecraft-btn-lava border-b-3 border-b-purple-400 font-bold text-white'
                    : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
                }`}
              >
                Changelog
              </button>
            )}

            <button
              type="button"
              disabled={isDownloading}
              onClick={() => {
                if (isDownloading) return;
                setActiveSubTab('settings');
              }}
              className={`px-4 py-1.5 text-xs font-minecraft tracking-wider transition rounded-none ${
                isDownloading ? 'opacity-40 cursor-not-allowed pointer-events-none' : 'cursor-pointer'
              } ${
                activeSubTab === 'settings'
                  ? 'minecraft-btn-lava border-b-3 border-b-emerald-400 font-bold text-white'
                  : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              Settings
            </button>
          </div>
        </div>

        {/* Estado del Servidor: EN LÍNEA o DESCONECTADO (Minecraft Card) */}
        <div className="flex items-center gap-2 mb-2">
          {checkingServer ? (
            <div className="flex items-center gap-2 minecraft-card rounded-none px-3 py-1 text-slate-400 font-minecraft text-xs">
              <span className="w-2 h-2 bg-amber-400 animate-pulse" />
              <span>Comprobando...</span>
            </div>
          ) : serverStatus?.online ? (
            <div 
              className="flex items-center gap-2 minecraft-card rounded-none border-emerald-500/50 px-3.5 py-1.5 shadow-sm"
              title={`Servidor: ${serverIp}`}
            >
              <span className="w-2.5 h-2.5 bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]" />
              <span className="font-minecraft font-bold text-xs text-emerald-300 tracking-wider minecraft-text-shadow">
                EN LÍNEA
              </span>
              {serverStatus.players > 0 && (
                <span className="text-[11px] font-minecraft text-emerald-400/90 font-semibold ml-0.5">
                  ({serverStatus.players}/{serverStatus.max})
                </span>
              )}
            </div>
          ) : (
            <div 
              className="flex items-center gap-2 minecraft-card rounded-none border-red-500/50 px-3.5 py-1.5 shadow-sm"
              title={`Servidor: ${serverIp}`}
            >
              <span className="w-2.5 h-2.5 bg-red-500" />
              <span className="font-minecraft font-bold text-xs text-red-400 tracking-wider minecraft-text-shadow-lava">
                DESCONECTADO
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 2. CENTRAL HERO CANVAS */}
      <div className="flex-1 relative overflow-hidden flex flex-col items-center justify-center">
        {/* Fondo dinámico del servidor o Nether */}
        <div className="absolute inset-0 z-0">
          <img
            src={wallpaperUrl}
            alt={modpackName}
            className="w-full h-full object-cover object-center filter brightness-[0.92]"
            onError={(e) => {
              (e.target as HTMLImageElement).src = netherBg;
            }}
          />
          {/* Gradiente inferior hacia el fondo del launcher */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a0606] via-transparent to-black/25" />
        </div>

        {/* ======================================================== */}
        {/* PESTAÑA PLAY: Logo del Modpack en el centro + BOTÓN GRANDE */}
        {/* ======================================================== */}
        {activeSubTab === 'play' && (
          <div className="relative z-10 flex flex-col items-center justify-center text-center animate-in fade-in duration-300 px-4">
            {/* Logo o Título del Modpack */}
            <div className="relative flex flex-col items-center gap-3">
              {(() => {
                const titleMode = modpack?.titleDisplayMode || manifest?.titleDisplayMode || 'BOTH';
                const titleImg = modpack?.titleImageUrl || manifest?.titleImageUrl;

                // 1. Solo Banner de Imagen
                if (titleMode === 'IMAGE_ONLY' && titleImg) {
                  return (
                    <img
                      src={titleImg}
                      alt={modpackName}
                      className="w-auto max-h-32 sm:max-h-40 object-contain filter drop-shadow-[0_10px_30px_rgba(0,0,0,0.95)] max-w-[85vw]"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  );
                }

                // 2. Solo Texto con letra de Minecraft (Blanco, sin marco ni fondo)
                if (titleMode === 'TEXT_ONLY') {
                  const displayText = modpack?.titleText || manifest?.titleText || modpackName.toUpperCase();
                  return (
                    <h1 className="text-3xl sm:text-5xl font-minecraft font-bold text-white tracking-wider minecraft-text-shadow filter drop-shadow-[0_4px_16px_rgba(0,0,0,0.95)]">
                      {displayText}
                    </h1>
                  );
                }

                // 3. Solo Icono
                if (titleMode === 'ICON_ONLY') {
                  return iconUrl ? (
                    <img
                      src={iconUrl}
                      alt={modpackName}
                      className="w-24 h-24 sm:w-32 sm:h-32 object-contain filter drop-shadow-[0_10px_30px_rgba(0,0,0,0.95)]"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : null;
                }

                // 4. BOTH (Banner de imagen o icono + Título escrito blanco sin marco)
                const bothDisplayText = modpack?.titleText || manifest?.titleText || modpackName.toUpperCase();
                return (
                  <div className="flex flex-col items-center gap-3">
                    {titleImg ? (
                      <img
                        src={titleImg}
                        alt={modpackName}
                        className="w-auto max-h-28 sm:max-h-36 object-contain filter drop-shadow-[0_10px_30px_rgba(0,0,0,0.95)] max-w-[85vw]"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : iconUrl ? (
                      <img
                        src={iconUrl}
                        alt={modpackName}
                        className="w-auto h-24 sm:h-28 object-contain filter drop-shadow-[0_10px_30px_rgba(0,0,0,0.95)] max-w-[85vw]"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : null}

                    <h1 className="text-2xl sm:text-4xl font-minecraft font-bold text-white tracking-wider minecraft-text-shadow filter drop-shadow-[0_4px_16px_rgba(0,0,0,0.95)]">
                      {bothDisplayText}
                    </h1>
                  </div>
                );
              })()}
            </div>

            {/* BOTÓN CON DISEÑO FULL MINECRAFT Y BARRA DE PROGRESO INLINE */}
            <div className="mt-10 sm:mt-12 mb-3 flex flex-col items-center">
              {!activeAccount ? (
                /* CASO 1: Sin cuenta activa -> Bloqueado hasta iniciar sesión */
                <button
                  onClick={onOpenLoginModal}
                  className="minecraft-btn-green w-80 sm:w-[420px] max-w-[90vw] h-16 sm:h-20 px-8 flex items-center justify-center gap-4 font-minecraft font-bold text-2xl sm:text-3xl text-white uppercase cursor-pointer rounded-none minecraft-text-shadow tracking-wider"
                >
                  <UserPlus className="w-7 h-7 sm:w-8 sm:h-8 shrink-0 filter drop-shadow-[2px_2px_0_#143e10]" />
                  <span>INICIAR SESIÓN</span>
                </button>
              ) : isGameRunning ? (
                /* CASO 2: Juego en ejecución */
                <div className="minecraft-btn-gray w-80 sm:w-[420px] max-w-[90vw] h-16 sm:h-20 px-8 flex items-center justify-center gap-4 font-minecraft font-bold text-xl sm:text-2xl text-slate-200 uppercase rounded-none minecraft-text-shadow-gray tracking-wider">
                  <Loader2 className="w-7 h-7 sm:w-8 sm:h-8 animate-spin text-white shrink-0" />
                  <span>JUEGO EN EJECUCIÓN</span>
                </div>
              ) : isDownloading ? (
                /* CASO 3: Descargando / Sincronizando (Barra de progreso estilo Minecraft Lava / Carmesí Chaos Launcher) */
                <div className="minecraft-progress-container w-84 sm:w-[440px] max-w-[92vw] p-4 flex flex-col gap-2.5 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between text-xs sm:text-sm font-minecraft text-white tracking-wider px-0.5">
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-orange-500" />
                      <span className="minecraft-text-shadow-lava">{downloadProgress?.stage === 'extracting' ? 'EXTRAYENDO ARCHIVOS...' : 'DESCARGANDO MODPACK...'}</span>
                    </div>
                    <span className="text-orange-400 font-bold tracking-widest text-base minecraft-text-shadow-lava">
                      {downloadProgress?.percent || 0}%
                    </span>
                  </div>

                  <div className="w-full h-5 bg-[#0b0404] border-2 border-[#360e0e] p-[2px] overflow-hidden">
                    <div
                      className="h-full minecraft-progress-fill transition-all duration-150"
                      style={{ width: `${Math.max(2, downloadProgress?.percent || 0)}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] font-mono text-orange-200/90 px-0.5">
                    <span className="truncate max-w-[260px]">
                      {downloadProgress?.stage === 'extracting' ? 'Descomprimiendo modpack...' : 'Sincronizando archivos con el servidor...'}
                    </span>
                    {downloadProgress?.speedBytesPerSec ? (
                      <span className="shrink-0 font-bold ml-2 text-orange-400">
                        {(downloadProgress.speedBytesPerSec / (1024 * 1024)).toFixed(1)} MB/s
                      </span>
                    ) : null}
                  </div>

                  {/* BOTÓN CANCELAR DESCARGA */}
                  {onCancelSync && (
                    <div className="mt-1 pt-2 border-t border-[#331111] flex justify-center">
                      <button
                        type="button"
                        onClick={onCancelSync}
                        className="minecraft-btn-lava w-full py-2 px-4 flex items-center justify-center gap-2 font-minecraft text-xs text-white uppercase cursor-pointer active:translate-y-0.5 tracking-wider hover:bg-[#4a1818]"
                      >
                        <X className="w-3.5 h-3.5 text-red-400" />
                        <span>CANCELAR DESCARGA</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : !isInstalled ? (
                /* CASO 4: Sin instalar -> Descargar (Estilo full Minecraft, descarga directa sin modal) */
                <button
                  onClick={onSyncMods}
                  className="minecraft-btn-green w-80 sm:w-[420px] max-w-[90vw] h-16 sm:h-20 px-8 flex items-center justify-center gap-4 font-minecraft font-bold text-3xl sm:text-4xl text-white uppercase cursor-pointer rounded-none minecraft-text-shadow tracking-widest animate-pulse"
                >
                  <Download className="w-8 h-8 sm:w-9 sm:h-9 shrink-0 filter drop-shadow-[2px_2px_0_#143e10]" />
                  <span>DESCARGAR</span>
                </button>
              ) : !isUpToDate ? (
                /* CASO 5: Actualización disponible -> Actualizar (Descarga directa sin modal) */
                <button
                  onClick={onSyncMods}
                  className="minecraft-btn-green w-80 sm:w-[420px] max-w-[90vw] h-16 sm:h-20 px-8 flex items-center justify-center gap-4 font-minecraft font-bold text-3xl sm:text-4xl text-white uppercase cursor-pointer rounded-none minecraft-text-shadow tracking-widest"
                >
                  <Download className="w-8 h-8 sm:w-9 sm:h-9 shrink-0 filter drop-shadow-[2px_2px_0_#143e10]" />
                  <span>ACTUALIZAR</span>
                </button>
              ) : (
                /* CASO 6: Listo para jugar -> Botón verde oficial de Minecraft */
                <button
                  onClick={onLaunch}
                  className="minecraft-btn-green w-80 sm:w-[420px] max-w-[90vw] h-16 sm:h-20 px-8 flex items-center justify-center gap-4 font-minecraft font-bold text-4xl sm:text-5xl text-white uppercase cursor-pointer rounded-none minecraft-text-shadow tracking-widest"
                >
                  <Play className="w-9 h-9 sm:w-10 sm:h-10 fill-white shrink-0 filter drop-shadow-[2px_2px_0_#143e10]" />
                  <span>JUGAR</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* PESTAÑA MODS: Renderizado inline directo */}
        {/* ======================================================== */}
        {activeSubTab === 'mods' && hasOptionalMods && (
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
        )}

        {/* ======================================================== */}
        {/* PESTAÑA NORMAS: Reglamento del Servidor (Formateado)     */}
        {/* ======================================================== */}
        {activeSubTab === 'rules' && hasRules && (
          <div className="relative z-10 w-full max-w-3xl max-h-[82%] overflow-y-auto minecraft-panel rounded-none p-6 sm:p-7 animate-in fade-in duration-200">
            <div className="flex items-center justify-between pb-4 border-b-2 border-black">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-none minecraft-slot text-cyan-400">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-minecraft font-bold text-lg text-white tracking-wide minecraft-text-shadow-lava">
                    REGLAMENTO DEL SERVIDOR
                  </h3>
                  <p className="text-xs text-cyan-400/90 font-minecraft mt-0.5">
                    Pautas y normas de convivencia de {modpackName}
                  </p>
                </div>
              </div>
            </div>

            <div
              className="prose prose-invert max-w-none space-y-3 font-minecraft text-xs sm:text-sm text-stone-200 leading-relaxed pt-5
                [&>h1]:text-xl [&>h1]:font-bold [&>h1]:text-amber-400 [&>h1]:border-b [&>h1]:border-amber-600/40 [&>h1]:pb-2 [&>h1]:mb-3
                [&>h2]:text-base [&>h2]:font-bold [&>h2]:text-emerald-400 [&>h2]:mt-4 [&>h2]:mb-2
                [&>h3]:text-sm [&>h3]:font-bold [&>h3]:text-cyan-400
                [&>p]:text-stone-300 [&>p]:leading-relaxed
                [&>ul]:list-disc [&>ul]:list-inside [&>ul]:space-y-1.5 [&>ul>li]:text-stone-200
                [&>ol]:list-decimal [&>ol]:list-inside [&>ol]:space-y-1.5 [&>ol>li]:text-stone-200
                [&>blockquote]:border-l-4 [&>blockquote]:border-amber-500 [&>blockquote]:bg-amber-950/20 [&>blockquote]:p-3 [&>blockquote]:text-amber-300 [&>blockquote]:my-3
                [&>hr]:border-stone-800 [&>hr]:my-4
                [&>strong]:text-white [&>strong]:font-bold"
              dangerouslySetInnerHTML={{
                __html: rulesContent
                  ? (marked.parse(rulesContent, { breaks: true, gfm: true }) as string)
                  : '<p class="text-stone-400 italic">No se han especificado normas para este modpack.</p>'
              }}
            />
          </div>
        )}

        {/* ======================================================== */}
        {/* PESTAÑA DISCORD: Comunidad & Botón Azul 3D Pixelado      */}
        {/* ======================================================== */}
        {activeSubTab === 'discord' && hasDiscord && (
          <div className="relative z-10 w-full max-w-2xl max-h-[82%] overflow-y-auto minecraft-panel rounded-none p-6 sm:p-7 animate-in fade-in duration-200 text-center space-y-6">
            <div className="flex items-center justify-between pb-4 border-b-2 border-black text-left">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-none minecraft-slot text-[#828bf7]">
                  <DiscordPixelIcon className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-minecraft font-bold text-lg text-white tracking-wide minecraft-text-shadow">
                    COMUNIDAD DE DISCORD
                  </h3>
                  <p className="text-xs text-[#828bf7] font-minecraft mt-0.5">
                    Servidor oficial de {modpackName}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-8 minecraft-card border-[#5865F2]/50 bg-[#0f111c] space-y-6 max-w-lg mx-auto">
              <div className="w-16 h-16 rounded-none minecraft-slot text-[#828bf7] mx-auto flex items-center justify-center bg-black/60 border-[#5865F2]">
                <DiscordPixelIcon className="w-10 h-10" />
              </div>

              <div className="space-y-1.5">
                <h4 className="font-minecraft text-xl font-bold text-white minecraft-text-shadow">
                  {modpackName.toUpperCase()}
                </h4>
                <p className="text-xs text-stone-300 font-sans">
                  Únete a nuestra comunidad para enterarte de eventos, actualizaciones y recibir soporte en vivo.
                </p>
              </div>

              {/* Botón Azul Minecraft 3D con ícono pixelado */}
              <div className="pt-2 flex justify-center">
                <button
                  onClick={() => {
                    if (discordUrl) {
                      window.open(discordUrl, '_blank');
                    } else {
                      alert('No se ha configurado la URL de Discord para este modpack.');
                    }
                  }}
                  className="minecraft-btn-discord px-8 py-4 font-minecraft font-bold text-sm tracking-wider flex items-center justify-center gap-3 cursor-pointer shadow-xl hover:scale-105 transition"
                >
                  <DiscordPixelIcon className="w-6 h-6" />
                  <span>UNIRSE A DISCORD</span>
                </button>
              </div>

              {discordUrl && (
                <span className="text-[10px] font-mono text-stone-400 block pt-1 truncate">
                  {discordUrl}
                </span>
              )}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* PESTAÑA CHANGELOG: Historial de Novedades y Versiones     */}
        {/* ======================================================== */}
        {activeSubTab === 'changelog' && hasChangelog && (
          <div className="relative z-10 w-full max-w-3xl max-h-[82%] overflow-y-auto minecraft-panel rounded-none p-6 sm:p-7 animate-in fade-in duration-200 space-y-4">
            <div className="flex items-center justify-between pb-4 border-b-2 border-black">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-none minecraft-slot text-purple-400">
                  <Clock className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-minecraft font-bold text-lg text-white tracking-wide minecraft-text-shadow-lava">
                    NOTAS DE LA VERSIÓN (v{manifest?.version || modpack?.version || '1.0.0'})
                  </h3>
                  <p className="text-xs text-purple-400/90 font-minecraft mt-0.5">
                    Historial de actualizaciones y mejoras
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              {changelogList.length > 0 ? (
                changelogList.map((item, idx) => (
                  <div
                    key={idx}
                    className="minecraft-slot p-3.5 flex items-start gap-3 bg-[#0f0707] border-stone-800"
                  >
                    <span className="text-purple-400 font-minecraft text-sm shrink-0 mt-0.5">◆</span>
                    <span className="text-xs sm:text-sm text-stone-200 font-minecraft leading-relaxed">
                      {item}
                    </span>
                  </div>
                ))
              ) : (
                <div className="p-6 text-center text-xs font-minecraft text-stone-400">
                  No hay notas de versión registradas para esta entrega.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* PESTAÑA SETTINGS: Ajustes de RAM, Java y Optimizaciones */}
        {/* ======================================================== */}
        {activeSubTab === 'settings' && (
          <div className="relative z-10 w-full max-w-3xl max-h-[82%] overflow-y-auto minecraft-panel rounded-none p-6 sm:p-7 animate-in fade-in duration-200">
            {/* Header de Ajustes */}
            <div className="flex items-center justify-between pb-4 border-b-2 border-black">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-none minecraft-slot text-red-400">
                  <Settings className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-minecraft font-bold text-lg text-white tracking-wide minecraft-text-shadow-lava">
                    AJUSTES DE RENDIMIENTO & MODPACK
                  </h3>
                  <p className="text-xs text-amber-400 font-minecraft mt-0.5">
                    Asignación de memoria RAM, selector de Java y optimizaciones
                  </p>
                </div>
              </div>

              {settingsSaved && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-none minecraft-card border-emerald-500/50 text-xs font-minecraft text-emerald-300 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>¡GUARDADO!</span>
                </div>
              )}
            </div>

            <div className="py-5 space-y-6">
              {/* SECCIÓN 1: ASIGNACIÓN DE RAM */}
              <div className="p-4 sm:p-5 rounded-none minecraft-card space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Cpu className="w-5 h-5 text-orange-400" />
                    <div>
                      <h4 className="font-minecraft font-bold text-sm text-white tracking-wide minecraft-text-shadow-lava">
                        MEMORIA RAM ASIGNADA
                      </h4>
                      <p className="text-[11px] text-slate-300 font-minecraft mt-0.5">
                        Recomendado para {modpackName}: {Math.round(recommendedRam / 1024)} GB
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-minecraft text-base font-bold text-orange-400 minecraft-slot px-3 py-1 rounded-none border border-orange-500/30">
                      {(ramMb / 1024).toFixed(1)} GB
                    </span>
                  </div>
                </div>

                {/* Slider de RAM */}
                <input
                  type="range"
                  min={2048}
                  max={Math.max(4096, totalSystemRamMb - 2048)}
                  step={512}
                  value={ramMb}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    setRamMb(val);
                    handleSaveSettings(val, undefined);
                  }}
                  className="w-full h-2.5 rounded-none bg-black accent-emerald-500 cursor-pointer"
                />

                <div className="flex justify-between text-[11px] text-slate-400 font-minecraft">
                  <span>Mínimo: 2 GB</span>
                  <span className="text-amber-400">Recomendado: 6 - 8 GB</span>
                  <span>Total PC: {(totalSystemRamMb / 1024).toFixed(0)} GB</span>
                </div>

                {/* Presets rápidos de RAM */}
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#260c0c]">
                  <span className="text-xs text-slate-400 font-minecraft mr-1">Presets:</span>
                  {[4096, 6144, 8192, 10240, 12288].filter(mb => mb <= totalSystemRamMb - 1024).map((mb) => (
                    <button
                      key={mb}
                      onClick={() => {
                        setRamMb(mb);
                        handleSaveSettings(mb, undefined);
                      }}
                      className={`px-3 py-1 rounded-none text-xs font-minecraft font-semibold transition cursor-pointer ${
                        ramMb === mb
                          ? 'minecraft-btn-green'
                          : 'minecraft-btn-lava'
                      }`}
                    >
                      {mb / 1024} GB
                    </button>
                  ))}
                </div>
              </div>

              {/* SECCIÓN 2: SELECTOR DE VERSIÓN DE JAVA */}
              <div className="p-4 sm:p-5 rounded-none minecraft-card space-y-3 relative">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Coffee className="w-5 h-5 text-amber-400" />
                    <div>
                      <h4 className="font-minecraft font-bold text-sm text-white tracking-wide minecraft-text-shadow-lava">
                        EJECUTABLE DE JAVA (JVM)
                      </h4>
                      <p className="text-[11px] text-slate-300 font-minecraft mt-0.5">
                        Minecraft 1.21.1 requiere Java 21 o superior
                      </p>
                    </div>
                  </div>

                  <span className="text-[9px] font-minecraft font-bold text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded-none border border-emerald-800/40">
                    Java 21 Requerido
                  </span>
                </div>

                {/* Custom dropdown */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsJavaDropdownOpen(!isJavaDropdownOpen)}
                    className="w-full px-3.5 py-2.5 rounded-none minecraft-input flex items-center justify-between text-xs text-white transition group cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 truncate font-minecraft">
                      <Coffee className="w-4 h-4 text-amber-400 shrink-0" />
                      <span className="truncate">
                        {selectedJava
                          ? javaList.find((j) => j.path === selectedJava)
                            ? `Java ${javaList.find((j) => j.path === selectedJava)!.majorVersion} (${javaList.find((j) => j.path === selectedJava)!.version})`
                            : selectedJava
                          : 'Automático (Detectar automáticamente la mejor versión)'}
                      </span>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-slate-400 group-hover:text-white transition-transform ${isJavaDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {isJavaDropdownOpen && (
                    <div className="absolute left-0 right-0 top-full mt-1.5 rounded-none minecraft-panel p-1.5 z-50 space-y-1 animate-in fade-in duration-150 max-h-48 overflow-y-auto">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedJava('');
                          setIsJavaDropdownOpen(false);
                          handleSaveSettings(undefined, '');
                        }}
                        className={`w-full p-2.5 rounded-none text-left text-xs font-minecraft transition flex items-center justify-between cursor-pointer ${
                          !selectedJava ? 'minecraft-card text-emerald-300 font-bold' : 'text-slate-300 hover:bg-white/5'
                        }`}
                      >
                        <div className="truncate">
                          <div>Automático (Recomendado)</div>
                          <div className="text-[10px] text-slate-400">Busca automáticamente Java 21 en el sistema</div>
                        </div>
                        {!selectedJava && <Check className="w-4 h-4 text-emerald-400 shrink-0 ml-2" />}
                      </button>

                      {javaList.map((inst) => (
                        <button
                          key={inst.path}
                          type="button"
                          onClick={() => {
                            setSelectedJava(inst.path);
                            setIsJavaDropdownOpen(false);
                            handleSaveSettings(undefined, inst.path);
                          }}
                          className={`w-full p-2.5 rounded-none text-left text-xs font-minecraft transition flex items-center justify-between cursor-pointer ${
                            selectedJava === inst.path ? 'minecraft-card text-emerald-300 font-bold' : 'text-slate-300 hover:bg-white/5'
                          }`}
                        >
                          <div className="truncate pr-2">
                            <div className="text-white font-medium">Java {inst.majorVersion} ({inst.version})</div>
                            <div className="text-[10px] text-slate-400 truncate">{inst.path}</div>
                          </div>
                          {selectedJava === inst.path && <Check className="w-4 h-4 text-emerald-400 shrink-0 ml-2" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* SECCIÓN 3: CARPETA DEL JUEGO */}
              <div className="p-4 sm:p-5 rounded-none minecraft-card flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-none minecraft-slot text-orange-400">
                    <FolderOpen className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-minecraft font-bold text-sm text-white tracking-wide minecraft-text-shadow-lava">
                      DIRECTORIO DE INSTALACIÓN
                    </h4>
                    <p className="text-[11px] text-slate-300 font-mono truncate max-w-sm mt-0.5">
                      {config?.gameDir || 'Cargando directorio...'}
                    </p>
                  </div>
                </div>

                <button
                  onClick={onOpenFolder}
                  className="minecraft-btn-lava px-3.5 py-2 rounded-none text-xs text-slate-200 transition font-minecraft cursor-pointer"
                >
                  Abrir Carpeta
                </button>
              </div>
            </div>

            {/* Footer de Ajustes */}
            <div className="pt-4 border-t-2 border-black flex items-center justify-between">
              <span className="text-xs text-slate-400 font-minecraft">
                Los cambios se guardan y aplican automáticamente para {modpackName}.
              </span>

              <button
                onClick={() => handleSaveSettings()}
                className="minecraft-btn-green px-6 py-2.5 font-minecraft text-xs text-white uppercase rounded-none minecraft-text-shadow tracking-wider cursor-pointer"
              >
                {settingsSaved ? '¡AJUSTES GUARDADOS!' : 'GUARDAR AJUSTES'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 3. DOCKED BOTTOM BAR (Color del launcher #110808 con borde #260c0c y espaciado vertical) */}
      <div className="relative z-30 h-20 sm:h-22 bg-[#110808] border-t border-[#260c0c] flex items-center justify-between px-8 py-3 shadow-2xl">
        {/* LEFT: Selector de Perfil / Modloader con estilo Minecraft 3D */}
        <div className="relative flex items-center my-auto">
          <div
            onClick={() => {
              if (isDownloading) return;
              setProfileMenuOpen(!profileMenuOpen);
            }}
            className={`flex items-center gap-3 minecraft-card rounded-none px-3.5 py-2 border-2 border-black bg-[#150909] ${
              isDownloading ? 'opacity-50 cursor-not-allowed pointer-events-none' : 'hover:bg-[#220d0d] cursor-pointer active:translate-y-0.5'
            } group shadow-2xl`}
          >
            {/* Ícono estilo Minecraft Slot */}
            <div className="w-10 h-10 minecraft-slot rounded-none flex items-center justify-center text-amber-400 shrink-0 p-1">
              {iconUrl ? (
                <img
                  src={iconUrl}
                  alt={modpackName}
                  className="w-full h-full object-contain filter drop-shadow"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/assets/chaos_icon.png';
                  }}
                />
              ) : (
                <Anvil className="w-6 h-6 text-amber-400" />
              )}
            </div>

            {/* Título y versión con tipografía Minecraft */}
            <div className="flex flex-col text-left">
              <span className="font-minecraft font-bold text-xs sm:text-sm text-white leading-tight tracking-wide minecraft-text-shadow">
                {modpackName}
              </span>
              <span className="font-minecraft text-[10px] sm:text-[11px] text-amber-400 font-semibold leading-tight mt-1 tracking-wider">
                {modpackMcVer} - {modpackLoaderType}{modpackLoaderVer ? `-${modpackLoaderVer}` : ''}
              </span>
            </div>

            <ChevronDown className={`w-4 h-4 text-amber-400 group-hover:text-white transition-transform ml-2 ${
              profileMenuOpen ? 'rotate-180' : ''
            }`} />
          </div>

          {/* Menú desplegable estilo Minecraft Panel */}
          {profileMenuOpen && (
            <div className="absolute bottom-full left-0 mb-3 w-64 rounded-none minecraft-panel p-2 z-50 animate-in fade-in duration-150 space-y-1">
              <div className="px-3 py-1.5 text-[10px] font-minecraft uppercase tracking-wider text-amber-400 border-b border-[#2d1010] mb-1">
                Opciones de Instalación
              </div>

              <button
                onClick={() => {
                  setActiveSubTab('installations');
                  setProfileMenuOpen(false);
                  loadOptionalMods();
                }}
                className="w-full flex items-center gap-2.5 p-2 rounded-none text-xs font-minecraft text-slate-200 hover:bg-[#2b1010] transition cursor-pointer"
              >
                <Sliders className="w-4 h-4 text-amber-400" />
                <span>Ajustes de Mods (Shaders)</span>
              </button>

              <button
                onClick={() => {
                  setActiveSubTab('settings');
                  setProfileMenuOpen(false);
                }}
                className="w-full flex items-center gap-2.5 p-2 rounded-none text-xs font-minecraft text-slate-200 hover:bg-[#2b1010] transition cursor-pointer"
              >
                <Cpu className="w-4 h-4 text-orange-400" />
                <span>Ajustes de RAM y Java</span>
              </button>

              <button
                onClick={() => {
                  onOpenFolder();
                  setProfileMenuOpen(false);
                }}
                className="w-full flex items-center gap-2.5 p-2 rounded-none text-xs font-minecraft text-slate-200 hover:bg-[#2b1010] transition cursor-pointer"
              >
                <FolderOpen className="w-4 h-4 text-orange-400" />
                <span>Abrir Carpeta de Mods</span>
              </button>

              <button
                onClick={() => {
                  handleRefreshModpack();
                  setProfileMenuOpen(false);
                }}
                className="w-full flex items-center gap-2.5 p-2 rounded-none text-xs font-minecraft text-slate-200 hover:bg-[#2b1010] transition cursor-pointer"
              >
                <RefreshCw className="w-4 h-4 text-slate-300" />
                <span>Comprobar Actualizaciones</span>
              </button>

              <div className="h-[1px] bg-[#2d1010] my-1" />
              <button
                onClick={handleDeleteClick}
                className="w-full flex items-center gap-2.5 p-2 rounded-none text-xs font-minecraft text-red-400 hover:bg-red-950/60 hover:text-red-300 transition cursor-pointer group"
                title="Elimina el modpack de la lista, borra de la memoria y elimina carpetas y archivos locales"
              >
                <Trash2 className="w-4 h-4 text-red-400 group-hover:scale-110 transition-transform shrink-0" />
                <span>Eliminar de memoria</span>
              </button>
            </div>
          )}
        </div>

        {/* RIGHT: Botón Actualizar Modpack + Avatar de la cuenta / Conectar cuenta */}
        <div className="flex items-center gap-2.5 my-auto">
          {/* Botón Minecraft de actualizar / recargar información del modpack */}
          <button
            type="button"
            disabled={isDownloading}
            onClick={handleRefreshModpackList}
            className={`h-12 w-12 flex items-center justify-center minecraft-btn-amber ${
              isDownloading ? 'opacity-40 cursor-not-allowed pointer-events-none' : 'cursor-pointer active:translate-y-0.5'
            } shrink-0`}
            title={isDownloading ? 'Descarga en progreso...' : 'Recargar y sincronizar este modpack'}
          >
            <RefreshCw className="w-5 h-5 text-amber-300 filter drop-shadow-[1px_1px_0_#4a2a00]" />
          </button>

          {activeAccount ? (
            <div className="flex items-center gap-3 minecraft-card rounded-none px-4 py-2 border-2 border-black">
              <div className="text-right">
                <div className="text-xs sm:text-sm font-bold text-white leading-tight font-minecraft minecraft-text-shadow-lava">
                  {activeAccount.name}
                </div>
                <div className="text-[10px] text-emerald-400 font-minecraft font-semibold mt-0.5">
                  {activeAccount.type === 'microsoft' ? 'Premium' : 'Offline'}
                </div>
              </div>
              <div className="w-10 h-10 minecraft-slot rounded-none flex items-center justify-center shrink-0">
                <img
                  src={activeAccount.skinUrl}
                  alt={activeAccount.name}
                  className="w-8 h-8 object-cover shadow"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://mc-heads.net/avatar/Steve/100';
                  }}
                />
              </div>
            </div>
          ) : (
            <button
              onClick={onOpenLoginModal}
              className="minecraft-btn-green flex items-center gap-2.5 px-4 py-2.5 rounded-none text-xs sm:text-sm text-white font-minecraft font-semibold transition cursor-pointer minecraft-text-shadow"
            >
              <UserPlus className="w-4 h-4 text-white" />
              <span>Conectar Cuenta</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export const ModpackServerCard = MimicServerCard;

