import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { ModpackManifest, ModpackItem, UpdateCheckResult } from './modpackManifest';
import { store } from '../store/persistentStore';
import { getModpackGameDir } from './modpackPaths';

import { BACKEND_URL } from '../config/backend';

export class UpdateChecker {
  private static getCandidateUrls(endpoint: string): string[] {
    const urls: string[] = [];
    if (BACKEND_URL.includes('localhost')) {
      urls.push(BACKEND_URL.replace('localhost', '127.0.0.1') + endpoint);
      urls.push(`${BACKEND_URL}${endpoint}`);
    } else if (BACKEND_URL.includes('127.0.0.1')) {
      urls.push(`${BACKEND_URL}${endpoint}`);
      urls.push(BACKEND_URL.replace('127.0.0.1', 'localhost') + endpoint);
    } else {
      urls.push(`${BACKEND_URL}${endpoint}`);
    }
    return urls;
  }

  public static async getWithFallback<T = any>(endpoint: string, options: any = {}): Promise<any> {
    const urls = this.getCandidateUrls(endpoint);
    let lastErr: any = null;
    for (const u of urls) {
      try {
        return await axios.get<T>(u, options);
      } catch (err: any) {
        lastErr = err;
        if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND' || err.code === 'ETIMEDOUT') continue;
        throw err;
      }
    }
    throw lastErr;
  }

  public static async postWithFallback<T = any>(endpoint: string, data: any = {}, options: any = {}): Promise<any> {
    const urls = this.getCandidateUrls(endpoint);
    let lastErr: any = null;
    for (const u of urls) {
      try {
        return await axios.post<T>(u, data, options);
      } catch (err: any) {
        lastErr = err;
        if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND' || err.code === 'ETIMEDOUT') continue;
        throw err;
      }
    }
    throw lastErr;
  }

