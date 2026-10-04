import React from 'react';
import { Settings, FolderOpen, ChevronDown, CheckCircle2, Cpu, Coffee, Check } from 'lucide-react';
import { JavaInstallation, LauncherConfig } from '../../vite-env';

interface SettingsTabProps {
  onOpenFolder: () => void;
  modpackName: string;
  ramMb: number;
  setRamMb: (mb: number) => void;
  totalSystemRamMb: number;
  javaList: JavaInstallation[];
  selectedJava: string;
  setSelectedJava: (path: string) => void;
  settingsSaved: boolean;
  isJavaDropdownOpen: boolean;
  setIsJavaDropdownOpen: (open: boolean) => void;
  handleSaveSettings: (overrideRam?: number, overrideJava?: string) => void | Promise<void>;
  recommendedRam: number;
  config: LauncherConfig | null;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({ onOpenFolder, modpackName, ramMb, setRamMb, totalSystemRamMb, javaList, selectedJava, setSelectedJava, settingsSaved, isJavaDropdownOpen, setIsJavaDropdownOpen, handleSaveSettings, recommendedRam, config }) => {
  return (
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
  );
};
