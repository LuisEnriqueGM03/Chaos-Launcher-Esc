import fs from 'fs';
import path from 'path';
import { ModpackManifest, ModpackFileEntry, DownloadProgress } from './modpackManifest';
import { store } from '../store/persistentStore';
import { PackDownloader } from './packDownloader';
import { getModpackGameDir } from './modpackPaths';

import { resolveFileDest } from './fileDest';
import { calculateSha1Async } from './fileHash';
import { resolveRemoteManifest } from './manifestResolver';
import { downloadManifestFile, DownloadContext } from './fileDownloader';

export { resolveFileDest } from './fileDest';

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

  public static async sync(
    manifest: ModpackManifest,
    onProgress: (progress: DownloadProgress) => void
  ): Promise<void> {
    if (!manifest.tag) {
      throw new Error('El modpack no tiene tag: no se puede determinar su carpeta de instalación.');
    }
    // El estado de la sincronización es estático: dos descargas a la vez se pisarían entre sí
    if (this.activeAbortController) {
      throw new Error('Ya hay una descarga de modpack en curso. Espera a que termine o cancélala.');
    }

    this.activeAbortController = new AbortController();
    this.downloadedInSession = [];
    const config = store.getConfig();
    this.initialVersionBeforeSync = store.getInstalledModpackVersion(manifest.tag);
    const signal = this.activeAbortController.signal;

    const targetGameDir = getModpackGameDir(config.gameDir, manifest);
    this.currentModpackDir = targetGameDir;

    if (!fs.existsSync(targetGameDir)) {
      fs.mkdirSync(targetGameDir, { recursive: true });
    }

    // Los mods de un modpack viven SOLO en su carpeta: nunca se copian mods de otra carpeta (ni de otro pack)
    const targetModsDir = path.join(targetGameDir, 'mods');

    await resolveRemoteManifest(manifest, onProgress);

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

    const disabledMods = new Set(store.getDisabledOptionalMods(manifest.optionalMods, manifest.tag));
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
                  const localSha1 = await calculateSha1Async(disabledPath);
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
                const localSha1 = await calculateSha1Async(disabledPath);
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
                const localSha1 = await calculateSha1Async(destPath);
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
      store.setInstalledModpackVersion(manifest.tag, manifest.version);
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

    const downloadCtx: DownloadContext = {
      signal,
      targetGameDir,
      gameDir: config.gameDir,
      manifest,
      disabledMods,
      onBytes: (n: number) => {
        transferredBytes += n;
        reportProgress();
      },
      onFileInstalled: (p: string) => {
        DifferentialSync.downloadedInSession.push(p);
      },
    };

    try {
      // Pool de workers: cada slot toma el siguiente archivo al terminar, sin esperar al más lento del lote
      const CONCURRENCY = 16;
      let nextIndex = 0;
      const worker = async () => {
        while (nextIndex < queue.length) {
          if (signal.aborted) throw new Error('CANCELLED');
          await downloadManifestFile(downloadCtx, queue[nextIndex++]);
        }
      };
      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker));

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

      store.setInstalledModpackVersion(manifest.tag, manifest.version);

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
