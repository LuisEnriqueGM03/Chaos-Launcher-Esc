import fs from 'fs';
import { safeStorage } from 'electron';
import path from 'path';
import os from 'os';
import { UserAccount } from '../auth/authTypes';
import { BACKEND_URL, isLegacyLocalBackend } from '../config/backend';
import { ModpackItem, ModpackManifest } from '../modpack/modpackManifest';
import { getModpackGameDir, getModpackModsDir } from '../modpack/modpackPaths';

export interface ModpackOptionalState {
  disabled: string[];
  preferences: Record<string, boolean>;
  defaults: Record<string, boolean>;
}

export interface LauncherConfig {
  accounts: UserAccount[];
  activeAccountId: string | null;
  allocatedRamMb: number;
  javaPath: string;
  gameDir: string;
  modpackManifestUrl: string;
  /** @deprecated Solo para migrar configs antiguas; la versión instalada vive en installedModpackVersions[tag]. */
  installedModpackVersion: string | null;
  /** Versión instalada de cada modpack, indexada por tag. */
  installedModpackVersions?: Record<string, string>;
  /** Estado de mods opcionales de cada modpack, indexado por tag (cada pack es independiente). */
  optionalModsByTag?: Record<string, ModpackOptionalState>;
  /** @deprecated Globales antiguos (mezclaban packs); se migran a optionalModsByTag. */
  disabledOptionalMods?: string[];
  activeModpackTag?: string | null;
  /** @deprecated Ver optionalModsByTag. */
  optionalModsPreferences?: Record<string, boolean>;
  /** @deprecated Ver optionalModsByTag. */
  optionalModsDefaults?: Record<string, boolean>;
  cachedModpacks?: ModpackItem[];
  cachedManifests?: Record<string, ModpackManifest>;
}

