import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import axios from 'axios';
import { pipeline } from 'stream/promises';
import { ModpackManifest, ModpackFileEntry, DownloadProgress } from './modpackManifest';
import { store } from '../store/persistentStore';
import { PackDownloader } from './packDownloader';
import { getModpackGameDir } from './modpackPaths';

export interface DestResolution {
  destPath: string;
  alsoCopyPath?: string;
}

export function resolveFileDest(filePath: string, targetGameDir: string, baseGameDir: string): DestResolution {
  const norm = filePath.replace(/\\/g, '/');
  if (norm.startsWith('versions/') || norm.startsWith('libraries/')) {
    return { destPath: path.join(baseGameDir, filePath) };
  }
  if (norm === 'EffekseerNativeForJava.dll') {
    return {
      destPath: path.join(targetGameDir, filePath),
      alsoCopyPath: path.join(baseGameDir, filePath),
    };
  }
  return { destPath: path.join(targetGameDir, filePath) };
}

export class DifferentialSync {
  public static activeAbortController: AbortController | null = null;
  private static downloadedInSession: string[] = [];
  private static initialVersionBeforeSync: string | null = null;
  private static currentModpackDir: string | null = null;

  public static cancel(): { success: boolean; cancelled: boolean } {
    console.log('[DifferentialSync] Cancelando sincronización por orden del usuario...');
    if (this.activeAbortController) {
      this.activeAbortController.abort();
      this.activeAbortController = null;
    }
    this.cleanupSession();
    return { success: true, cancelled: true };
  }

