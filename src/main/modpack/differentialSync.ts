import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import axios from 'axios';
import { pipeline } from 'stream/promises';
import { ModpackManifest, ModpackFileEntry, DownloadProgress } from './modpackManifest';
import { store } from '../store/persistentStore';
import { PackDownloader } from './packDownloader';

export class DifferentialSync {
  public static activeAbortController: AbortController | null = null;
  private static downloadedInSession: string[] = [];
  private static initialVersionBeforeSync: string | null = null;

  public static cancel(): { success: boolean; cancelled: boolean } {
    console.log('[DifferentialSync] Cancelando sincronización y limpiando archivos descargados...');
    if (this.activeAbortController) {
      this.activeAbortController.abort();
    }
    this.cleanupSession();
    return { success: true, cancelled: true };
  }

  public static cleanupSession(): void {
    const config = store.getConfig();
    const gameDir = config.gameDir;

    // 1. Borrar todos los archivos descargados durante esta sesión
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

    // 2. Limpiar archivos .tmp_ en todo gameDir
    try {
      const cleanTmp = (dir: string) => {
        if (!fs.existsSync(dir)) return;
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            cleanTmp(fullPath);
          } else if (entry.name.includes('.tmp_') || entry.name.endsWith('.tmp')) {
            try { fs.unlinkSync(fullPath); } catch {}
          }
        }
      };
      cleanTmp(gameDir);
    } catch {}

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

    // 4. Si el modpack no estaba instalado previamente, limpiar la carpeta mods para no dejar residuos
    if (!this.initialVersionBeforeSync) {
      try {
        const modsDir = path.join(gameDir, 'mods');
        if (fs.existsSync(modsDir)) {
          fs.rmSync(modsDir, { recursive: true, force: true });
        }
      } catch {}
    }
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
    this.initialVersionBeforeSync = config.installedModpackVersion;
    const signal = this.activeAbortController.signal;
    const gameDir = config.gameDir;

    if (!fs.existsSync(gameDir)) {
      fs.mkdirSync(gameDir, { recursive: true });
    }

    // Si el manifiesto no incluye lista diferencial de archivos, intentar cargar desde modpack.json si la URL apunta a un JSON
    if (!manifest.files || manifest.files.length === 0) {
      const isJsonUrl = manifest.downloadUrl && (manifest.downloadUrl.endsWith('.json') || manifest.downloadUrl.includes('modpack.json'));
      if (isJsonUrl) {
        try {
          console.log(`[DifferentialSync] Detectada URL de manifiesto JSON: ${manifest.downloadUrl}. Obteniendo catálogo...`);
          onProgress({
            stage: 'verifying',
            percent: 5,
            transferredBytes: 0,
            totalBytes: 100,
            speedBytesPerSec: 0,
          });
          const res = await axios.get(manifest.downloadUrl, { timeout: 12000 });
          if (res.data && Array.isArray(res.data.files) && res.data.files.length > 0) {
            manifest.files = res.data.files;
            if (res.data.version) manifest.version = res.data.version;
          }
        } catch (fetchErr: any) {
          console.warn(`[DifferentialSync] No se pudo obtener el modpack.json remoto:`, fetchErr.message);
        }
      }
    }

    // Si el manifiesto no incluye lista diferencial de archivos, usar el extractor de zip tradicional o fallback seguro
    if (!manifest.files || manifest.files.length === 0) {
      return await PackDownloader.downloadAndInstall(manifest, onProgress);
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

    const BATCH_SIZE = 30;
    for (let i = 0; i < totalFiles; i += BATCH_SIZE) {
      if (signal.aborted) throw new Error('CANCELLED');
      const batch = manifest.files.slice(i, i + BATCH_SIZE);

      await Promise.all(
        batch.map(async (file) => {
          const destPath = path.join(gameDir, file.path);
          const isMod = file.path.startsWith('mods/') || file.path.startsWith('mods\\');
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
          ]);

          // Si el archivo es una configuración personal del jugador y ya existe en su PC, preservar siempre
          if (USER_PROTECTED_FILES.has(baseNameLower) && fs.existsSync(destPath)) {
            return;
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
                const localSha1 = await DifferentialSync.calculateSha1Async(destPath);
                if (localSha1 === file.sha1) {
                  return; // Archivo local idéntico y verificado
                }
              }
            } catch {}
          }

          queue.push(file);
        })
      );

      checkedCount += batch.length;

      // Yield al event loop de Electron para garantizar que Windows nunca marque "(No responde)"
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

    const downloadSingleFile = async (entry: ModpackFileEntry, retryCount = 0): Promise<void> => {
      if (signal.aborted) throw new Error('CANCELLED');

      const destPath = path.join(gameDir, entry.path);
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
      const rawBase = repoClean ? `https://raw.githubusercontent.com/${repoClean}/main` : (manifest.downloadUrl ? manifest.downloadUrl.replace(/\/[^/]+$/, '') : 'http://localhost:3000/api/v1/uploads');

      // Caso A: Archivo dividido en chunks / partes transparentes
      if (entry.parts && entry.parts.length > 0) {
        const tempChunkPath = `${finalDestPath}.tmp_${Date.now()}`;
        const chunkWriter = fs.createWriteStream(tempChunkPath);

        try {
          for (const partRel of entry.parts) {
            if (signal.aborted) throw new Error('CANCELLED');
            const partUrl = `${rawBase}/${partRel}`;
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
          return;
        } catch (chunkErr: any) {
          if (fs.existsSync(tempChunkPath)) {
            try { fs.unlinkSync(tempChunkPath); } catch {}
          }
          if (retryCount < 2 && !signal.aborted && chunkErr.message !== 'CANCELLED') {
            await new Promise((r) => setTimeout(r, 600));
            return downloadSingleFile(entry, retryCount + 1);
          }
          throw chunkErr;
        }
      }

      // Caso B: Archivo convencional individual
      const fileUrl = entry.downloadUrl || `${rawBase}/${entry.path}`;
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
      } catch (err: any) {
        if (fs.existsSync(tempPath)) {
          try { fs.unlinkSync(tempPath); } catch {}
        }
        if (retryCount < 2 && !signal.aborted && err.message !== 'CANCELLED') {
          await new Promise((r) => setTimeout(r, 400));
          return downloadSingleFile(entry, retryCount + 1);
        }
        throw err;
      }
    };

    try {
      // Procesar en concurrencia (lotes de 6 hilos simultáneos)
      const CONCURRENCY = 6;
      for (let i = 0; i < queue.length; i += CONCURRENCY) {
        if (signal.aborted) throw new Error('CANCELLED');
        const chunk = queue.slice(i, i + CONCURRENCY);
        await Promise.all(chunk.map((entry) => downloadSingleFile(entry)));
      }

      if (signal.aborted) throw new Error('CANCELLED');

      // 4. Limpieza de mods eliminados u obsoletos
      const localModsDir = path.join(gameDir, 'mods');
      if (fs.existsSync(localModsDir)) {
        const localFiles = fs.readdirSync(localModsDir);
        for (const file of localFiles) {
          const lower = file.toLowerCase();
          if ((lower.endsWith('.jar') || lower.endsWith('.jar.disabled')) && !validModPaths.has(lower)) {
            try {
              fs.unlinkSync(path.join(localModsDir, file));
              console.log(`[DifferentialSync] Eliminado mod obsoleto: ${file}`);
            } catch (e) {
              console.warn(`[DifferentialSync] No se pudo eliminar mod obsoleto ${file}:`, e);
            }
          }
        }
      }

      // 4.5 Asegurar que los mods desactivados tengan la extensión .disabled en disco
      for (const disabledFile of disabledMods) {
        const normalPath = path.join(localModsDir, disabledFile);
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
            const normalPath = path.join(localModsDir, optMod.file);
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

      // 5. Finalización
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
      if (this.activeAbortController) {
        this.activeAbortController.abort();
      }
      if (signal.aborted || err.message === 'CANCELLED') {
        console.log('[DifferentialSync] Cancelación detectada. Limpiando archivos...');
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
      DifferentialSync.cleanupSession();
      throw err;
    }
  }
}
