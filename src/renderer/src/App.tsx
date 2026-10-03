import React, { useState, useEffect } from 'react';
import { 
  Play, 
  Flame, 
  AlertTriangle, 
  CheckCircle2, 
  Download, 
  FolderOpen, 
  Loader2,
  RefreshCw,
  Anvil
} from 'lucide-react';
import { 
  UserAccount, 
  AuthState, 
  UpdateCheckResult, 
  DownloadProgress, 
  LauncherConfig,
  ModpackItem,
  AppUpdateInfo,
  AppUpdateProgress
} from './vite-env';
import { TitleBar } from './components/TitleBar';
import { Sidebar } from './components/Sidebar';
import { LoginModal } from './components/LoginModal';
import { MandatoryUpdateModal } from './components/MandatoryUpdateModal';
import { AppUpdateModal } from './components/AppUpdateModal';
import { SettingsDrawer } from './components/SettingsDrawer';
import { MimicServerCard } from './components/MimicServerCard';
import { RefreshModpacksModal } from './components/RefreshModpacksModal';
import logoTransparent from './assets/logo_transparent.png';

export const App: React.FC = () => {
  // Estados principales
  const [authState, setAuthState] = useState<AuthState>({ activeAccount: null, accounts: [] });
  const [updateResult, setUpdateResult] = useState<UpdateCheckResult | null>(null);
  const [config, setConfig] = useState<LauncherConfig | null>(null);

  // Estados de auto-actualización de Chaos Launcher
  const [appUpdateInfo, setAppUpdateInfo] = useState<AppUpdateInfo | null>(null);
  const [isAppUpdateModalOpen, setIsAppUpdateModalOpen] = useState(false);
  const [appUpdateProgress, setAppUpdateProgress] = useState<AppUpdateProgress | null>(null);
  const [isAppUpdating, setIsAppUpdating] = useState(false);
  const [isAppUpdateDownloaded, setIsAppUpdateDownloaded] = useState(false);
  const [appUpdateError, setAppUpdateError] = useState<string | null>(null);

  // Modpacks dinámicos del backend
  const [modpacks, setModpacks] = useState<ModpackItem[]>([]);
  const [selectedModpackTag, setSelectedModpackTag] = useState<string | null>(null);

  // Navegación
  const [activeNavTab, setActiveNavTab] = useState<'modpack' | 'play'>('play');
  const [activeSubTab, setActiveSubTab] = useState<'play' | 'installations' | 'patch_notes'>('play');

  // Estados de descarga y juego
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
  const [isGameRunning, setIsGameRunning] = useState(false);
  const [launchProgress, setLaunchProgress] = useState<any>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [launchError, setLaunchError] = useState<string | null>(null);

  // Modales y drawers
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isRefreshingModpacks, setIsRefreshingModpacks] = useState(false);
  const [refreshProgress, setRefreshProgress] = useState(0);
  const [refreshStatusText, setRefreshStatusText] = useState('');
  const [isRefreshCompleted, setIsRefreshCompleted] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  // Cargar datos al iniciar
  useEffect(() => {
    if (!window.chaosAPI) return;

    // Comprobar actualización del Launcher inmediatamente al arrancar
    window.chaosAPI.updater?.checkForUpdates?.().catch(console.error);

    // 1. Cargar sesión de usuario
    window.chaosAPI.auth.getState().then((state) => {
      setAuthState(state);
      if (!state.activeAccount) {
        setIsLoginModalOpen(true);
      }
    }).catch(console.error);

    // 2. Cargar configuración y modpacks
    window.chaosAPI.config.get().then((cfg) => {
      setConfig(cfg);
      // Cargar lista de modpacks desde el backend
      window.chaosAPI.modpack.getAll().then((list) => {
        setModpacks(list);
        if (list && list.length > 0) {
          const initialTag = (cfg.activeModpackTag && list.some(m => m.tag === cfg.activeModpackTag))
            ? cfg.activeModpackTag
            : list[0].tag;
          setSelectedModpackTag(initialTag);
          checkModpackUpdates(initialTag);
          if (cfg.activeModpackTag && list.some(m => m.tag === cfg.activeModpackTag)) {
            setActiveNavTab('modpack');
          } else {
            setActiveNavTab('play');
          }
        } else {
          setSelectedModpackTag(null);
          setActiveNavTab('play');
        }
      }).catch((err) => {
        console.error('Error cargando modpacks del backend:', err);
        setSelectedModpackTag(null);
        setActiveNavTab('play');
      });
    }).catch(console.error);

    // 4. Suscribirse a eventos de descarga de modpack
    const unsubModpack = window.chaosAPI.modpack.onProgress((prog) => {
      setDownloadProgress(prog);
      if (prog.stage === 'completed') {
        setIsDownloading(false);
        setIsUpdateModalOpen(false);
        window.chaosAPI.config.get().then(setConfig).catch(console.error);
        checkModpackUpdates();
      } else if (prog.stage === 'error') {
        setIsDownloading(false);
      }
    });

    // 5. Suscribirse a eventos del lanzador de Minecraft
    const unsubLaunchProg = window.chaosAPI.launcher.onProgress((prog) => {
      setLaunchProgress(prog);
    });

    const unsubLaunchLog = window.chaosAPI.launcher.onLog((line) => {
      setLogs((prev) => [...prev.slice(-300), line]);
    });

    const unsubLaunchClosed = window.chaosAPI.launcher.onClosed(() => {
      setIsGameRunning(false);
      setLaunchProgress(null);
    });

    const unsubLaunchErr = window.chaosAPI.launcher.onError((err) => {
      setIsGameRunning(false);
      setLaunchProgress(null);
      setLaunchError(err);
    });

    // 6. Suscribirse a eventos de auto-actualización del Launcher
    const unsubAppUpdate = window.chaosAPI.updater?.onUpdateAvailable?.((info) => {
      console.log('[App] Nueva versión de Chaos Launcher detectada:', info);
      setAppUpdateInfo(info);
      setAppUpdateError(null);
      setIsAppUpdateModalOpen(true);
    });

    const unsubAppProg = window.chaosAPI.updater?.onDownloadProgress?.((prog) => {
      setAppUpdateProgress(prog);
      setAppUpdateError(null);
    });

    const unsubAppDownloaded = window.chaosAPI.updater?.onUpdateDownloaded?.((info) => {
      console.log('[App] Actualización del launcher descargada:', info);
      setIsAppUpdating(false);
      setIsAppUpdateDownloaded(true);
      setAppUpdateError(null);
    });

    const unsubAppErr = window.chaosAPI.updater?.onError?.((err) => {
      console.warn('[App] Error en actualizador del Launcher:', err);
      setIsAppUpdating(false);
      setAppUpdateError(err);
    });

    return () => {
      unsubModpack();
      unsubLaunchProg();
      unsubLaunchLog();
      unsubLaunchClosed();
      unsubLaunchErr();
      if (unsubAppUpdate) unsubAppUpdate();
      if (unsubAppProg) unsubAppProg();
      if (unsubAppDownloaded) unsubAppDownloaded();
      if (unsubAppErr) unsubAppErr();
    };
  }, []);

  const handleStartAppUpdate = () => {
    setIsAppUpdating(true);
    setAppUpdateError(null);
    window.chaosAPI.updater?.startDownload?.().catch((err) => {
      console.error('Error iniciando descarga de actualización del launcher:', err);
      setIsAppUpdating(false);
      setAppUpdateError(err?.message || String(err));
    });
  };

  const handleQuitAndInstallApp = () => {
    window.chaosAPI.updater?.quitAndInstall?.();
  };

  const checkModpackUpdates = async (tag?: string) => {
    try {
      if (!window.chaosAPI) return;
      const targetTag = tag || selectedModpackTag || undefined;
      const res = await window.chaosAPI.modpack.checkUpdate(targetTag);
      setUpdateResult(res);

      // Si el backend se encendió o se actualizaron metadatos, refrescar también la lista en pantalla
      try {
        const freshList = await window.chaosAPI.modpack.getAll();
        if (Array.isArray(freshList)) {
          setModpacks(freshList);
        }
      } catch (e) {
        // Fallback si no hay conexión
      }

      const freshCfg = await window.chaosAPI.config.get();
      setConfig(freshCfg);
    } catch (err) {
      console.error('Error al verificar modpack:', err);
    }
  };

  const handleSelectModpack = (tag: string) => {
    if (isDownloading) return;
    setSelectedModpackTag(tag);
    setActiveNavTab('modpack');
    checkModpackUpdates(tag);
    if (window.chaosAPI) {
      window.chaosAPI.config.update({ activeModpackTag: tag }).catch(console.error);
    }
  };

  const handleStartUpdate = async () => {
    try {
      setIsDownloading(true);
      setLaunchError(null);
      await window.chaosAPI.modpack.downloadUpdate(selectedModpackTag || undefined);
      checkModpackUpdates(selectedModpackTag || undefined);
    } catch (err: any) {
      setIsDownloading(false);
      if (err.message && err.message.includes('cancelada')) {
        console.log('Descarga cancelada correctamente.');
      } else {
        setLaunchError(err.message || 'Error al descargar la actualización.');
      }
    }
  };

  const handleCancelUpdate = async () => {
    try {
      await window.chaosAPI?.modpack.cancelDownload();
    } catch (e) {
      console.warn('Error al cancelar descarga:', e);
    } finally {
      setIsDownloading(false);
      setDownloadProgress(null);
      checkModpackUpdates(selectedModpackTag || undefined);
    }
  };

  const handleDeleteModpack = async () => {
    try {
      const tagToDelete = selectedModpackTag || undefined;
      await window.chaosAPI?.modpack.deleteModpack(tagToDelete);

      // Eliminar de la lista de modpacks en memoria local
      const remainingModpacks = modpacks.filter((m) => m.tag !== tagToDelete);
      setModpacks(remainingModpacks);

      const freshCfg = await window.chaosAPI?.config.get();
      if (freshCfg) setConfig(freshCfg);

      // Redirigir inmediatamente a CHAOS LAUNCHER
      setActiveNavTab('play');

      if (remainingModpacks.length > 0) {
        setSelectedModpackTag(remainingModpacks[0].tag);
        checkModpackUpdates(remainingModpacks[0].tag);
      } else {
        setSelectedModpackTag(null);
        setUpdateResult(null);
      }
    } catch (err) {
      console.error('Error al eliminar modpack:', err);
    }
  };

  const handleLaunchGame = async () => {
    // Si no está instalado o hay actualización pendiente, descargar directamente sin modal
    if (!config?.installedModpackVersion || (updateResult?.isUpdateAvailable && updateResult?.isMandatory)) {
      handleStartUpdate();
      return;
    }

    if (!authState.activeAccount) {
      setIsLoginModalOpen(true);
      return;
    }

    setLaunchError(null);
    setIsGameRunning(true);

    try {
      await window.chaosAPI.launcher.launch();
    } catch (err: any) {
      setIsGameRunning(false);
      setLaunchError(err.message || 'Error al iniciar Minecraft.');
    }
  };

  const handleLogout = async () => {
    const newState = await window.chaosAPI.auth.logout();
    setAuthState(newState);
    setIsLoginModalOpen(true);
  };

  const handleSwitchAccount = async (id: string) => {
    const newState = await window.chaosAPI.auth.switchAccount(id);
    setAuthState(newState);
  };

  const handleDeleteAccount = async (id: string) => {
    if (!window.chaosAPI) return;
    const newState = await window.chaosAPI.auth.deleteAccount(id);
    setAuthState(newState);
  };

  const handleRefreshModpacks = async () => {
    if (isRefreshingModpacks || isDownloading || !window.chaosAPI) return;
    setIsRefreshingModpacks(true);
    setRefreshProgress(15);
    setRefreshStatusText('Conectando con ChaosLauncher Backend...');
    setIsRefreshCompleted(false);
    setRefreshError(null);

    try {
      await new Promise((r) => setTimeout(r, 350));
      setRefreshProgress(45);
      setRefreshStatusText('Descargando catálogo de modpacks y servidores...');

      const updatedList = await window.chaosAPI.modpack.refreshList();

      setRefreshProgress(80);
      setRefreshStatusText('Sincronizando manifiestos y recursos visuales...');
      await new Promise((r) => setTimeout(r, 350));

      setModpacks(updatedList);
      setRefreshProgress(100);
      setRefreshStatusText('Se actualizó el modpack');
      setIsRefreshCompleted(true);

      const targetTag =
        selectedModpackTag && updatedList.some((m) => m.tag === selectedModpackTag)
          ? selectedModpackTag
          : updatedList[0]?.tag || null;
      setSelectedModpackTag(targetTag);
      if (targetTag) {
        setActiveNavTab('modpack');
        await checkModpackUpdates(targetTag);
      }

      setTimeout(() => {
        setIsRefreshingModpacks(false);
      }, 1200);
    } catch (err: any) {
      console.error('Error al actualizar servidores:', err);
      setRefreshProgress(100);
      const errMsg = 'Error al actualizar: problemas con el servidor.';
      setRefreshError(errMsg);
      setRefreshStatusText(errMsg);
    }
  };

  const activeModpack = modpacks.find((m) => m.tag === selectedModpackTag) || modpacks[0] || null;
  const manifest = updateResult?.manifest;
  const isUpdateRequired = !!(updateResult?.isUpdateAvailable && updateResult?.isMandatory);

  return (
    <div className="h-screen w-screen flex flex-col bg-[#080505] text-slate-100 overflow-hidden relative select-none">
      {/* 1. TitleBar Frameless */}
      <TitleBar
        onMinimize={() => window.chaosAPI?.window.minimize()}
        onMaximize={() => window.chaosAPI?.window.maximize()}
        onClose={() => window.chaosAPI?.window.close()}
      />

      {/* 2. Cuerpo Principal (Sidebar + Main Content) */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Sidebar (Idéntico a la estructura de la imagen) */}
        <Sidebar
          activeAccount={authState.activeAccount}
          accounts={authState.accounts}
          modpacks={modpacks}
          selectedModpackTag={selectedModpackTag}
          onSelectModpack={handleSelectModpack}
          onRefreshModpacks={handleRefreshModpacks}
          isDownloading={isDownloading}
          activeNavTab={activeNavTab}
          onSelectNavTab={(tab) => {
            setActiveNavTab(tab as any);
            if (tab === 'modpack') setActiveSubTab('play');
            if (tab === 'play') setActiveSubTab('play');
          }}
          onLogout={handleLogout}
          onSwitchAccount={handleSwitchAccount}
          onDeleteAccount={handleDeleteAccount}
          onOpenLoginModal={() => setIsLoginModalOpen(true)}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />

        {/* Right Main Area */}
        <div className="flex-1 flex flex-col bg-[#0b0606] overflow-hidden relative">
          {/* Central Content */}
          <div className="flex-1 relative overflow-y-auto">
            {/* Error Banner */}
            {launchError && (
              <div className="absolute top-4 left-6 right-6 z-30 flex items-center justify-between p-3.5 minecraft-panel bg-[#200808] border-red-700 text-red-200 text-xs shadow-lg">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                  <span className="minecraft-text-shadow-lava">{launchError}</span>
                </div>
                <button
                  onClick={() => setLaunchError(null)}
                  className="minecraft-btn-lava px-2.5 py-1 text-white text-xs cursor-pointer ml-4"
                >
                  Cerrar
                </button>
              </div>
            )}

            {/* TAB: MODPACK SERVER (Dedicated Hub - Official Launcher Style) */}
            {activeNavTab === 'modpack' && modpacks.length > 0 && activeModpack && (
              <MimicServerCard
                activeAccount={authState.activeAccount}
                modpack={activeModpack}
                manifest={manifest || null}
                config={config}
                isDownloading={isDownloading}
                downloadProgress={downloadProgress}
                isGameRunning={isGameRunning}
                onLaunch={handleLaunchGame}
                onSyncMods={handleStartUpdate}
                onCancelSync={handleCancelUpdate}
                onOpenUpdateModal={() => setIsUpdateModalOpen(true)}
                onDeleteModpack={handleDeleteModpack}
                onOpenFolder={() => config && window.chaosAPI?.system.openFolder(config.gameDir)}
                onRefresh={() => checkModpackUpdates(selectedModpackTag || undefined)}
                onRefreshModpackList={handleRefreshModpacks}
                onOpenLoginModal={() => setIsLoginModalOpen(true)}
                onConfigChange={(updated) => setConfig(updated)}
              />
            )}

            {/* TAB: JUGAR (Nether / Lava Theme Artwork like the screenshot) */}
            {activeNavTab === 'play' && activeSubTab === 'play' && (
              <div className="h-full w-full relative flex flex-col justify-between p-8 overflow-hidden select-none">
                {/* Fondo Estilo Lava / Nether (Inspirado en la imagen) */}
                <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
                  {/* Gradiente de fondo rojo fuego y negro obsidiana */}
                  <div className="absolute inset-0 bg-gradient-to-b from-[#1a0808] via-[#0d0404] to-[#080202]" />

                  {/* Resplandores de Lava */}
                  <div className="absolute -bottom-24 left-1/4 w-[600px] h-[350px] bg-red-600/25 rounded-full blur-[120px] animate-lava-flow" />
                  <div className="absolute top-1/3 -right-24 w-[450px] h-[300px] bg-orange-600/20 rounded-full blur-[100px]" />
                  <div className="absolute top-10 left-10 w-[300px] h-[200px] bg-amber-600/15 rounded-full blur-[90px]" />

                  {/* Patrón de lava y chispas simuladas */}
                  <div className="absolute bottom-0 inset-x-0 h-44 bg-gradient-to-t from-red-600/30 via-orange-600/15 to-transparent" />
                </div>

                {/* Minimalist Central Brand */}
                <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center select-none py-6">
                  <div className="relative mb-6">
                    <img
                      src={logoTransparent}
                      alt="Chaos Logo"
                      className="relative w-44 h-44 object-contain filter drop-shadow-[0_0_25px_rgba(255,40,0,0.7)]"
                      style={{ imageRendering: 'pixelated' }}
                    />
                  </div>

                  <h1 className="font-gamer font-bold text-5xl sm:text-6xl tracking-widest text-white drop-shadow-[0_4px_20px_rgba(255,30,0,0.5)] mb-3 minecraft-text-shadow-lava">
                    CHAOS LAUNCHER
                  </h1>

                  <div className="flex items-center gap-2 mb-8">
                    <span className="px-3 py-1 minecraft-card bg-black/60 text-red-300 tracking-wider text-xs font-semibold">
                      Creador: Goddark83
                    </span>
                  </div>

                  {/* Estado de Descarga o Juego (si están activos) */}
                  {isDownloading && (
                    <div className="flex flex-col items-center gap-2.5 animate-in fade-in duration-200">
                      <div className="px-8 py-3 minecraft-panel bg-black/90 text-white font-gamer text-base flex items-center gap-3">
                        <Loader2 className="w-4 h-4 animate-spin text-red-400" />
                        <span>DESCARGANDO... {downloadProgress?.percent || 0}%</span>
                      </div>
                      <div className="w-64 h-3 minecraft-slot bg-black/90 p-0.5 overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-red-600 to-amber-500 transition-all duration-200" 
                          style={{ width: `${downloadProgress?.percent || 0}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {isGameRunning && (
                    <div className="px-8 py-3 minecraft-panel bg-[#142614] border-emerald-600 text-emerald-300 font-bold text-sm tracking-widest flex items-center gap-2.5">
                      <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                      <span className="minecraft-text-shadow-green">JUEGO EN EJECUCIÓN</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB: INSTALACIONES & MODS */}
            {activeSubTab === 'installations' && (
              <div className="p-8 space-y-4 select-none">
                <div className="flex items-center justify-between pb-3 border-b-2 border-black">
                  <h2 className="font-gamer font-bold text-2xl text-white tracking-wide minecraft-text-shadow-lava">
                    INSTALACIÓN Y MODPACK
                  </h2>
                  <button
                    onClick={() => config && window.chaosAPI?.system.openFolder(config.gameDir)}
                    className="flex items-center gap-2 px-3 py-2 minecraft-btn-lava text-xs text-stone-200 cursor-pointer"
                  >
                    <FolderOpen className="w-3.5 h-3.5 text-orange-400" />
                    <span className="minecraft-text-shadow-lava">Abrir Carpeta de Mods</span>
                  </button>
                </div>

                <div className="minecraft-panel bg-[#140a0a] p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 minecraft-slot p-2 flex items-center justify-center text-red-400">
                      <Anvil className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-gamer font-bold text-lg text-white minecraft-text-shadow-lava">
                        {manifest?.name || activeModpack?.name || 'Chaos Launcher'}
                      </h3>
                      <div className="text-xs text-stone-400">
                        Minecraft {manifest?.minecraftVersion || '1.20.1'} | Loader: {manifest?.loader.type || 'fabric'} ({manifest?.loader.version || '0.15.11'})
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2 text-xs">
                    <div className="minecraft-card bg-black/40 p-2.5">
                      <span className="text-stone-400">Versión Instalada:</span>{' '}
                      <strong className="text-white">v{config?.installedModpackVersion || 'Sin instalar'}</strong>
                    </div>
                    <div className="minecraft-card bg-black/40 p-2.5">
                      <span className="text-stone-400">Versión en Servidor:</span>{' '}
                      <strong className="text-orange-400">v{manifest?.version || '1.0.0'}</strong>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: NOVEDADES DEL PACK */}
            {activeSubTab === 'patch_notes' && (
              <div className="p-8 space-y-4 select-none">
                <h2 className="font-gamer font-bold text-2xl text-white tracking-wide pb-3 border-b-2 border-black minecraft-text-shadow-lava">
                  NOTAS DEL PARCHE & CHANGELOG
                </h2>
                <div className="minecraft-panel bg-[#140a0a] p-5 space-y-3">
                  <div className="flex items-center gap-2 text-orange-400 font-bold text-lg">
                    <Flame className="w-5 h-5 text-red-500" />
                    <span className="minecraft-text-shadow-lava">Versión {manifest?.version || '1.0.0'}</span>
                  </div>
                  <div className="space-y-2 text-xs text-stone-300">
                    {manifest?.changelog?.map((line, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        <span className="text-red-500">▶</span>
                        <span>{line}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modales y Drawers */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onLoginOffline={async (nick) => {
          const res = await window.chaosAPI.auth.loginOffline(nick);
          setAuthState(res);
        }}
        onLoginMicrosoft={async () => {
          const res = await window.chaosAPI.auth.loginMicrosoft();
          setAuthState(res);
        }}
      />

      <MandatoryUpdateModal
        isOpen={isUpdateModalOpen}
        manifest={manifest || null}
        currentVersion={config?.installedModpackVersion || null}
        progress={downloadProgress}
        isDownloading={isDownloading}
        onStartUpdate={handleStartUpdate}
        onClose={() => setIsUpdateModalOpen(false)}
      />

      <SettingsDrawer
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        config={config}
        onSaveConfig={async (partial) => {
          const updated = await window.chaosAPI.config.update(partial);
          setConfig(updated);
        }}
        onOpenFolder={(dir) => window.chaosAPI?.system.openFolder(dir)}
      />

      <RefreshModpacksModal
        isOpen={isRefreshingModpacks}
        progress={refreshProgress}
        statusMessage={refreshStatusText}
        isCompleted={isRefreshCompleted}
        error={refreshError}
        onClose={() => setIsRefreshingModpacks(false)}
      />

      {/* Modal de auto-actualización del Launcher (Obligatorio) */}
      <AppUpdateModal
        isOpen={isAppUpdateModalOpen}
        updateInfo={appUpdateInfo}
        progress={appUpdateProgress}
        isDownloading={isAppUpdating}
        isDownloaded={isAppUpdateDownloaded}
        errorMessage={appUpdateError}
        currentVersion="1.0.0"
        onStartDownload={handleStartAppUpdate}
        onQuitAndInstall={handleQuitAndInstallApp}
      />
    </div>
  );
};

export default App;
