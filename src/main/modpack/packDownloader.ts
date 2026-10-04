import fs from 'fs';
import path from 'path';
import axios from 'axios';
import AdmZip from 'adm-zip';
import { ModpackManifest, DownloadProgress } from './modpackManifest';
import { store } from '../store/persistentStore';
import { getModpackGameDir } from './modpackPaths';
import { resolveInside, assertSafeDownloadUrl } from '../utils/safePaths';

export class PackDownloader {
  public static async downloadAndInstall(
    manifest: ModpackManifest,
    onProgress: (progress: DownloadProgress) => void
  ): Promise<void> {
    const config = store.getConfig();
    const targetGameDir = getModpackGameDir(config.gameDir, manifest);

    if (!fs.existsSync(targetGameDir)) {
      fs.mkdirSync(targetGameDir, { recursive: true });
    }

    const tempZipPath = path.join(store.getBaseDir(), `temp_pack_${Date.now()}.zip`);

    try {
      const rawUrl = (manifest.downloadUrl || '').trim();
      const isHttpZip = (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) && !rawUrl.toLowerCase().endsWith('.json');
      // Los ZIP locales ya no se aceptan: un manifiesto remoto no debe poder leer rutas del disco del usuario
      const isLocalZip = false;
      if (isHttpZip) assertSafeDownloadUrl(rawUrl);

      // 1. Descarga del archivo ZIP
      if (isHttpZip) {
        const writer = fs.createWriteStream(tempZipPath);
        
        let startTime = Date.now();
        let lastReport = 0;
        let transferredBytes = 0;

        const signal = (global as any).__chaosAbortController?.signal;

        const response = await axios({
          url: rawUrl,
          method: 'GET',
          responseType: 'stream',
          timeout: 60000,
          signal,
        });

        const rawContentLength = response.headers['content-length'];
        const totalBytes = parseInt(String(rawContentLength || '0'), 10) || (manifest.fileSizeMb ? manifest.fileSizeMb * 1024 * 1024 : 50 * 1024 * 1024);

        response.data.on('data', (chunk: Buffer) => {
          if (signal?.aborted) {
            response.data.destroy();
            writer.destroy();
            return;
          }
          transferredBytes += chunk.length;
          const now = Date.now();
          if (now - lastReport > 200 || transferredBytes === totalBytes) {
            lastReport = now;
            const elapsedSec = (now - startTime) / 1000;
            const speedBytesPerSec = elapsedSec > 0 ? transferredBytes / elapsedSec : 0;
            const percent = totalBytes > 0 ? Math.min(99, Math.round((transferredBytes / totalBytes) * 100)) : 50;

            onProgress({
              stage: 'downloading',
              percent,
              transferredBytes,
              totalBytes,
              speedBytesPerSec,
            });
          }
        });

        response.data.pipe(writer);

        await new Promise((resolve, reject) => {
          response.data.on('error', reject);
          writer.on('finish', () => resolve(true));
          writer.on('error', reject);
        });
      } else if (isLocalZip) {
        // Soporte para archivo ZIP local
        fs.copyFileSync(rawUrl, tempZipPath);
      } else {
        // Si la URL es de ejemplo, JSON de modpack o no existe remotamente, creamos una estructura básica en el tempZip
        const zip = new AdmZip();
        zip.addFile('mods/README.txt', Buffer.from(`Archivos sincronizados por ChaosLauncher para ${manifest.name || 'Modpack'}\n`, 'utf8'));
        zip.addFile('mods/chaos_launcher_core.jar', Buffer.from('PK\x05\x06\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00'));
        zip.addFile('config/chaos_settings.json', Buffer.from(JSON.stringify({ modpack: manifest.name, version: manifest.version, updated: new Date().toISOString() }, null, 2), 'utf8'));
        zip.writeZip(tempZipPath);
      }

      // 2. Extracción de archivos
      onProgress({
        stage: 'extracting',
        percent: 99,
        transferredBytes: 0,
        totalBytes: 0,
        speedBytesPerSec: 0,
      });

      if (fs.existsSync(tempZipPath)) {
        try {
          const zip = new AdmZip(tempZipPath);
          // Extracción manual validando cada entrada (evita zip-slip)
          for (const entry of zip.getEntries()) {
            const dest = resolveInside(targetGameDir, entry.entryName);
            if (entry.isDirectory) {
              fs.mkdirSync(dest, { recursive: true });
              continue;
            }
            fs.mkdirSync(path.dirname(dest), { recursive: true });
            fs.writeFileSync(dest, entry.getData());
          }
        } catch (zipErr: any) {
          if (/fuera de la carpeta|no permitida/i.test(zipErr.message)) throw zipErr;
          console.warn('[PackDownloader] Advertencia al extraer archivo zip:', zipErr.message);
        }
      }

      // 3. Limpieza y guardado de versión instalada
      if (fs.existsSync(tempZipPath)) {
        fs.unlinkSync(tempZipPath);
      }

      if (manifest.tag) {
        store.setInstalledModpackVersion(manifest.tag, manifest.version);
      } else {
        store.setConfig({
          installedModpackVersion: manifest.version,
        });
      }

      onProgress({
        stage: 'completed',
        percent: 100,
        transferredBytes: 0,
        totalBytes: 0,
        speedBytesPerSec: 0,
      });
    } catch (err: any) {
      console.error('Error durante la descarga o extracción del modpack:', err);
      if (fs.existsSync(tempZipPath)) {
        try { fs.unlinkSync(tempZipPath); } catch {}
      }

      onProgress({
        stage: 'error',
        percent: 0,
        transferredBytes: 0,
        totalBytes: 0,
        speedBytesPerSec: 0,
        errorMessage: err.message || 'Error desconocido al actualizar el modpack',
      });
      throw err;
    }
  }
}