  public static cleanTempFilesOnly(dir: string): void {
    if (!fs.existsSync(dir)) return;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          this.cleanTempFilesOnly(fullPath);
        } else if (entry.name.includes('.tmp_') || entry.name.endsWith('.tmp')) {
          try {
            fs.unlinkSync(fullPath);
          } catch {}
        }
      }
    } catch {}
  }

  public static cleanupSession(): void {
    const config = store.getConfig();

    // 1. Borrar todos los archivos descargados durante esta sesión cancelada
    for (const filePath of this.downloadedInSession) {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log(`[DifferentialSync] Eliminado por cancelación: ${filePath}`);
        }
      } catch (e) {
        console.warn(`[DifferentialSync] No se pudo borrar ${filePath}:`, e);
      }
    }
    this.downloadedInSession = [];

    // 2. Limpiar archivos .tmp_ temporales
    this.cleanTempFilesOnly(config.gameDir);
    if (this.currentModpackDir && fs.existsSync(this.currentModpackDir)) {
      this.cleanTempFilesOnly(this.currentModpackDir);
    }

    // 3. Limpiar zips temporales en baseDir
    try {
      const baseDir = store.getBaseDir();
      if (fs.existsSync(baseDir)) {
        const baseFiles = fs.readdirSync(baseDir);
        for (const f of baseFiles) {
          if (f.startsWith('temp_pack_') && f.endsWith('.zip')) {
            try { fs.unlinkSync(path.join(baseDir, f)); } catch {}
          }
        }
      }
    } catch {}
  }

  private static async calculateSha1Async(filePath: string): Promise<string> {
    return new Promise((resolve) => {
      if (!fs.existsSync(filePath)) return resolve('');
      const hash = crypto.createHash('sha1');
      const stream = fs.createReadStream(filePath);
      stream.on('data', (chunk) => hash.update(chunk));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', () => resolve(''));
    });
  }

  public static async sync(
    manifest: ModpackManifest,
    onProgress: (progress: DownloadProgress) => void
  ): Promise<void> {
    this.activeAbortController = new AbortController();
    this.downloadedInSession = [];
    const config = store.getConfig();
    this.initialVersionBeforeSync = manifest.tag
      ? store.getInstalledModpackVersion(manifest.tag)
      : config.installedModpackVersion;
    const signal = this.activeAbortController.signal;

    const targetGameDir = getModpackGameDir(config.gameDir, manifest);
    this.currentModpackDir = targetGameDir;

    if (!fs.existsSync(targetGameDir)) {
      fs.mkdirSync(targetGameDir, { recursive: true });
    }

    // Auto-migración desde legacy gameDir/mods a targetGameDir/mods si aplica
    const legacyModsDir = path.join(config.gameDir, 'mods');
    const targetModsDir = path.join(targetGameDir, 'mods');
    if (
      fs.existsSync(legacyModsDir) &&
      (!fs.existsSync(targetModsDir) || fs.readdirSync(targetModsDir).filter((f) => f.endsWith('.jar')).length === 0)
    ) {
      try {
        const legacyJars = fs
          .readdirSync(legacyModsDir)
          .filter((f) => f.toLowerCase().endsWith('.jar') || f.toLowerCase().endsWith('.jar.disabled'));
        if (legacyJars.length > 0) {
          console.log(`[DifferentialSync] Migrando ${legacyJars.length} mods previos a ${targetModsDir}...`);
          if (!fs.existsSync(targetModsDir)) fs.mkdirSync(targetModsDir, { recursive: true });
          for (const jar of legacyJars) {
            const src = path.join(legacyModsDir, jar);
            const dst = path.join(targetModsDir, jar);
            if (!fs.existsSync(dst)) {
              fs.copyFileSync(src, dst);
            }
          }
        }
      } catch (migErr) {
        console.warn('[DifferentialSync] Advertencia en auto-migración de mods legacy:', migErr);
      }
    }

    // Extraer base del repositorio GitHub si aplica
    const repoClean =
      (manifest.githubRepo || '').replace(/^https?:\/\/github\.com\//, '').replace(/\/$/, '') ||
      (manifest.downloadUrl?.includes('raw.githubusercontent.com')
        ? manifest.downloadUrl.split('raw.githubusercontent.com/')[1]?.split('/').slice(0, 2).join('/')
        : '');

    // 1. Si el manifiesto apunta a un modpack.json remoto o está incompleto, obtener catálogo completo
    const isJsonUrl =
      manifest.downloadUrl &&
      (manifest.downloadUrl.endsWith('.json') || manifest.downloadUrl.includes('modpack.json'));

    if (isJsonUrl) {
      try {
        console.log(`[DifferentialSync] Sincronizando catálogo completo desde: ${manifest.downloadUrl}...`);
        onProgress({
          stage: 'verifying',
          percent: 5,
          transferredBytes: 0,
          totalBytes: 100,
          speedBytesPerSec: 0,
        });
        const res = await axios.get(manifest.downloadUrl, {
          timeout: 15000,
          headers: { 'Cache-Control': 'no-cache' },
        });
        if (res.data && Array.isArray(res.data.files) && res.data.files.length > 0) {
          manifest.files = res.data.files;
          if (res.data.version) manifest.version = res.data.version;
          if (res.data.optionalMods) manifest.optionalMods = res.data.optionalMods;
          if (res.data.githubRepo) manifest.githubRepo = res.data.githubRepo;
        }
      } catch (fetchErr: any) {
        console.warn(`[DifferentialSync] Advertencia al obtener modpack.json remoto:`, fetchErr.message);
      }
    }

    // 2. Consulta dinámica al GitHub Git Tree API:
    // Permite que CUALQUIER archivo recién subido al repositorio (configs, shaders, resourcepacks, etc.)
    // sea descubierto y sincronizado inmediatamente, incluso si modpack.json local aún no lo tenía.
    if (repoClean) {
      try {
        console.log(`[DifferentialSync] Comprobando árbol completo de Git (${repoClean})...`);
        const treeRes = await axios.get(`https://api.github.com/repos/${repoClean}/git/trees/main?recursive=1`, {
          timeout: 10000,
          headers: { 'User-Agent': 'ChaosLauncher' },
        });

        if (treeRes.data && Array.isArray(treeRes.data.tree)) {
          const existingMap = new Map<string, ModpackFileEntry>();
          if (manifest.files && Array.isArray(manifest.files)) {
            for (const f of manifest.files) {
              if (f.path) existingMap.set(f.path.replace(/\\/g, '/').toLowerCase(), f);
            }
          }

          let addedFromGit = 0;
          for (const item of treeRes.data.tree) {
            if (item.type !== 'blob') continue;
            const itemPath = item.path.replace(/\\/g, '/');
            const lower = itemPath.toLowerCase();

            // Filtrar archivos de metadatos o git
            if (
              lower.startsWith('.') ||
              lower === 'modpack.json' ||
              lower.endsWith('readme.md') ||
              lower.endsWith('.disabled') ||
              lower.endsWith('.tmp')
            ) {
              continue;
            }

            // Omitir partes de chunks en resourcepacks/chunks/ (se manejan como el .zip correspondiente)
            if (lower.startsWith('resourcepacks/chunks/')) {
              continue;
            }

            if (!existingMap.has(lower)) {
              const newEntry: ModpackFileEntry = {
                path: itemPath,
                size: item.size || 0,
                sha1: '',
                downloadUrl: `https://raw.githubusercontent.com/${repoClean}/main/${itemPath.split('/').map(encodeURIComponent).join('/')}`,
              };
              existingMap.set(lower, newEntry);
              addedFromGit++;
            }
          }

          manifest.files = Array.from(existingMap.values());
          if (addedFromGit > 0) {
            console.log(`[DifferentialSync] Repositorio Git sincronizado: ${manifest.files.length} archivos totales (+${addedFromGit} agregados desde Git Tree).`);
          }
        }
      } catch (treeErr: any) {
        console.warn(`[DifferentialSync] Git Tree API no disponible (${treeErr.message}). Utilizando manifiesto estándar.`);
      }
    }

    // Si el manifiesto aún no incluye lista diferencial de archivos, usar el extractor tradicional en targetGameDir
    if (!manifest.files || manifest.files.length === 0) {
      return await PackDownloader.downloadAndInstall(manifest, onProgress);
    }

    // Leer manifiesto instalado previo si existe para comparar cambios en configs del autor vs modificaciones del usuario
    let prevInstalledManifest: ModpackManifest | null = null;
    const installedRecordPath = path.join(targetGameDir, '.chaos-installed.json');
    if (fs.existsSync(installedRecordPath)) {
      try {
        prevInstalledManifest = JSON.parse(fs.readFileSync(installedRecordPath, 'utf8'));
      } catch {}
    }
    const prevFilesMap = new Map<string, string>(); // path -> sha1
    if (prevInstalledManifest?.files && Array.isArray(prevInstalledManifest.files)) {
      for (const pf of prevInstalledManifest.files) {
        if (pf.path && pf.sha1) {
          prevFilesMap.set(pf.path.replace(/\\/g, '/').toLowerCase(), pf.sha1);
        }
      }
    }

    const disabledMods = new Set(store.getDisabledOptionalMods(manifest.optionalMods));
    const queue: ModpackFileEntry[] = [];
    const validModPaths = new Set<string>();

    onProgress({
      stage: 'verifying',
      percent: 0,
      transferredBytes: 0,
      totalBytes: manifest.files.length,
      speedBytesPerSec: 0,
    });

    // 1. Escanear y determinar qué archivos faltan o difieren (procesamiento asíncrono en lotes con cesión al Event Loop)
    let checkedCount = 0;
    const totalFiles = manifest.files.length;
    let lastProgressReportTime = 0;

    const BATCH_SIZE = 50;
    for (let i = 0; i < totalFiles; i += BATCH_SIZE) {
      if (signal.aborted) throw new Error('CANCELLED');
      const batch = manifest.files.slice(i, i + BATCH_SIZE);

      await Promise.all(
        batch.map(async (file) => {
          const normRelPath = file.path.replace(/\\/g, '/');
          const { destPath, alsoCopyPath } = resolveFileDest(file.path, targetGameDir, config.gameDir);
          const isMod = normRelPath.startsWith('mods/') || normRelPath.startsWith('mods\\');
          const isConfig = normRelPath.startsWith('config/') || normRelPath.startsWith('defaultconfigs/');
          const fileName = path.basename(file.path);

          const baseNameLower = fileName.toLowerCase();
          const USER_PROTECTED_FILES = new Set([
            'options.txt',
            'optionsof.txt',
            'optionsshaders.txt',
            'servers.dat',
            'usercache.json',
            'command_history.txt',
            'hotbar.nbt',
            'realms_persistence.json',
            'sodium-options.json',
            'iris.properties',
          ]);

          // Si el archivo es una configuración personal del jugador (controles, video, servidores) y ya existe, preservar siempre
          if (USER_PROTECTED_FILES.has(baseNameLower) && fs.existsSync(destPath)) {
            return;
          }

          // Si es un archivo de configuración dentro de config/ o defaultconfigs/ y ya existe localmente:
          if (isConfig && fs.existsSync(destPath)) {
            const prevSha1 = prevFilesMap.get(normRelPath.toLowerCase());
            // Si el repositorio remoto NO modificó este archivo respecto al manifest instalado previo,
            // cualquier diferencia local se debe a ediciones del usuario -> PRESERVAR
            if (prevSha1 && file.sha1 && prevSha1 === file.sha1) {
              return;
            }
          }

          if (isMod) {
            validModPaths.add(fileName.toLowerCase());
            validModPaths.add(`${fileName.toLowerCase()}.disabled`);
          }

          // Si es un mod opcional que el usuario tiene desactivado
          const isDisabledMod = isMod && disabledMods.has(fileName);

          if (isDisabledMod) {
            const disabledPath = `${destPath}.disabled`;
            if (fs.existsSync(disabledPath)) {
              try {
                const stat = await fs.promises.stat(disabledPath);
                if (stat.size === file.size) {
                  if (!file.sha1) return;
                  const localSha1 = await DifferentialSync.calculateSha1Async(disabledPath);
                  if (localSha1 === file.sha1) {
                    return; // Ya está instalado y desactivado con el hash correcto
                  }
                }
              } catch {}
            }
          } else if (isMod && fs.existsSync(`${destPath}.disabled`)) {
            // El mod NO está desactivado, pero existe con extensión .disabled en disco
            const disabledPath = `${destPath}.disabled`;
            try {
              const stat = await fs.promises.stat(disabledPath);
              if (stat.size === file.size) {
                if (!file.sha1) {
                  try {
                    if (fs.existsSync(destPath)) await fs.promises.unlink(destPath);
                    await fs.promises.rename(disabledPath, destPath);
                    return;
                  } catch {}
                }
                const localSha1 = await DifferentialSync.calculateSha1Async(disabledPath);
                if (localSha1 === file.sha1) {
                  try {
                    if (fs.existsSync(destPath)) await fs.promises.unlink(destPath);
                    await fs.promises.rename(disabledPath, destPath);
                    return;
                  } catch (e) {
                    console.warn('Error renombrando mod a activo:', e);
                  }
                }
              }
            } catch {}
          }

          if (fs.existsSync(destPath)) {
            try {
              const stat = await fs.promises.stat(destPath);
              if (stat.size === file.size) {
                if (!file.sha1) {
                  if (alsoCopyPath && !fs.existsSync(alsoCopyPath)) {
                    try { fs.copyFileSync(destPath, alsoCopyPath); } catch {}
                  }
                  return;
                }
                const localSha1 = await DifferentialSync.calculateSha1Async(destPath);
                if (localSha1 === file.sha1) {
                  if (alsoCopyPath && !fs.existsSync(alsoCopyPath)) {
                    try { fs.copyFileSync(destPath, alsoCopyPath); } catch {}
                  }
                  return; // Archivo local idéntico y verificado
                }
              }
            } catch {}
          }

          queue.push(file);
        })
      );

      checkedCount += batch.length;

      // Yield al event loop de Electron para garantizar respuesta continua de la UI
      await new Promise((r) => setImmediate(r));

      const now = Date.now();
      if (now - lastProgressReportTime > 60 || checkedCount >= totalFiles) {
        lastProgressReportTime = now;
        onProgress({
          stage: 'verifying',
          percent: Math.min(99, Math.round((checkedCount / totalFiles) * 100)),
          transferredBytes: checkedCount,
          totalBytes: totalFiles,
          speedBytesPerSec: 0,
        });
      }
    }

    // Guardar registro de manifiesto en disco para que en futuras comprobaciones se conozca el estado
    try {
      fs.writeFileSync(installedRecordPath, JSON.stringify(manifest, null, 2), 'utf8');
    } catch {}

    // 2. Si no hay nada que descargar
    if (queue.length === 0) {
      if (manifest.tag) {
        store.setInstalledModpackVersion(manifest.tag, manifest.version);
      } else {
        store.setConfig({ installedModpackVersion: manifest.version });
      }
      onProgress({
        stage: 'completed',
        percent: 100,
        transferredBytes: totalFiles,
        totalBytes: totalFiles,
        speedBytesPerSec: 0,
      });
      return;
    }

    // 3. Descarga concurrente de los archivos necesarios
    const totalDownloadBytes = queue.reduce((acc, f) => acc + (f.size || 0), 0);
    let transferredBytes = 0;
    const startTime = Date.now();
    let lastProgressTime = 0;

    const reportProgress = () => {
      const now = Date.now();
      if (now - lastProgressTime < 150) return;
      lastProgressTime = now;
      const elapsed = (now - startTime) / 1000;
      const speed = elapsed > 0 ? transferredBytes / elapsed : 0;
      const percent = totalDownloadBytes > 0
        ? Math.min(99, Math.round((transferredBytes / totalDownloadBytes) * 100))
        : 50;

      onProgress({
        stage: 'downloading',
        percent,
        transferredBytes,
        totalBytes: totalDownloadBytes,
        speedBytesPerSec: speed,
      });
    };

    // Función auxiliar para codificar segmentos de ruta de manera segura para peticiones HTTP
    const buildSafeUrl = (base: string, relPath: string): string => {
      const encodedSegments = relPath
        .replace(/\\/g, '/')
        .split('/')
        .map((segment) => encodeURIComponent(segment))
        .join('/');
      return `${base}/${encodedSegments}`;
    };

    const downloadSingleFile = async (entry: ModpackFileEntry, retryCount = 0): Promise<void> => {
      if (signal.aborted) throw new Error('CANCELLED');

      const { destPath, alsoCopyPath } = resolveFileDest(entry.path, targetGameDir, config.gameDir);
      const parentDir = path.dirname(destPath);
      if (!fs.existsSync(parentDir)) {
        try {
          fs.mkdirSync(parentDir, { recursive: true });
        } catch {}
      }

      const isMod = entry.path.startsWith('mods/') || entry.path.startsWith('mods\\');
      const fileName = path.basename(entry.path);
      const isTargetDisabled = isMod && disabledMods.has(fileName);
      const finalDestPath = isTargetDisabled ? `${destPath}.disabled` : destPath;

      // Extraer base repo dinámicamente según manifest
      const repoClean = (manifest.githubRepo || '').replace(/^https?:\/\/github\.com\//, '').replace(/\/$/, '');
      const rawBase = repoClean
        ? `https://raw.githubusercontent.com/${repoClean}/main`
        : (manifest.downloadUrl ? manifest.downloadUrl.replace(/\/[^/]+$/, '') : 'http://localhost:3000/api/v1/uploads');

      // Caso A: Archivo dividido en chunks / partes transparentes
      if (entry.parts && entry.parts.length > 0) {
        const tempChunkPath = `${finalDestPath}.tmp_${Date.now()}`;
        const chunkWriter = fs.createWriteStream(tempChunkPath);

        try {
          for (const partRel of entry.parts) {
            if (signal.aborted) throw new Error('CANCELLED');
            const partUrl = buildSafeUrl(rawBase, partRel);
            const res = await axios({
              url: partUrl,
              method: 'GET',
              responseType: 'stream',
              timeout: 90000,
              signal,
            });

            res.data.on('data', (chunk: Buffer) => {
              if (signal.aborted) {
                res.data.destroy();
                chunkWriter.destroy();
                return;
              }
              transferredBytes += chunk.length;
              reportProgress();
            });

            await new Promise<void>((resolve, reject) => {
              res.data.pipe(chunkWriter, { end: false });
              res.data.on('end', resolve);
              res.data.on('error', reject);
              chunkWriter.on('error', reject);
            });
          }

          chunkWriter.end();
          await new Promise<void>((resolve, reject) => {
            chunkWriter.on('close', resolve);
            chunkWriter.on('finish', resolve);
            chunkWriter.on('error', reject);
          });

          if (signal.aborted) {
            if (fs.existsSync(tempChunkPath)) {
              try { fs.unlinkSync(tempChunkPath); } catch {}
            }
            throw new Error('CANCELLED');
          }

          if (fs.existsSync(finalDestPath)) {
            try { fs.unlinkSync(finalDestPath); } catch {}
          }
          fs.renameSync(tempChunkPath, finalDestPath);
          DifferentialSync.downloadedInSession.push(finalDestPath);
          if (alsoCopyPath) {
            try {
              const alsoDir = path.dirname(alsoCopyPath);
              if (!fs.existsSync(alsoDir)) fs.mkdirSync(alsoDir, { recursive: true });
              fs.copyFileSync(finalDestPath, alsoCopyPath);
            } catch (copyErr) {
              console.warn('[DifferentialSync] Advertencia copiando a ruta secundaria:', copyErr);
            }
          }
          return;
        } catch (chunkErr: any) {
          if (fs.existsSync(tempChunkPath)) {
            try { fs.unlinkSync(tempChunkPath); } catch {}
          }
          if (chunkErr.response?.status === 404) {
            console.warn(`[DifferentialSync] ADVERTENCIA: Parte de "${entry.path}" no se encontró en el repositorio remoto (HTTP 404). Omitiendo.`);
            return;
          }
          if (retryCount < 2 && !signal.aborted && chunkErr.message !== 'CANCELLED') {
            await new Promise((r) => setTimeout(r, 600));
            return downloadSingleFile(entry, retryCount + 1);
          }
          throw chunkErr;
        }
      }

      // Caso B: Archivo convencional individual
      let fileUrl = entry.downloadUrl;
      if (!fileUrl) {
        fileUrl = buildSafeUrl(rawBase, entry.path);
      } else {
        try {
          fileUrl = encodeURI(decodeURI(fileUrl));
        } catch {
          fileUrl = encodeURI(fileUrl);
        }
      }

      const tempPath = `${finalDestPath}.tmp_${Date.now()}`;

      try {
        const response = await axios({
          url: fileUrl,
          method: 'GET',
          responseType: 'stream',
          timeout: 45000,
          signal,
        });

        const writer = fs.createWriteStream(tempPath);

        response.data.on('data', (chunk: Buffer) => {
          if (signal.aborted) {
            response.data.destroy();
            writer.destroy();
            return;
          }
          transferredBytes += chunk.length;
          reportProgress();
        });

        await pipeline(response.data, writer);

        if (signal.aborted) {
          if (fs.existsSync(tempPath)) {
            try { fs.unlinkSync(tempPath); } catch {}
          }
          throw new Error('CANCELLED');
        }

        // Mover temp a destino final con reemplazo seguro en Windows
        if (fs.existsSync(finalDestPath)) {
          try { fs.unlinkSync(finalDestPath); } catch {}
        }
        fs.renameSync(tempPath, finalDestPath);
        DifferentialSync.downloadedInSession.push(finalDestPath);
        if (alsoCopyPath) {
          try {
            const alsoDir = path.dirname(alsoCopyPath);
            if (!fs.existsSync(alsoDir)) fs.mkdirSync(alsoDir, { recursive: true });
            fs.copyFileSync(finalDestPath, alsoCopyPath);
          } catch (copyErr) {
            console.warn('[DifferentialSync] Advertencia copiando a ruta secundaria:', copyErr);
          }
        }
      } catch (err: any) {
        if (fs.existsSync(tempPath)) {
          try { fs.unlinkSync(tempPath); } catch {}
        }
        if (err.response?.status === 404) {
          console.warn(`[DifferentialSync] ADVERTENCIA: El archivo "${entry.path}" no se encontró en el repositorio remoto (HTTP 404). Se omite para continuar con el modpack.`);
          return;
        }
        if (retryCount < 2 && !signal.aborted && err.message !== 'CANCELLED') {
          await new Promise((r) => setTimeout(r, 400));
          return downloadSingleFile(entry, retryCount + 1);
        }
        throw err;
      }
    };

    try {
      // Procesar en concurrencia (lotes de 10 hilos simultáneos)
      const CONCURRENCY = 10;
      for (let i = 0; i < queue.length; i += CONCURRENCY) {
        if (signal.aborted) throw new Error('CANCELLED');
        const chunk = queue.slice(i, i + CONCURRENCY);
        await Promise.all(chunk.map((entry) => downloadSingleFile(entry)));
      }

      if (signal.aborted) throw new Error('CANCELLED');

      // 4. Limpieza de mods eliminados u obsoletos exclusivamente dentro de targetModsDir
      if (fs.existsSync(targetModsDir)) {
        const localFiles = fs.readdirSync(targetModsDir);
        for (const file of localFiles) {
          const lower = file.toLowerCase();
          if ((lower.endsWith('.jar') || lower.endsWith('.jar.disabled')) && !validModPaths.has(lower)) {
            try {
              fs.unlinkSync(path.join(targetModsDir, file));
              console.log(`[DifferentialSync] Eliminado mod obsoleto: ${file}`);
            } catch (e) {
              console.warn(`[DifferentialSync] No se pudo eliminar mod obsoleto ${file}:`, e);
            }
          }
        }
      }

      // 4.5 Asegurar que los mods desactivados tengan la extensión .disabled en disco
      for (const disabledFile of disabledMods) {
        const normalPath = path.join(targetModsDir, disabledFile);
        const disabledPath = `${normalPath}.disabled`;
        if (fs.existsSync(normalPath)) {
          try {
            if (fs.existsSync(disabledPath)) fs.unlinkSync(disabledPath);
            fs.renameSync(normalPath, disabledPath);
          } catch (e) {
            console.warn(`[DifferentialSync] Error renombrando a .disabled: ${disabledFile}`, e);
          }
        }
      }

      // Asegurar que los mods activos no queden como .disabled en disco
      if (manifest.optionalMods && Array.isArray(manifest.optionalMods)) {
        for (const optMod of manifest.optionalMods) {
          if (!disabledMods.has(optMod.file)) {
            const normalPath = path.join(targetModsDir, optMod.file);
            const disabledPath = `${normalPath}.disabled`;
            if (fs.existsSync(disabledPath) && !fs.existsSync(normalPath)) {
              try {
                fs.renameSync(disabledPath, normalPath);
              } catch (e) {
                console.warn(`[DifferentialSync] Error restaurando mod activo: ${optMod.file}`, e);
              }
            }
          }
        }
      }

      // 5. Finalización y guardado de versión instalada
      try {
        fs.writeFileSync(installedRecordPath, JSON.stringify(manifest, null, 2), 'utf8');
      } catch (e) {
        console.warn('[DifferentialSync] Advertencia guardando manifest instalado:', e);
      }

      if (manifest.tag) {
        store.setInstalledModpackVersion(manifest.tag, manifest.version);
      } else {
        store.setConfig({ installedModpackVersion: manifest.version });
      }

      onProgress({
        stage: 'completed',
        percent: 100,
        transferredBytes: totalDownloadBytes,
        totalBytes: totalDownloadBytes,
        speedBytesPerSec: 0,
      });
    } catch (err: any) {
      const isManualCancel = err.message === 'CANCELLED' || (signal && signal.aborted);
      if (isManualCancel) {
        console.log('[DifferentialSync] Cancelación manual por el usuario. Limpiando archivos de sesión...');
        DifferentialSync.cleanupSession();
        onProgress({
          stage: 'error',
          percent: 0,
          transferredBytes: 0,
          totalBytes: 0,
          speedBytesPerSec: 0,
          errorMessage: 'Descarga cancelada por el usuario.',
        });
        throw new Error('Descarga cancelada por el usuario.');
      }

      console.error('[DifferentialSync] Error durante sincronización diferencial:', err);
      // NOTE: En caso de error de red, NO eliminamos los mods ya descargados y válidos.
      // Solo limpiamos los archivos temporales (.tmp_) para no dejar residuos.
      DifferentialSync.cleanTempFilesOnly(targetGameDir);

      onProgress({
        stage: 'error',
        percent: 0,
        transferredBytes: 0,
        totalBytes: 0,
        speedBytesPerSec: 0,
        errorMessage: err.message || 'Error durante la descarga del modpack.',
      });
      throw err;
    } finally {
      this.activeAbortController = null;
    }
  }
}
