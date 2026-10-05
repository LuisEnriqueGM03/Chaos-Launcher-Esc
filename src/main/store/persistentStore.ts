import fs from 'fs';
import { safeStorage } from 'electron';
import path from 'path';
import os from 'os';
import { UserAccount } from '../auth/authTypes';
import { BACKEND_URL, isLegacyLocalBackend } from '../config/backend';
import { ModpackItem, ModpackManifest } from '../modpack/modpackManifest';
import { getModpackGameDir, getModpackModsDir } from '../modpack/modpackPaths';

export interface LauncherConfig {
  accounts: UserAccount[];
  activeAccountId: string | null;
  allocatedRamMb: number;
  javaPath: string;
  gameDir: string;
  modpackManifestUrl: string;
  installedModpackVersion: string | null;
  installedModpackVersions?: Record<string, string>;
  disabledOptionalMods?: string[];
  activeModpackTag?: string | null;
  optionalModsPreferences?: Record<string, boolean>;
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

        // 2. Comprobar físicamente si los mods están instalados en la subcarpeta del modpack o en gameDir
        const hasModsInDirectory = (dir: string) => {
          try {
            return (
              fs.existsSync(dir) &&
              fs.readdirSync(dir).filter(
                (f) => f.toLowerCase().endsWith('.jar') || f.toLowerCase().endsWith('.jar.disabled')
              ).length >= 1
            );
          } catch {
            return false;
          }
        };

        const activeTag = parsed.activeModpackTag || 'mimic-server';
        const tagModsDir = getModpackModsDir(parsed.gameDir, activeTag);
        const legacyModsDir = path.join(parsed.gameDir, 'mods');

        let hasMods = hasModsInDirectory(tagModsDir) || hasModsInDirectory(legacyModsDir);
        if (!hasMods && fs.existsSync(parsed.gameDir)) {
          try {
            const subdirs = fs.readdirSync(parsed.gameDir, { withFileTypes: true });
            for (const sub of subdirs) {
              if (sub.isDirectory() && sub.name !== 'versions' && sub.name !== 'libraries' && sub.name !== 'assets') {
                if (hasModsInDirectory(path.join(parsed.gameDir, sub.name, 'mods'))) {
                  hasMods = true;
                  break;
                }
              }
            }
          } catch {}
        }

        if (!hasMods) {
          parsed.installedModpackVersion = null;
          parsed.installedModpackVersions = {};
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

  public save(): void {
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

  public getInstalledModpackVersion(tag?: string): string | null {
    const targetTag = tag || this.config.activeModpackTag;
    if (targetTag && this.config.installedModpackVersions?.[targetTag]) {
      return this.config.installedModpackVersions[targetTag];
    }
    return this.config.installedModpackVersion || null;
  }

  public setInstalledModpackVersion(tag: string, version: string): void {
    const versions = { ...(this.config.installedModpackVersions || {}) };
    versions[tag] = version;
    this.setConfig({
      installedModpackVersions: versions,
      installedModpackVersion: version,
      activeModpackTag: tag,
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

  public getDisabledOptionalMods(optionalMods?: { file: string; defaultEnabled?: boolean }[]): string[] {
    const prefs = this.config.optionalModsPreferences || {};
    const defaults = this.config.optionalModsDefaults || {};
    const disabledList = new Set<string>(this.config.disabledOptionalMods || []);

    if (optionalMods && Array.isArray(optionalMods)) {
      const targetModsDir = getModpackModsDir(this.config.gameDir, this.config.activeModpackTag);
      const legacyModsDir = path.join(this.config.gameDir, 'mods');
      const modsDir =
        fs.existsSync(targetModsDir) && fs.readdirSync(targetModsDir).length > 0
          ? targetModsDir
          : fs.existsSync(legacyModsDir) && fs.readdirSync(legacyModsDir).length > 0
          ? legacyModsDir
          : targetModsDir;

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
    const targetModsDir = getModpackModsDir(this.config.gameDir, this.config.activeModpackTag);
    const legacyModsDir = path.join(this.config.gameDir, 'mods');
    const modsDir =
      fs.existsSync(targetModsDir) && fs.readdirSync(targetModsDir).length > 0
        ? targetModsDir
        : fs.existsSync(legacyModsDir) && fs.readdirSync(legacyModsDir).length > 0
        ? legacyModsDir
        : targetModsDir;
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

      // 1. Borrar carpeta aislada del modpack y sus mods/configs
      if (targetTag) {
        const targetModpackDir = getModpackGameDir(this.config.gameDir, targetTag);
        if (fs.existsSync(targetModpackDir)) {
          try {
            fs.rmSync(targetModpackDir, { recursive: true, force: true });
          } catch (e) {
            console.warn('[PersistentStore] Error borrando carpeta de modpack:', e);
          }
        }
      }

      // 2. Limpiar legacy modsDir si quedó huérfana
      const legacyModsDir = path.join(this.config.gameDir, 'mods');
      if (fs.existsSync(legacyModsDir)) {
        try { fs.rmSync(legacyModsDir, { recursive: true, force: true }); } catch {}
      }

      // 3. Resetear versión instalada y mods opcionales
      if (targetTag && this.config.installedModpackVersions) {
        delete this.config.installedModpackVersions[targetTag];
      }
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
