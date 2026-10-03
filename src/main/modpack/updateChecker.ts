import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { ModpackManifest, ModpackItem, UpdateCheckResult } from './modpackManifest';
import { store } from '../store/persistentStore';

const BACKEND_URL = process.env.CHAOS_BACKEND_URL || 'http://localhost:3000/api/v1';

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
    // 1. Guardar imágenes en Data URIs persistentes (Icono, Wallpaper y Banner/titleImage)
    const [iconData, wallpaperData, titleImageData] = await Promise.all([
      this.urlToDataUri(m.iconUrl),
      this.urlToDataUri(m.wallpaperUrl),
      this.urlToDataUri(m.titleImageUrl),
    ]);

    // 2. Extraer changelog si viene en versions[0]
    let changelog = m.changelog;
    if ((!changelog || changelog.length === 0) && m.versions?.[0]?.changelog) {
      changelog = m.versions[0].changelog;
    }

    const processed: ModpackItem = {
      ...m,
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

  public static async checkUpdate(tag?: string): Promise<UpdateCheckResult> {
    const config = store.getConfig();
    const effectiveTag = tag || config.activeModpackTag || store.getCachedModpacks()[0]?.tag || '';

    // Comprobar físicamente si existen los mods o archivos del modpack en la carpeta del juego
    const modsDir = path.join(config.gameDir, 'mods');
    const hasLocalMods =
      fs.existsSync(modsDir) &&
      (fs.readdirSync(modsDir).filter(
        (f) => f.toLowerCase().endsWith('.jar') || f.toLowerCase().endsWith('.jar.disabled'),
      ).length >= 1 || fs.readdirSync(modsDir).length >= 1);

    let currentVersion = config.installedModpackVersion;
    if (!hasLocalMods) {
      currentVersion = null;
    }

    try {
      let manifest: ModpackManifest | null = null;

      // 1. Intentar obtener el manifiesto directo desde el Backend si hay un tag
      if (effectiveTag) {
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

            // Refrescar primero la lista general de modpacks del backend para tener todos los metadatos frescos
            try {
              const modpacksRes = await this.getWithFallback('/modpacks', {
                timeout: 4000,
                headers: { 'Cache-Control': 'no-cache' },
              });
              const rawData = modpacksRes.data;
              let rawList: ModpackItem[] = [];
              if (Array.isArray(rawData)) rawList = rawData;
              else if (rawData && Array.isArray(rawData.data)) rawList = rawData.data;

              if (rawList.length > 0) {
                const processedList = await Promise.all(rawList.map((m) => this.processAndCacheModpack(m)));
                store.setCachedModpacks(processedList);
              }
            } catch {
              // Fallback silencioso si no se pudo actualizar el catálogo completo
            }

            const cachedModpack = store.getCachedModpacks().find((m) => m.tag === effectiveTag);

            // Convertir imágenes frescas del backend a Data URI para persistencia
            const [iconData, wallpaperData, titleImageData] = await Promise.all([
              this.urlToDataUri(manifest.iconUrl || cachedModpack?.iconUrl),
              this.urlToDataUri(manifest.wallpaperUrl || cachedModpack?.wallpaperUrl),
              this.urlToDataUri(manifest.titleImageUrl || cachedModpack?.titleImageUrl),
            ]);

            manifest.iconUrl = iconData || this.resolveFullUrl(manifest.iconUrl) || cachedModpack?.iconUrl;
            manifest.wallpaperUrl = wallpaperData || this.resolveFullUrl(manifest.wallpaperUrl) || cachedModpack?.wallpaperUrl;
            manifest.titleImageUrl = titleImageData || this.resolveFullUrl(manifest.titleImageUrl) || cachedModpack?.titleImageUrl;

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
      }

      // 2. Si no se obtuvo del backend, recuperar de la caché persistente
      if (!manifest && effectiveTag) {
        manifest = store.getCachedManifest(effectiveTag);
      }

      // 3. Si no hay manifiesto ni en backend ni en caché
      if (!manifest) {
        return {
          isUpdateAvailable: false,
          isMandatory: false,
          currentVersion,
          remoteVersion: currentVersion || '1.0.0',
          manifest: this.getDefaultManifest(effectiveTag),
        };
      }

      const remoteVersion = manifest.version;
      const isUpdateAvailable = !hasLocalMods || currentVersion !== remoteVersion;
      const isMandatory = isUpdateAvailable && manifest.forceUpdate !== false;

      return {
        isUpdateAvailable,
        isMandatory,
        currentVersion,
        remoteVersion,
        manifest,
      };
    } catch (err: any) {
      console.warn('Error al comprobar actualización:', err.message);
      const cachedManifest = (effectiveTag ? store.getCachedManifest(effectiveTag) : null) || this.getDefaultManifest(effectiveTag);
      const isUpdateAvailable = !hasLocalMods || currentVersion !== cachedManifest.version;

      return {
        isUpdateAvailable,
        isMandatory: isUpdateAvailable && cachedManifest.forceUpdate !== false,
        currentVersion,
        remoteVersion: cachedManifest.version,
        manifest: cachedManifest,
      };
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