  private static resolveFullUrl(url?: string): string | undefined {
    if (!url || typeof url !== 'string') return undefined;
    if (url.startsWith('data:') || url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    const baseUrl = BACKEND_URL.replace(/\/api\/v1\/?$/, '');
    if (url.startsWith('/static/') || url.startsWith('/')) {
      return `${baseUrl}${url}`;
    }
    return url;
  }

  private static async urlToDataUri(url?: string): Promise<string | undefined> {
    const fullUrl = this.resolveFullUrl(url);
    if (!fullUrl) return undefined;
    if (fullUrl.startsWith('data:')) return fullUrl;

    const urls: string[] = [];
    if (fullUrl.includes('localhost')) {
      urls.push(fullUrl.replace('localhost', '127.0.0.1'));
      urls.push(fullUrl);
    } else if (fullUrl.includes('127.0.0.1')) {
      urls.push(fullUrl);
      urls.push(fullUrl.replace('127.0.0.1', 'localhost'));
    } else {
      urls.push(fullUrl);
    }

    for (const u of urls) {
      try {
        const res = await axios.get(u, {
          responseType: 'arraybuffer',
          timeout: 6000,
          headers: { 'Cache-Control': 'no-cache' },
        });
        const mime = res.headers['content-type'] || 'image/png';
        const b64 = Buffer.from(res.data, 'binary').toString('base64');
        return `data:${mime};base64,${b64}`;
      } catch (err: any) {
        if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND' || err.code === 'ETIMEDOUT') continue;
        console.warn(`[AssetCache] No se pudo guardar imagen offline (${u}):`, err.message);
        break;
      }
    }
    return fullUrl;
  }

  private static async processAndCacheModpack(m: ModpackItem): Promise<ModpackItem> {
    // 1. Guardar imágenes en Data URIs persistentes (Icono, Wallpaper y Banner/titleImage).
    // Si la URL de origen no cambió desde la última vez se reutiliza la copia guardada: el wallpaper pesa varios MB
    // y descargarlo en cada comprobación era lo que hacía lenta la pantalla de cada modpack.
    const prev = store.getCachedModpacks().find((c) => c.tag === m.tag);
    const imageFor = (key: 'iconUrl' | 'wallpaperUrl' | 'titleImageUrl'): Promise<string | undefined> => {
      const cached = prev?.[key];
      if (cached && cached.startsWith('data:') && prev?._src?.[key] && prev._src[key] === m[key]) {
        return Promise.resolve(cached);
      }
      return this.urlToDataUri(m[key]);
    };
    const [iconData, wallpaperData, titleImageData] = await Promise.all([
      imageFor('iconUrl'),
      imageFor('wallpaperUrl'),
      imageFor('titleImageUrl'),
    ]);

    // 2. Extraer changelog si viene en versions[0]
    let changelog = m.changelog;
    if ((!changelog || changelog.length === 0) && m.versions?.[0]?.changelog) {
      changelog = m.versions[0].changelog;
    }

    const processed: ModpackItem = {
      ...m,
      _src: { iconUrl: m.iconUrl, wallpaperUrl: m.wallpaperUrl, titleImageUrl: m.titleImageUrl },
      iconUrl: iconData || this.resolveFullUrl(m.iconUrl),
      wallpaperUrl: wallpaperData || this.resolveFullUrl(m.wallpaperUrl),
      titleImageUrl: titleImageData || this.resolveFullUrl(m.titleImageUrl),
      changelog: changelog || [],
      optionalMods: m.optionalMods || [],
    };

    // 3. Cachear también el manifiesto correspondiente
    try {
      const manifestRes = await this.getWithFallback<ModpackManifest>(
        `/modpacks/${encodeURIComponent(m.tag)}/manifest`,
        { timeout: 5000, headers: { 'Cache-Control': 'no-cache' } }
      );
      const resData = manifestRes?.data?.data || manifestRes?.data;
      if (resData && resData.version) {
        const man = resData;
        man.iconUrl = processed.iconUrl;
        man.wallpaperUrl = processed.wallpaperUrl;
        man.titleImageUrl = processed.titleImageUrl;
        man.titleDisplayMode = m.titleDisplayMode;
        man.titleText = m.titleText;
        if (m.description !== undefined) man.description = m.description;
        if (m.hasOptionalMods !== undefined) man.hasOptionalMods = m.hasOptionalMods;
        if (m.hasRules !== undefined) man.hasRules = m.hasRules;
        if (m.rulesContent !== undefined) man.rulesContent = m.rulesContent;
        if (m.hasDiscord !== undefined) man.hasDiscord = m.hasDiscord;
        if (m.discordUrl !== undefined) man.discordUrl = m.discordUrl;
        if (m.hasChangelog !== undefined) man.hasChangelog = m.hasChangelog;
        if (man.optionalMods === undefined) {
          man.optionalMods = processed.optionalMods || [];
        }
        if (!man.changelog || man.changelog.length === 0) {
          man.changelog = processed.changelog || [];
        }
        store.setCachedManifest(m.tag, man);
      }
    } catch {
      const existing = store.getCachedManifest(m.tag);
      store.setCachedManifest(m.tag, {
        tag: m.tag,
        name: m.name,
        version: m.version,
        minecraftVersion: m.minecraftVersion,
        loader: {
          type: (m.loaderType || 'fabric').toLowerCase() as any,
          version: m.loaderVersion,
        },
        server: {
          ip: m.serverIp,
          port: m.serverPort || 25565,
        },
        recommendedRam: m.recommendedRam,
        optionalMods: processed.optionalMods,
        downloadUrl: m.downloadUrl || existing?.downloadUrl,
        forceUpdate: m.forceUpdate,
        hasOptionalMods: m.hasOptionalMods,
        hasRules: m.hasRules,
        rulesContent: m.rulesContent,
        hasDiscord: m.hasDiscord,
        discordUrl: m.discordUrl,
        hasChangelog: m.hasChangelog,
        changelog: processed.changelog || [],
        iconUrl: processed.iconUrl,
        wallpaperUrl: processed.wallpaperUrl,
        titleImageUrl: processed.titleImageUrl,
        titleDisplayMode: m.titleDisplayMode,
        titleText: m.titleText,
      });
    }

    return processed;
  }

  private static normalizeModpackUrls(list: ModpackItem[]): ModpackItem[] {
    return list.map((m) => ({
      ...m,
      iconUrl: this.resolveFullUrl(m.iconUrl),
      wallpaperUrl: this.resolveFullUrl(m.wallpaperUrl),
      titleImageUrl: this.resolveFullUrl(m.titleImageUrl),
    }));
  }

  public static async getModpacks(): Promise<ModpackItem[]> {
    try {
      const response = await this.getWithFallback('/modpacks', {
        timeout: 5000,
        headers: { 'Cache-Control': 'no-cache' },
      });

      const data = response.data;
      let rawList: ModpackItem[] = [];
      if (Array.isArray(data)) {
        rawList = data;
      } else if (data && Array.isArray(data.data)) {
        rawList = data.data;
      }

      // Procesar imágenes a Data URI y guardar en memoria persistente
      const processedList = await Promise.all(rawList.map((m) => this.processAndCacheModpack(m)));
      store.setCachedModpacks(processedList);
      return this.normalizeModpackUrls(processedList);
    } catch (err: any) {
      console.warn(`[UpdateChecker] Backend no disponible (${BACKEND_URL}/modpacks): ${err.message}. Usando modpacks guardados en memoria.`);
      const cached = store.getCachedModpacks();
      return this.normalizeModpackUrls(cached);
    }
  }

  public static async refreshModpacks(): Promise<ModpackItem[]> {
    let response;
    try {
      try {
        response = await this.postWithFallback('/modpacks/refresh', {}, {
          timeout: 8000,
          headers: { 'Cache-Control': 'no-cache' },
        });
      } catch {
        response = await this.getWithFallback('/modpacks', {
          timeout: 6000,
          headers: { 'Cache-Control': 'no-cache' },
        });
      }
    } catch (err: any) {
      console.warn(`[UpdateChecker] Error al refrescar modpacks del backend: ${err.message}`);
      throw new Error('Error al actualizar: problemas con el servidor.');
    }

    const data = response.data;
    let rawList: ModpackItem[] = [];
    if (Array.isArray(data)) {
      rawList = data;
    } else if (data && Array.isArray(data.data)) {
      rawList = data.data;
    }

    // Procesar imágenes a Data URI y guardar en memoria persistente
    const processedList = await Promise.all(rawList.map((m) => this.processAndCacheModpack(m)));
    store.setCachedModpacks(processedList);
    return this.normalizeModpackUrls(processedList);
  }

  /** Resultado cuando no hay ningún modpack seleccionado (no existe carpeta que comprobar). */
  private static noModpackResult(): UpdateCheckResult {
    return {
      isUpdateAvailable: false,
      isMandatory: false,
      currentVersion: null,
      remoteVersion: '1.0.0',
      manifest: this.getDefaultManifest(),
    };
  }

  private static resolveTag(tag?: string): string {
    return tag || store.getConfig().activeModpackTag || store.getCachedModpacks()[0]?.tag || '';
  }

  /** Estado en disco del modpack (versión instalada y mods en SU carpeta aislada). Sin red. */
  private static getLocalState(tag: string) {
    const targetModpackDir = getModpackGameDir(store.getConfig().gameDir, tag);
    const modsDir = path.join(targetModpackDir, 'mods');
    let hasLocalMods = false;
    try {
      hasLocalMods = fs.existsSync(modsDir) && fs.readdirSync(modsDir).length >= 1;
    } catch {}
    const installed = store.getInstalledModpackVersion(tag);
    return { targetModpackDir, modsDir, hasLocalMods, currentVersion: hasLocalMods ? installed : null };
  }

  /**
   * ¿Lo instalado coincide con el manifiesto? Compara la versión y, si coincide, revisa en disco que no falten
   * mods requeridos, que no sobren mods eliminados del pack y que exista la carpeta config. Sin red.
   */
  private static isInstallUpToDate(
    manifest: ModpackManifest,
    tag: string,
    local: { targetModpackDir: string; modsDir: string; hasLocalMods: boolean; currentVersion: string | null },
  ): boolean {
    const { targetModpackDir, modsDir, hasLocalMods, currentVersion } = local;
    let isUpToDate = Boolean(hasLocalMods && currentVersion && currentVersion === manifest.version);

    if (!(isUpToDate && manifest.files && Array.isArray(manifest.files) && manifest.files.length > 0 && fs.existsSync(modsDir))) {
      return isUpToDate;
    }

    try {
      // 0. ¿Falta la carpeta de configuraciones básica?
      const configFolder = path.join(targetModpackDir, 'config');
      const hasManifestConfigs = manifest.files.some((f) => f.path.startsWith('config/'));
      if (hasManifestConfigs && (!fs.existsSync(configFolder) || fs.readdirSync(configFolder).length < 5)) {
        console.log('[UpdateChecker] Discrepancia detectada: carpeta config incompleta o ausente.');
        return false;
      }

      const localMods = new Set(fs.readdirSync(modsDir).map((f) => f.toLowerCase()));
      const disabledMods = new Set(
        store.getDisabledOptionalMods(manifest.optionalMods, tag).map((f) => f.toLowerCase())
      );

      const manifestModFiles = manifest.files.filter(
        (f) =>
          (f.path.startsWith('mods/') || f.path.startsWith('mods\\')) &&
          f.path.toLowerCase().endsWith('.jar') &&
          !f.path.includes('.disabled')
      );

      // 1. ¿Falta algún mod requerido del manifiesto?
      for (const m of manifestModFiles) {
        const fileName = path.basename(m.path).toLowerCase();
        const targetName = disabledMods.has(fileName) ? `${fileName}.disabled` : fileName;
        if (!localMods.has(targetName)) {
          console.log(`[UpdateChecker] Discrepancia detectada: falta el mod "${targetName}" localmente.`);
          return false;
        }
      }

      // 2. ¿Existe algún mod en la carpeta local que no pertenezca al modpack? (mod agregado o mod eliminado del pack)
      const validModNames = new Set(
        manifestModFiles.flatMap((m) => {
          const base = path.basename(m.path).toLowerCase();
          return [base, `${base}.disabled`];
        })
      );
      for (const localFile of localMods) {
        if ((localFile.endsWith('.jar') || localFile.endsWith('.jar.disabled')) && !validModNames.has(localFile)) {
          console.log(`[UpdateChecker] Discrepancia detectada: mod local no reconocido o eliminado "${localFile}".`);
          return false;
        }
      }
    } catch (discErr: any) {
      console.warn('[UpdateChecker] Error comprobando discrepancias físicas de mods:', discErr.message);
    }
    return isUpToDate;
  }

  private static buildResult(manifest: ModpackManifest, tag: string): UpdateCheckResult {
    const local = this.getLocalState(tag);
    const isUpToDate = this.isInstallUpToDate(manifest, tag, local);
    const isUpdateAvailable = !local.hasLocalMods || !isUpToDate;
    return {
      isUpdateAvailable,
      isMandatory: isUpdateAvailable && manifest.forceUpdate !== false,
      currentVersion: local.currentVersion,
      remoteVersion: manifest.version,
      manifest,
    };
  }

  /**
   * Comprobación INSTANTÁNEA: compara lo instalado con el último manifiesto guardado, sin tocar la red.
   * Permite mostrar "Jugar" al momento; la comprobación con el servidor (checkUpdate) la corrige después si hace falta.
   */
  public static checkUpdateCached(tag?: string): UpdateCheckResult {
    const effectiveTag = this.resolveTag(tag);
    if (!effectiveTag) return this.noModpackResult();

    const manifest = store.getCachedManifest(effectiveTag) || this.getDefaultManifest(effectiveTag);
    manifest.tag = effectiveTag;
    return this.buildResult(manifest, effectiveTag);
  }

  public static async checkUpdate(tag?: string): Promise<UpdateCheckResult> {
    const effectiveTag = this.resolveTag(tag);

    // Sin modpack no hay carpeta que comprobar (nunca se usa una carpeta compartida por defecto)
    if (!effectiveTag) return this.noModpackResult();

    try {
      let manifest: ModpackManifest | null = null;

      // 1. Manifiesto del Backend
      try {
        const backendRes = await this.getWithFallback<ModpackManifest>(
          `/modpacks/${encodeURIComponent(effectiveTag)}/manifest`,
          {
            timeout: 6000,
            headers: { 'Cache-Control': 'no-cache' },
          }
        );

        const resData = backendRes?.data?.data || backendRes?.data;
        if (resData && resData.version) {
          manifest = resData;

          // Metadatos (descripción, reglas, discord, imágenes) del catálogo guardado. El catálogo completo lo
          // refresca getModpacks(); aquí no se vuelve a descargar toda la lista ni sus imágenes.
          const cachedModpack = store.getCachedModpacks().find((m) => m.tag === effectiveTag);

          manifest.iconUrl = this.resolveFullUrl(manifest.iconUrl) || cachedModpack?.iconUrl;
          manifest.wallpaperUrl = this.resolveFullUrl(manifest.wallpaperUrl) || cachedModpack?.wallpaperUrl;
          manifest.titleImageUrl = this.resolveFullUrl(manifest.titleImageUrl) || cachedModpack?.titleImageUrl;

          manifest.titleDisplayMode = cachedModpack?.titleDisplayMode || manifest.titleDisplayMode;
          manifest.titleText = cachedModpack?.titleText || manifest.titleText;
          if (cachedModpack?.description !== undefined) manifest.description = cachedModpack.description;
          if (cachedModpack?.hasOptionalMods !== undefined) manifest.hasOptionalMods = cachedModpack.hasOptionalMods;
          if (cachedModpack?.hasRules !== undefined) {
            manifest.hasRules = cachedModpack.hasRules;
            manifest.rulesContent = cachedModpack.rulesContent;
          }
          if (cachedModpack?.hasDiscord !== undefined) {
            manifest.hasDiscord = cachedModpack.hasDiscord;
            manifest.discordUrl = cachedModpack.discordUrl;
          }
          if (cachedModpack?.hasChangelog !== undefined) manifest.hasChangelog = cachedModpack.hasChangelog;
          if (cachedModpack?.changelog && cachedModpack.changelog.length > 0) {
            manifest.changelog = cachedModpack.changelog;
          }
          if (manifest.optionalMods === undefined && cachedModpack?.optionalMods) {
            manifest.optionalMods = cachedModpack.optionalMods;
          }

          store.setCachedManifest(effectiveTag, manifest);
        }
      } catch (backendErr: any) {
        console.warn(`[UpdateChecker] Backend no disponible para manifiesto de "${effectiveTag}":`, backendErr.message);
      }

      // 2. Si no se obtuvo del backend, recuperar de la caché persistente
      if (!manifest) {
        manifest = store.getCachedManifest(effectiveTag);
      }

      // El identificador del modpack es el tag pedido: así la carpeta y las versiones nunca se cruzan
      if (manifest) manifest.tag = effectiveTag;

      // 2.5 Si el manifest apunta a un modpack.json remoto (p.ej. GitHub raw), resolver la versión autoritativa fresca
      if (manifest && manifest.downloadUrl && (manifest.downloadUrl.endsWith('.json') || manifest.downloadUrl.includes('modpack.json'))) {
        try {
          const rawRes = await axios.get(manifest.downloadUrl, {
            timeout: 5000,
            headers: { 'Cache-Control': 'no-cache' },
          });
          if (rawRes.data && rawRes.data.version) {
            manifest.version = rawRes.data.version;
            if (rawRes.data.files && Array.isArray(rawRes.data.files)) {
              manifest.files = rawRes.data.files;
            }
            if (rawRes.data.changelog && Array.isArray(rawRes.data.changelog)) {
              manifest.changelog = rawRes.data.changelog;
            }
            store.setCachedManifest(effectiveTag, manifest);
          }
        } catch (rawErr: any) {
          console.log(`[UpdateChecker] No se pudo verificar versión remota directa de modpack.json: ${rawErr.message}`);
        }
      }

      // 3. Si no hay manifiesto ni en backend ni en caché
      if (!manifest) {
        return {
          isUpdateAvailable: false,
          isMandatory: false,
          currentVersion: this.getLocalState(effectiveTag).currentVersion,
          remoteVersion: this.getLocalState(effectiveTag).currentVersion || '1.0.0',
          manifest: this.getDefaultManifest(effectiveTag),
        };
      }

      return this.buildResult(manifest, effectiveTag);
    } catch (err: any) {
      console.warn('Error al comprobar actualización:', err.message);
      return this.checkUpdateCached(effectiveTag);
    }
  }

  public static getDefaultManifest(tag?: string): ModpackManifest {
    const config = store.getConfig();
    const effectiveTag = tag || config.activeModpackTag || '';
    if (effectiveTag) {
      const cached = store.getCachedManifest(effectiveTag);
      if (cached) return cached;
    }

    return {
      tag: effectiveTag || 'chaos-modpack',
      name: effectiveTag || 'Chaos Launcher Modpack',
      version: '1.0.0',
      minecraftVersion: '1.20.1',
      loader: {
        type: 'fabric',
        version: '0.15.11',
      },
      recommendedRam: 4096,
      changelog: [],
    };
  }
}
