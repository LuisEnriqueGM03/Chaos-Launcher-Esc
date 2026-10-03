import fs from 'fs';
import path from 'path';
import os from 'os';
import { UserAccount } from '../auth/authTypes';
import { ModpackItem, ModpackManifest } from '../modpack/modpackManifest';

export interface LauncherConfig {
  accounts: UserAccount[];
  activeAccountId: string | null;
  allocatedRamMb: number;
  javaPath: string;
  gameDir: string;
  modpackManifestUrl: string;
  installedModpackVersion: string | null;
  disabledOptionalMods?: string[];
  activeModpackTag?: string | null;
  optionalModsPreferences?: Record<string, boolean>;
  optionalModsDefaults?: Record<string, boolean>;
  cachedModpacks?: ModpackItem[];
  cachedManifests?: Record<string, ModpackManifest>;
}

const BACKEND_BASE = process.env.CHAOS_BACKEND_URL || 'http://localhost:3000/api/v1';

const DEFAULT_CONFIG: LauncherConfig = {
  accounts: [],
  activeAccountId: null,
  activeModpackTag: null,
  allocatedRamMb: 6144,
  javaPath: '',
  gameDir: path.join(
    process.env.APPDATA || (process.platform === 'darwin' ? path.join(os.homedir(), 'Library', 'Application Support') : os.homedir()),
    '.chaoslauncher',
    'game'
  ),
  modpackManifestUrl: `${BACKEND_BASE}/modpacks`,
  installedModpackVersion: null,
  disabledOptionalMods: [],
  cachedModpacks: [],
  cachedManifests: {},
};

class PersistentStore {
  private configPath: string;
  private config: LauncherConfig;

  constructor() {
    const baseDir = path.join(
      process.env.APPDATA || (process.platform === 'darwin' ? path.join(os.homedir(), 'Library', 'Application Support') : os.homedir()),
      '.chaoslauncher'
    );

    if (!fs.existsSync(baseDir)) {
      fs.mkdirSync(baseDir, { recursive: true });
    }

    this.configPath = path.join(baseDir, 'config.json');
    this.config = this.loadConfig();
    this.save();
  }

