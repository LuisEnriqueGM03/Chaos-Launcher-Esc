import React, { useState, useEffect, useRef } from 'react';
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
  Terminal,
  Server,
  X
} from 'lucide-react';
import { renderSafeMarkdown } from '../utils/safeMarkdown';
import { ModsTab } from './modpack-tabs/ModsTab';
import { RulesTab } from './modpack-tabs/RulesTab';
import { DiscordTab } from './modpack-tabs/DiscordTab';
import { ChangelogTab } from './modpack-tabs/ChangelogTab';
import { SettingsTab } from './modpack-tabs/SettingsTab';
import { ConsoleTab } from './modpack-tabs/ConsoleTab';
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
  isUpdateAvailable?: boolean;
  onLaunch: () => void;
  onSyncMods: () => void;
  onCancelSync?: () => void;
  onOpenUpdateModal?: () => void;
  onDeleteModpack?: () => void;
  onOpenFolder: () => void;
  onRefresh: () => void;
  onRefreshModpackList?: () => void;
  onOpenConsole?: () => void;
  logs?: string[];
  onClearLogs?: () => void;
  keepLauncherOpen?: boolean;
  onKeepLauncherOpenChange?: (keep: boolean) => void;
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
  isUpdateAvailable,
  onLaunch,
  onSyncMods,
  onCancelSync,
  onOpenUpdateModal,
  onDeleteModpack,
  onOpenFolder,
  onRefresh,
  onRefreshModpackList,
  onOpenConsole,
  logs = [],
  onClearLogs,
  keepLauncherOpen = false,
  onKeepLauncherOpenChange,
  onOpenLoginModal,
  onConfigChange,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'play' | 'mods' | 'rules' | 'discord' | 'changelog' | 'settings' | 'console'>('play');
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

  const targetTag = modpack?.tag || manifest?.tag;
  // "Entrar directo al servidor" (por modpack, apagado por defecto; se guarda en el launcher)
  const autoJoin = Boolean(targetTag && config?.autoJoinServerByTag?.[targetTag]);
  const handleToggleAutoJoin = async (enabled: boolean) => {
    if (!targetTag) return;
    try {
      const updated = await window.chaosAPI?.launcher.setAutoJoin(targetTag, enabled);
      if (updated) onConfigChange?.(updated);
    } catch (err) {
      console.warn('No se pudo guardar la preferencia de entrar directo al servidor:', err);
    }
  };
  // Solo cuenta la versión instalada de ESTE modpack (nunca un valor global compartido)
  const installedVersion = (targetTag && config?.installedModpackVersions?.[targetTag]) || null;
  const isInstalled = Boolean(installedVersion);
  // Solo se muestra "Actualizar" cuando hay una actualización confirmada: mientras se comprueba no se asume una
  const isUpToDate = isInstalled && isUpdateAvailable !== true;

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

  // Con la consola activada, al darle Jugar se pasa solo a verla
  const wasGameRunning = useRef(false);
  useEffect(() => {
    if (isGameRunning && !wasGameRunning.current && keepLauncherOpen && onOpenConsole) {
      setActiveSubTab('console');
    }
    wasGameRunning.current = isGameRunning;
  }, [isGameRunning, keepLauncherOpen, onOpenConsole]);

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
      const res = await window.chaosAPI?.modpack?.toggleOptionalMod(mod.file, willEnable, modpack?.tag);
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
                className={`px-4 py-1.5 text-xs font-minecraft tracking-wider transition rounded-none ${
                  isDownloading ? 'opacity-40 cursor-not-allowed pointer-events-none' : 'cursor-pointer'
                } ${
                  activeSubTab === 'discord'
                    ? 'minecraft-btn-lava border-b-3 border-b-[#5865F2] font-bold text-white'
                    : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
                }`}
              >
                Discord
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
                      <span className="minecraft-text-shadow-lava">
                        {downloadProgress?.stage === 'verifying'
                          ? 'VERIFICANDO ARCHIVOS...'
                          : downloadProgress?.stage === 'extracting'
                          ? 'EXTRAYENDO ARCHIVOS...'
                          : 'DESCARGANDO MODPACK...'}
                      </span>
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
                    <span className="truncate max-w-[280px]">
                      {downloadProgress?.stage === 'verifying'
                        ? `Comprobando archivos (${downloadProgress.transferredBytes || 0}/${downloadProgress.totalBytes || 0})...`
                        : downloadProgress?.stage === 'extracting'
                        ? 'Descomprimiendo modpack...'
                        : 'Sincronizando archivos con el servidor...'}
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
          <ModsTab optionalMods={optionalMods} disabledMods={disabledMods} statusMsg={statusMsg} isInstalled={isInstalled} handleRefreshModpack={handleRefreshModpack} handleToggleMod={handleToggleMod} handleDeleteClick={handleDeleteClick} isDownloading={isDownloading} onOpenFolder={onOpenFolder} />
        )}

        {/* ======================================================== */}
        {/* PESTAÑA NORMAS: Reglamento del Servidor (Formateado)     */}
        {/* ======================================================== */}
        {activeSubTab === 'rules' && hasRules && (
          <RulesTab rulesContent={rulesContent} modpackName={modpackName} modpack={modpack} />
        )}

        {/* ======================================================== */}
        {/* PESTAÑA DISCORD: Comunidad & Botón Azul 3D Pixelado      */}
        {/* ======================================================== */}
        {activeSubTab === 'discord' && hasDiscord && (
          <DiscordTab modpackName={modpackName} modpack={modpack} discordUrl={discordUrl} />
        )}

        {/* ======================================================== */}
        {/* PESTAÑA CHANGELOG: Historial de Novedades y Versiones     */}
        {/* ======================================================== */}
        {activeSubTab === 'changelog' && hasChangelog && (
          <ChangelogTab modpack={modpack} changelogList={changelogList} manifest={manifest} />
        )}

        {/* ======================================================== */}
        {/* PESTAÑA SETTINGS: Ajustes de RAM, Java y Optimizaciones */}
        {/* ======================================================== */}
        {activeSubTab === 'console' && (
          <ConsoleTab
            modpackName={modpackName}
            logs={logs}
            onClearLogs={() => onClearLogs?.()}
            isGameRunning={isGameRunning}
            keepLauncherOpen={keepLauncherOpen}
            onKeepLauncherOpenChange={(keep) => onKeepLauncherOpenChange?.(keep)}
          />
        )}

        {activeSubTab === 'settings' && (
          <SettingsTab onOpenFolder={onOpenFolder} modpackName={modpackName} ramMb={ramMb} setRamMb={setRamMb} totalSystemRamMb={totalSystemRamMb} javaList={javaList} selectedJava={selectedJava} setSelectedJava={setSelectedJava} settingsSaved={settingsSaved} isJavaDropdownOpen={isJavaDropdownOpen} setIsJavaDropdownOpen={setIsJavaDropdownOpen} handleSaveSettings={handleSaveSettings} recommendedRam={recommendedRam} config={config} />
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
                  setActiveSubTab('mods');
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
          {/* Entrar directo al servidor del modpack (la IP la define el backend) */}
          {isInstalled && serverIp && (
            <label
              className={`group relative h-12 px-3 flex items-center gap-2 minecraft-btn-amber shrink-0 ${
                isDownloading || isGameRunning
                  ? 'opacity-40 cursor-not-allowed pointer-events-none'
                  : 'cursor-pointer active:translate-y-0.5'
              }`}
            >
              <input
                type="checkbox"
                checked={autoJoin}
                disabled={isDownloading || isGameRunning}
                onChange={(e) => handleToggleAutoJoin(e.target.checked)}
                className="w-4 h-4 accent-emerald-500 cursor-pointer"
                aria-label="Entrar directo al servidor"
              />
              <Server className="w-5 h-5 text-amber-300 filter drop-shadow-[1px_1px_0_#4a2a00]" />

              {/* Tooltip */}
              <div
                role="tooltip"
                className="pointer-events-none absolute bottom-full right-0 mb-3 w-64 p-3 minecraft-panel bg-[#150909] text-left opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50"
              >
                <div className="font-minecraft font-bold text-xs text-amber-300 minecraft-text-shadow-lava uppercase tracking-wide">
                  Entrar directo al servidor
                </div>
                <p className="mt-1.5 text-[11px] leading-snug text-stone-200 font-sans normal-case">
                  Al darle a Jugar, Minecraft se conecta solo a <span className="text-amber-400 font-semibold">{serverIp}</span> sin
                  pasar por el menú principal.
                </p>
                <p className="mt-1.5 text-[10px] text-stone-400 font-sans normal-case">
                  {autoJoin ? 'Activado' : 'Desactivado'} para este modpack. Se guarda en el launcher.
                </p>
              </div>
            </label>
          )}

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

          {/* Consola: salida del juego en tiempo real */}
          {onOpenConsole && (
            <button
              type="button"
              onClick={() => {
                if (activeSubTab === 'console') {
                  setActiveSubTab('play');
                } else {
                  onOpenConsole();
                  setActiveSubTab('console');
                }
              }}
              className={`relative h-12 w-12 flex items-center justify-center minecraft-btn-amber cursor-pointer active:translate-y-0.5 shrink-0 ${
                activeSubTab === 'console' ? 'brightness-125 border-b-4 border-b-emerald-400' : ''
              }`}
              title={activeSubTab === 'console' ? 'Cerrar la consola' : 'Consola del juego (tiempo real)'}
            >
              <Terminal className="w-5 h-5 text-amber-300 filter drop-shadow-[1px_1px_0_#4a2a00]" />
              {isGameRunning && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              )}
            </button>
          )}

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

