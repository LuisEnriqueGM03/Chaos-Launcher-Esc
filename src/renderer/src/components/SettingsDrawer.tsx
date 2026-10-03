import React, { useState, useEffect, useRef } from 'react';
import { X, Settings, Cpu, HardDrive, FolderOpen, Check, ChevronDown, Coffee, Sparkles, Trash2, AlertTriangle } from 'lucide-react';
import { LauncherConfig, JavaInstallation } from '../vite-env';

interface SettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  config: LauncherConfig | null;
  onSaveConfig: (partial: Partial<LauncherConfig>) => Promise<void>;
  onOpenFolder: (path: string) => void;
}

export const SettingsDrawer: React.FC<SettingsDrawerProps> = ({
  isOpen,
  onClose,
  config,
  onSaveConfig,
  onOpenFolder,
}) => {
  const [ramMb, setRamMb] = useState(4096);
  const [totalSystemRamMb, setTotalSystemRamMb] = useState(16384);
  const [javaList, setJavaList] = useState<JavaInstallation[]>([]);
  const [selectedJava, setSelectedJava] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [isJavaDropdownOpen, setIsJavaDropdownOpen] = useState(false);
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isSliding, setIsSliding] = useState(false);
  const [isUninstallModalOpen, setIsUninstallModalOpen] = useState(false);
  const [isUninstalling, setIsUninstalling] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let animFrame: number;
    let timer: NodeJS.Timeout;

    if (isOpen) {
      setShouldRender(true);
      animFrame = requestAnimationFrame(() => {
        setIsSliding(true);
      });
    } else if (shouldRender) {
      setIsSliding(false);
      timer = setTimeout(() => {
        setShouldRender(false);
      }, 250);
    }

    return () => {
      if (animFrame) cancelAnimationFrame(animFrame);
      if (timer) clearTimeout(timer);
    };
  }, [isOpen, shouldRender]);

  const handleRequestClose = () => {
    setIsSliding(false);
    setTimeout(() => {
      onClose();
    }, 250);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleRequestClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsJavaDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (config) {
      setRamMb(config.allocatedRamMb || 4096);
      setSelectedJava(config.javaPath || '');
    }

    if (window.chaosAPI) {
      window.chaosAPI.system.getSystemMemory().then((mb) => {
        if (mb > 0) setTotalSystemRamMb(mb);
      }).catch(console.error);

      window.chaosAPI.system.getJavaList().then((list) => {
        setJavaList(list);
      }).catch(console.error);
    }
  }, [config, isOpen]);

  if (!shouldRender || !config) return null;

  const maxRamAvailable = Math.max(4096, totalSystemRamMb - 2048);

  const handleSave = async () => {
    await onSaveConfig({
      allocatedRamMb: ramMb,
      javaPath: selectedJava,
    });
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      handleRequestClose();
    }, 450);
  };

  const handleConfirmUninstall = async () => {
    setIsUninstalling(true);
    try {
      if (window.chaosAPI?.system?.uninstallApp) {
        await window.chaosAPI.system.uninstallApp();
      }
    } catch (err) {
      console.error('Error al desinstalar Chaos Launcher:', err);
      setIsUninstalling(false);
    }
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleRequestClose();
        }
      }}
      className={`fixed inset-0 z-50 flex items-center justify-end bg-black/75 backdrop-blur-sm select-none transition-opacity duration-250 ${
        isSliding ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
    >
      <div
        className={`w-full max-w-md h-full minecraft-panel bg-[#120808] p-6 flex flex-col justify-between overflow-y-auto text-stone-200 transform transition-transform duration-250 ease-out shadow-2xl ${
          isSliding ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b-2 border-black">
            <div className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-red-500" />
              <h3 className="font-gamer font-bold text-lg text-white tracking-wide minecraft-text-shadow-lava">
                AJUSTES DE CHAOS LAUNCHER
              </h3>
            </div>
            <button
              onClick={handleRequestClose}
              className="p-1.5 minecraft-btn-lava text-stone-300 hover:text-white transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* RAM Allocation */}
          <div className="p-4 minecraft-card bg-black/40 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-orange-400" />
                <span className="text-xs font-semibold uppercase text-stone-300">Memoria RAM Asignada</span>
              </div>
              <span className="text-sm font-bold text-orange-300 bg-red-950/80 px-2 py-0.5 border border-red-800/40">
                {(ramMb / 1024).toFixed(1)} GB
              </span>
            </div>

            <input
              type="range"
              min={2048}
              max={maxRamAvailable}
              step={512}
              value={ramMb}
              onChange={(e) => setRamMb(parseInt(e.target.value, 10))}
              className="w-full h-2 rounded-none bg-black accent-red-500 cursor-pointer"
            />

            <div className="flex justify-between text-[11px] text-stone-400">
              <span>Mín: 2 GB</span>
              <span>Recomendado: 4-6 GB</span>
              <span>Máx PC: {(totalSystemRamMb / 1024).toFixed(0)} GB</span>
            </div>
          </div>

          {/* Java Selector Custom Dropdown */}
          <div className="p-4 minecraft-card bg-black/40 space-y-2 relative" ref={dropdownRef}>
            <label className="text-xs font-semibold uppercase text-stone-300 flex items-center justify-between">
              <span>Versión de Java (JVM)</span>
              <span className="text-[10px] text-red-400 font-normal">Java 21 detectado</span>
            </label>

            {/* Custom Dropdown Trigger */}
            <button
              type="button"
              onClick={() => setIsJavaDropdownOpen(!isJavaDropdownOpen)}
              className="w-full px-3 py-2.5 minecraft-input bg-[#1a0a0a] border-2 border-black flex items-center justify-between text-xs text-white transition cursor-pointer group"
            >
              <div className="flex items-center gap-2 truncate">
                <Coffee className="w-3.5 h-3.5 text-red-400 shrink-0" />
                <span className="truncate">
                  {selectedJava
                    ? javaList.find((j) => j.path === selectedJava)
                      ? `Java ${javaList.find((j) => j.path === selectedJava)!.majorVersion} (${javaList.find((j) => j.path === selectedJava)!.version})`
                      : selectedJava
                    : 'Automático (Detectar mejor versión en PC)'}
                </span>
              </div>
              <ChevronDown className={`w-3.5 h-3.5 text-stone-400 group-hover:text-white transition-transform duration-200 shrink-0 ml-1 ${isJavaDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Custom Dropdown List */}
            {isJavaDropdownOpen && (
              <div className="absolute left-4 right-4 top-full mt-1.5 minecraft-panel bg-[#140808] p-1.5 z-50 space-y-1 max-h-48 overflow-y-auto">
                {/* Auto Option */}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedJava('');
                    setIsJavaDropdownOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 text-left text-xs transition cursor-pointer ${
                    selectedJava === ''
                      ? 'bg-red-950/80 text-red-300 border border-red-600/50 font-semibold'
                      : 'hover:bg-white/5 text-stone-300'
                  }`}
                >
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="w-3 h-3 text-red-400" />
                      <span>Automático (Detectar mejor en PC)</span>
                    </div>
                    <span className="text-[10px] text-stone-400">Recomendado para evitar errores</span>
                  </div>
                  {selectedJava === '' && <Check className="w-3.5 h-3.5 text-red-400" />}
                </button>

                {/* Detected Java List */}
                {javaList.map((j, idx) => {
                  const isSelected = selectedJava === j.path;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setSelectedJava(j.path);
                        setIsJavaDropdownOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 text-left text-xs transition cursor-pointer ${
                        isSelected
                          ? 'bg-red-950/80 text-red-300 border border-red-600/50 font-semibold'
                          : 'hover:bg-white/5 text-stone-300'
                      }`}
                    >
                      <div className="flex flex-col truncate pr-2">
                        <div className="flex items-center gap-1.5">
                          <Coffee className="w-3 h-3 text-orange-400" />
                          <span>Java {j.majorVersion} ({j.version})</span>
                        </div>
                        <span className="text-[10px] text-stone-400 truncate">{j.path}</span>
                      </div>
                      {isSelected && <Check className="w-3.5 h-3.5 text-red-400 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}

            <p className="text-[10px] text-stone-400 truncate pt-1">
              Ruta: {selectedJava || 'Detección automática del sistema'}
            </p>
          </div>

          {/* Game Folder */}
          <div className="p-4 minecraft-card bg-black/40 space-y-2">
            <div className="flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-red-400" />
              <span className="text-xs font-semibold uppercase text-stone-300">Directorio del Juego</span>
            </div>
            <p className="text-[11px] text-stone-300 bg-black/50 p-2 minecraft-slot truncate">
              {config.gameDir}
            </p>
            <button
              type="button"
              onClick={() => onOpenFolder(config.gameDir)}
              className="w-full py-2 minecraft-btn-lava text-xs text-red-100 flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <FolderOpen className="w-3.5 h-3.5 text-orange-400" />
              <span className="minecraft-text-shadow-lava">Abrir Carpeta de Mods y Configs</span>
            </button>
          </div>

          {/* Zona de Peligro: Desinstalación y Limpieza */}
          <div className="p-4 minecraft-card bg-red-950/25 border border-red-800/60 space-y-2.5">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              <span className="text-xs font-bold uppercase text-red-400">Zona de Peligro</span>
            </div>
            <p className="text-[11px] text-stone-400 leading-relaxed">
              Desinstala Chaos Launcher y elimina por completo todos los modpacks descargados, perfiles y datos guardados en este equipo.
            </p>
            <button
              type="button"
              onClick={() => setIsUninstallModalOpen(true)}
              className="w-full py-2.5 bg-red-950 hover:bg-red-900/90 text-red-200 border-2 border-red-700/80 flex items-center justify-center gap-2 text-xs font-bold uppercase transition cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5 text-red-400" />
              <span className="minecraft-text-shadow-lava">Desinstalar Launcher y Borrar Datos</span>
            </button>
          </div>
        </div>

        {/* Footer Save */}
        <div className="pt-4 border-t-2 border-black">
          <button
            onClick={handleSave}
            className="w-full py-3 minecraft-btn-green text-white font-bold text-base tracking-wider flex items-center justify-center gap-2 transition cursor-pointer uppercase"
          >
            {savedSuccess ? (
              <>
                <Check className="w-4 h-4 text-white" />
                <span className="minecraft-text-shadow-green">¡AJUSTES GUARDADOS!</span>
              </>
            ) : (
              <span className="minecraft-text-shadow-green">GUARDAR CAMBIOS</span>
            )}
          </button>
        </div>
      </div>

      {/* Modal de confirmación para desinstalación limpia */}
      {isUninstallModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-sm minecraft-panel bg-[#180a0a] p-5 space-y-4 border-2 border-red-700 text-white shadow-2xl">
            <div className="flex items-center gap-2 pb-2 border-b border-red-900/50">
              <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
              <h4 className="font-gamer font-bold text-base text-red-400 tracking-wide">
                ¿DESINSTALAR CHAOS LAUNCHER?
              </h4>
            </div>

            <p className="text-xs text-stone-300 leading-relaxed">
              Esta acción cerrará el launcher, ejecutará el desinstalador oficial y{' '}
              <strong className="text-red-400">eliminará permanentemente</strong> todos los modpacks, archivos de juego,
              perfiles locales y configuraciones de tu equipo.
            </p>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                disabled={isUninstalling}
                onClick={() => setIsUninstallModalOpen(false)}
                className="flex-1 py-2.5 minecraft-btn-lava text-xs font-semibold uppercase tracking-wider text-stone-300 hover:text-white transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isUninstalling}
                onClick={handleConfirmUninstall}
                className="flex-1 py-2.5 bg-red-800 hover:bg-red-700 border-2 border-red-600 text-white font-bold text-xs uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                {isUninstalling ? (
                  <span>Desinstalando...</span>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Sí, Desinstalar</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