  private loadConfig(): LauncherConfig {
    try {
      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, 'utf8');
        const parsed = { ...DEFAULT_CONFIG, ...JSON.parse(data) };

        // 1. Asegurar URL del backend actualizada
        if (!parsed.modpackManifestUrl || parsed.modpackManifestUrl.includes('raw.githubusercontent.com')) {
          parsed.modpackManifestUrl = DEFAULT_CONFIG.modpackManifestUrl;
        }

        // 2. Comprobar físicamente si los mods están instalados en gameDir/mods
        const modsDir = path.join(parsed.gameDir, 'mods');
        const hasMods = fs.existsSync(modsDir) && fs.readdirSync(modsDir).filter(f => f.toLowerCase().endsWith('.jar') || f.toLowerCase().endsWith('.jar.disabled')).length >= 20;
        if (!hasMods) {
          parsed.installedModpackVersion = null;
        }

        // Si hay una cuenta Premium de Microsoft, eliminar duplicados offline del mismo nombre
        const msNames = new Set(
          parsed.accounts.filter(a => a.type === 'microsoft').map(a => a.name.toLowerCase())
        );
        parsed.accounts = parsed.accounts.filter(
          a => !(a.type === 'offline' && msNames.has(a.name.toLowerCase()))
        );
        return parsed;
      }
    } catch (err) {
      console.error('Error al cargar config.json:', err);
    }
    return { ...DEFAULT_CONFIG };
  }

  public save(): void {
    try {
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), 'utf8');
    } catch (err) {
      console.error('Error al guardar config.json:', err);
    }
  }

  public getConfig(): LauncherConfig {
    return { ...this.config };
  }

  public setConfig(partial: Partial<LauncherConfig>): LauncherConfig {
    this.config = { ...this.config, ...partial };
    this.save();
    return this.getConfig();
  }

  public getActiveAccount(): UserAccount | null {
    if (!this.config.activeAccountId) return null;
    return this.config.accounts.find(a => a.id === this.config.activeAccountId) || null;
  }

  public addOrUpdateAccount(account: UserAccount): void {
    // Si la cuenta es Premium (microsoft), remover cualquier cuenta offline previa con el mismo nombre
    if (account.type === 'microsoft') {
      this.config.accounts = this.config.accounts.filter(
        a => !(a.type === 'offline' && a.name.toLowerCase() === account.name.toLowerCase())
      );
    } else {
      // Si la cuenta es offline pero ya hay una con el mismo nombre, no duplicarla
      this.config.accounts = this.config.accounts.filter(
        a => !(a.name.toLowerCase() === account.name.toLowerCase())
      );
    }

    const existingIndex = this.config.accounts.findIndex(a => a.id === account.id);
    if (existingIndex >= 0) {
      this.config.accounts[existingIndex] = account;
    } else {
      this.config.accounts.push(account);
    }
    this.config.activeAccountId = account.id;
    this.save();
  }

  public removeAccount(id: string): void {
    this.config.accounts = this.config.accounts.filter(a => a.id !== id);
    if (this.config.activeAccountId === id) {
      this.config.activeAccountId = this.config.accounts[0]?.id || null;
    }
    this.save();
  }

  public logout(): void {
    this.config.activeAccountId = null;
    this.save();
  }

  public getDisabledOptionalMods(optionalMods?: { file: string; defaultEnabled?: boolean }[]): string[] {
    const prefs = this.config.optionalModsPreferences || {};
    const defaults = this.config.optionalModsDefaults || {};
    const disabledList = new Set<string>(this.config.disabledOptionalMods || []);

    if (optionalMods && Array.isArray(optionalMods)) {
      const modsDir = path.join(this.config.gameDir, 'mods');

      // Limpiar de disabledList, prefs y defaults archivos que ya no existan en la lista de mods opcionales
      const validFiles = new Set(optionalMods.map((m) => m.file));
      for (const f of Array.from(disabledList)) {
        if (!validFiles.has(f)) {
          disabledList.delete(f);
        }
      }
      for (const f of Object.keys(prefs)) {
        if (!validFiles.has(f)) {
          delete prefs[f];
        }
      }
      for (const f of Object.keys(defaults)) {
        if (!validFiles.has(f)) {
          delete defaults[f];
        }
      }

      for (const mod of optionalMods) {
        const normalPath = path.join(modsDir, mod.file);
        const disabledPath = path.join(modsDir, `${mod.file}.disabled`);
        const serverDefault = mod.defaultEnabled !== false; // true por defecto

        // Detectar si el backend configuró o cambió el defaultEnabled de este mod
        const lastDefault = defaults[mod.file];
        if (lastDefault === undefined || lastDefault !== serverDefault) {
          defaults[mod.file] = serverDefault;
          delete prefs[mod.file]; // Limpiar preferencia obsoleta para que el valor de fábrica del backend mande
        }

        // Determinar si debe estar activado o desactivado
        let isEnabled: boolean;
        if (prefs[mod.file] !== undefined) {
          isEnabled = prefs[mod.file] === true;
        } else {
          isEnabled = serverDefault;
        }

        if (isEnabled) {
          disabledList.delete(mod.file);
          try {
            if (fs.existsSync(disabledPath)) {
              if (fs.existsSync(normalPath)) fs.unlinkSync(normalPath);
              fs.renameSync(disabledPath, normalPath);
            }
          } catch (e) {
            console.warn('Error al activar mod opcional:', e);
          }
        } else {
          disabledList.add(mod.file);
          try {
            if (fs.existsSync(normalPath)) {
              if (fs.existsSync(disabledPath)) fs.unlinkSync(disabledPath);
              fs.renameSync(normalPath, disabledPath);
            }
          } catch (e) {
            console.warn('Error al apagar mod opcional:', e);
          }
        }
      }

      this.config.optionalModsDefaults = defaults;
      this.config.optionalModsPreferences = prefs;
    }

    this.config.disabledOptionalMods = Array.from(disabledList);
    this.save();
    return this.config.disabledOptionalMods;
  }

  public toggleOptionalMod(modFileName: string, enabled: boolean): { success: boolean; currentDisabled: string[] } {
    const modsDir = path.join(this.config.gameDir, 'mods');
    const normalPath = path.join(modsDir, modFileName);
    const disabledPath = path.join(modsDir, `${modFileName}.disabled`);

    if (!this.config.optionalModsPreferences) {
      this.config.optionalModsPreferences = {};
    }
    this.config.optionalModsPreferences[modFileName] = enabled;

    const disabledList = new Set(this.config.disabledOptionalMods || []);

    try {
      if (enabled) {
        if (fs.existsSync(disabledPath)) {
          if (fs.existsSync(normalPath)) fs.unlinkSync(normalPath);
          fs.renameSync(disabledPath, normalPath);
        }
        disabledList.delete(modFileName);
      } else {
        if (fs.existsSync(normalPath)) {
          if (fs.existsSync(disabledPath)) fs.unlinkSync(disabledPath);
          fs.renameSync(normalPath, disabledPath);
        }
        disabledList.add(modFileName);
      }
    } catch (err) {
      console.error('Error al alternar mod opcional en disco:', err);
    }

    this.config.disabledOptionalMods = Array.from(disabledList);
    this.save();
    return { success: true, currentDisabled: this.config.disabledOptionalMods };
  }

  public deleteModpackFromCache(tag?: string): boolean {
    try {
      const targetTag = tag || this.config.activeModpackTag;

      // 1. Borrar archivos físicos del modpack definidos en el manifest si existe
      if (targetTag && this.config.cachedManifests && this.config.cachedManifests[targetTag]) {
        const manifest = this.config.cachedManifests[targetTag];
        if (manifest.files && Array.isArray(manifest.files)) {
          for (const f of manifest.files) {
            try {
              const p = path.join(this.config.gameDir, f.path);
              if (fs.existsSync(p)) {
                fs.rmSync(p, { force: true });
              }
              const pDis = `${p}.disabled`;
              if (fs.existsSync(pDis)) {
                fs.rmSync(pDis, { force: true });
              }
            } catch (e) {
              // ignore
            }
          }
        }
      }

      // 2. Borrar carpeta de mods completa
      const modsDir = path.join(this.config.gameDir, 'mods');
      if (fs.existsSync(modsDir)) {
        fs.rmSync(modsDir, { recursive: true, force: true });
      }

      // 3. Resetear versión instalada y mods opcionales
      this.config.installedModpackVersion = null;
      this.config.disabledOptionalMods = [];
      this.config.optionalModsPreferences = {};
      this.config.optionalModsDefaults = {};

      // 4. Eliminar de la lista de modpacks en memoria
      if (targetTag && this.config.cachedModpacks) {
        this.config.cachedModpacks = this.config.cachedModpacks.filter((m) => m.tag !== targetTag);
      }

      // 5. Eliminar manifest de la memoria
      if (targetTag && this.config.cachedManifests) {
        delete this.config.cachedManifests[targetTag];
      }

      // 6. Si el tag activo era este, cambiarlo o vaciarlo
      if (this.config.activeModpackTag === targetTag) {
        this.config.activeModpackTag = this.config.cachedModpacks?.[0]?.tag || null;
      }

      this.save();
      return true;
    } catch (err) {
      console.error('Error al eliminar modpack de memoria y disco:', err);
      return false;
    }
  }

  public deleteInstalledModpack(): boolean {
    return this.deleteModpackFromCache();
  }

  public getCachedModpacks(): ModpackItem[] {
    return this.config.cachedModpacks || [];
  }

  public setCachedModpacks(modpacks: ModpackItem[]): void {
    this.config.cachedModpacks = modpacks;
    this.save();
  }

  public getCachedManifest(tag: string): ModpackManifest | null {
    if (!this.config.cachedManifests) return null;
    return this.config.cachedManifests[tag] || null;
  }

  public setCachedManifest(tag: string, manifest: ModpackManifest): void {
    if (!this.config.cachedManifests) {
      this.config.cachedManifests = {};
    }
    this.config.cachedManifests[tag] = manifest;
    this.save();
  }

  public getBaseDir(): string {
    return path.dirname(this.configPath);
  }
}

export const store = new PersistentStore();