const BACKEND_BASE = BACKEND_URL;

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
  installedModpackVersions: {},
  optionalModsByTag: {},
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
  }

  private loadConfig(): LauncherConfig {
    try {
      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, 'utf8');
        const parsed = { ...DEFAULT_CONFIG, ...JSON.parse(data) };
        // Los tokens cifrados se descifran en unlockAccounts(), cuando safeStorage ya está disponible (app ready).
        parsed.accounts = parsed.accounts || [];

        // 1. Asegurar URL del backend actualizada
        if (
          !parsed.modpackManifestUrl ||
          parsed.modpackManifestUrl.includes('raw.githubusercontent.com') ||
          // Versiones anteriores guardaban el backend local; se pasa al servidor público (salvo override de desarrollo)
          (isLegacyLocalBackend(parsed.modpackManifestUrl) && !isLegacyLocalBackend(BACKEND_URL))
        ) {
          parsed.modpackManifestUrl = DEFAULT_CONFIG.modpackManifestUrl;
        }

        // 2. Migrar los valores globales antiguos al modpack que estaba activo (antes mezclaban packs)
        const activeTag: string | null = parsed.activeModpackTag || null;
        const versions: Record<string, string> = { ...(parsed.installedModpackVersions || {}) };
        const byTag: Record<string, ModpackOptionalState> = { ...(parsed.optionalModsByTag || {}) };
        if (activeTag) {
          if (parsed.installedModpackVersion && !versions[activeTag]) {
            versions[activeTag] = parsed.installedModpackVersion;
          }
          const legacyDisabled: string[] = parsed.disabledOptionalMods || [];
          const legacyPrefs = parsed.optionalModsPreferences || {};
          const legacyDefaults = parsed.optionalModsDefaults || {};
          if (
            !byTag[activeTag] &&
            (legacyDisabled.length > 0 || Object.keys(legacyPrefs).length > 0 || Object.keys(legacyDefaults).length > 0)
          ) {
            byTag[activeTag] = { disabled: [...legacyDisabled], preferences: { ...legacyPrefs }, defaults: { ...legacyDefaults } };
          }
        }
        parsed.installedModpackVersion = null;
        parsed.disabledOptionalMods = [];
        parsed.optionalModsPreferences = {};
        parsed.optionalModsDefaults = {};

        // 3. Cada modpack se valida contra SU PROPIA carpeta: si ya no tiene mods en disco, deja de figurar como instalado
        const hasModsInDirectory = (dir: string) => {
          try {
            return (
              fs.existsSync(dir) &&
              fs.readdirSync(dir).some((f) => f.toLowerCase().endsWith('.jar') || f.toLowerCase().endsWith('.jar.disabled'))
            );
          } catch {
            return false;
          }
        };
        for (const tag of Object.keys(versions)) {
          let installed = false;
          try {
            installed = hasModsInDirectory(getModpackModsDir(parsed.gameDir, tag));
          } catch {}
          if (!installed) delete versions[tag];
        }
        parsed.installedModpackVersions = versions;
        parsed.optionalModsByTag = byTag;

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

  /** Cifra el accessToken con DPAPI (safeStorage). Si no hay cifrado disponible, el token no se persiste. */
  private serializeForDisk(): LauncherConfig {
    const canEncrypt = (() => {
      try { return safeStorage.isEncryptionAvailable(); } catch { return false; }
    })();
    return {
      ...this.config,
      accounts: this.config.accounts.map((acc) => {
        const { accessToken, refreshToken, ...rest } = acc as any;
        if (canEncrypt) {
          const out: any = { ...rest };
          if (accessToken) out.accessTokenEnc = safeStorage.encryptString(accessToken).toString('base64');
          if (refreshToken) out.refreshTokenEnc = safeStorage.encryptString(refreshToken).toString('base64');
          return out as UserAccount;
        }
        // Sin cifrado disponible (antes de app ready) se conserva el token cifrado existente en vez de perderlo.
        return rest as UserAccount;
      }),
    };
  }

  /** Descifra los tokens guardados. Debe llamarse una vez que la app está lista (app.whenReady). */
  public unlockAccounts(): void {
    const dec = (v: string) => safeStorage.decryptString(Buffer.from(v, 'base64'));
    this.config.accounts = this.config.accounts.map((acc: any) => {
      const { accessTokenEnc, refreshTokenEnc, ...rest } = acc;
      if (!accessTokenEnc && !refreshTokenEnc) return acc;
      const out: any = { ...rest };
      try { if (accessTokenEnc) out.accessToken = dec(accessTokenEnc); } catch {}
      try { if (refreshTokenEnc) out.refreshToken = dec(refreshTokenEnc); } catch {}
      return out;
    });
  }

  private saveTimer: NodeJS.Timeout | null = null;

  /**
   * Programa el guardado. config.json pesa varios MB (catálogo e imágenes en caché) y una sola comprobación de
   * modpack lo guardaba varias veces seguidas: se agrupan en una escritura. flush() la fuerza (al cerrar la app).
   */
  public save(): void {
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => this.flush(), 300);
    this.saveTimer.unref?.();
  }

  public flush(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    try {
      fs.writeFileSync(this.configPath, JSON.stringify(this.serializeForDisk(), null, 2), 'utf8');
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

  /** Versión instalada del modpack `tag` (o del activo). Sin valor por defecto compartido entre packs. */
  public getInstalledModpackVersion(tag?: string | null): string | null {
    const targetTag = tag || this.config.activeModpackTag;
    if (!targetTag) return null;
    return this.config.installedModpackVersions?.[targetTag] || null;
  }

  /** Registra la versión instalada de UN modpack. No cambia cuál es el modpack activo. */
  public setInstalledModpackVersion(tag: string, version: string): void {
    this.setConfig({
      installedModpackVersions: { ...(this.config.installedModpackVersions || {}), [tag]: version },
    });
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

  private getOptionalState(tag: string): ModpackOptionalState {
    if (!this.config.optionalModsByTag) this.config.optionalModsByTag = {};
    if (!this.config.optionalModsByTag[tag]) {
      this.config.optionalModsByTag[tag] = { disabled: [], preferences: {}, defaults: {} };
    }
    return this.config.optionalModsByTag[tag];
  }

  /**
   * Mods opcionales desactivados de UN modpack. Preferencias y archivos se resuelven siempre contra la
   * carpeta de ese tag, así que cambiar de modpack nunca toca las preferencias del otro.
   */
  public getDisabledOptionalMods(
    optionalMods: { file: string; defaultEnabled?: boolean }[] | undefined,
    tag?: string | null
  ): string[] {
    const targetTag = tag || this.config.activeModpackTag;
    if (!targetTag) return [];
    const state = this.getOptionalState(targetTag);
    const prefs = state.preferences;
    const defaults = state.defaults;
    const disabledList = new Set<string>(state.disabled);

    if (optionalMods && Array.isArray(optionalMods)) {
      const modsDir = getModpackModsDir(this.config.gameDir, targetTag);

      // Limpiar de disabledList, prefs y defaults archivos que ya no existan en la lista de mods opcionales
      const validFiles = new Set(optionalMods.map((m) => m.file));
      for (const f of Array.from(disabledList)) {
        if (!validFiles.has(f)) disabledList.delete(f);
      }
      for (const f of Object.keys(prefs)) {
        if (!validFiles.has(f)) delete prefs[f];
      }
      for (const f of Object.keys(defaults)) {
        if (!validFiles.has(f)) delete defaults[f];
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

        const isEnabled = prefs[mod.file] !== undefined ? prefs[mod.file] === true : serverDefault;

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
    }

    state.disabled = Array.from(disabledList);
    this.save();
    return state.disabled;
  }

  public toggleOptionalMod(
    modFileName: string,
    enabled: boolean,
    tag?: string | null
  ): { success: boolean; currentDisabled: string[] } {
    const targetTag = tag || this.config.activeModpackTag;
    if (!targetTag) throw new Error('No hay un modpack seleccionado.');
    const modsDir = getModpackModsDir(this.config.gameDir, targetTag);
    const normalPath = path.join(modsDir, modFileName);
    const disabledPath = path.join(modsDir, `${modFileName}.disabled`);

    const state = this.getOptionalState(targetTag);
    state.preferences[modFileName] = enabled;
    const disabledList = new Set(state.disabled);

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

    state.disabled = Array.from(disabledList);
    this.save();
    return { success: true, currentDisabled: state.disabled };
  }

  /** Borra SOLO el modpack `tag`: su carpeta, su versión, sus preferencias y su caché. El resto no se toca. */
  public deleteModpackFromCache(tag?: string): boolean {
    try {
      const targetTag = tag || this.config.activeModpackTag;
      if (!targetTag) return false;

      // 1. Borrar la carpeta aislada del modpack y sus mods/configs
      const targetModpackDir = getModpackGameDir(this.config.gameDir, targetTag);
      if (fs.existsSync(targetModpackDir)) {
        try {
          fs.rmSync(targetModpackDir, { recursive: true, force: true });
        } catch (e) {
          console.warn('[PersistentStore] Error borrando carpeta de modpack:', e);
        }
      }

      // 2. Olvidar el estado de ESTE modpack (versión y mods opcionales)
      const versions = { ...(this.config.installedModpackVersions || {}) };
      delete versions[targetTag];
      this.config.installedModpackVersions = versions;
      if (this.config.optionalModsByTag) delete this.config.optionalModsByTag[targetTag];

      // 3. Quitarlo de la lista y de los manifiestos en memoria
      if (this.config.cachedModpacks) {
        this.config.cachedModpacks = this.config.cachedModpacks.filter((m) => m.tag !== targetTag);
      }
      if (this.config.cachedManifests) delete this.config.cachedManifests[targetTag];

      // 4. Si era el modpack activo, pasar a otro o vaciarlo
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
    // Los manifiestos de modpacks que ya no existen en el backend se descartan (pesan MB y no se usarían)
    if (this.config.cachedManifests) {
      const validTags = new Set(modpacks.map((m) => m.tag));
      for (const tag of Object.keys(this.config.cachedManifests)) {
        if (!validTags.has(tag)) delete this.config.cachedManifests[tag];
      }
    }
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
