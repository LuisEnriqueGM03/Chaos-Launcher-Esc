import fs from 'fs';
import path from 'path';
import axios from 'axios';
import https from 'https';
import { pipeline } from 'stream/promises';
import { ModpackManifest, ModpackFileEntry } from './modpackManifest';
import { resolveFileDest } from './fileDest';
import { calculateSha1Async } from './fileHash';
import { assertSafeDownloadUrl, normalizeDownloadUrl } from '../utils/safePaths';
import { BACKEND_URL } from '../config/backend';

// Reutiliza conexiones TLS: evita un handshake por cada archivo pequeño.
const keepAliveAgent = new https.Agent({ keepAlive: true, maxSockets: 32 });

export interface DownloadContext {
  signal: AbortSignal;
  targetGameDir: string;
  gameDir: string;
  manifest: ModpackManifest;
  disabledMods: Set<string>;
  /** Se invoca por cada chunk descargado (para el progreso global). */
  onBytes: (bytes: number) => void;
  /** Se invoca al instalar un archivo (para poder revertir la sesión si se cancela). */
  onFileInstalled: (filePath: string) => void;
}

// Función auxiliar para codificar segmentos de ruta de manera segura para peticiones HTTP
function buildSafeUrl(base: string, relPath: string): string {
  const encodedSegments = relPath
    .replace(/\\/g, '/')
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  return `${base}/${encodedSegments}`;
}

export async function downloadManifestFile(ctx: DownloadContext, entry: ModpackFileEntry, retryCount = 0): Promise<void> {
  const { signal, targetGameDir, manifest, disabledMods } = ctx;
  const config = { gameDir: ctx.gameDir };
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
    : (manifest.downloadUrl ? manifest.downloadUrl.replace(/\/[^/]+$/, '') : `${BACKEND_URL}/uploads`);

  // Caso A: Archivo dividido en chunks / partes transparentes
  if (entry.parts && entry.parts.length > 0) {
    const tempChunkPath = `${finalDestPath}.tmp_${Date.now()}`;
    const chunkWriter = fs.createWriteStream(tempChunkPath);

    try {
      for (const partRel of entry.parts) {
        if (signal.aborted) throw new Error('CANCELLED');
        const partUrl = assertSafeDownloadUrl(buildSafeUrl(rawBase, partRel));
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
          ctx.onBytes(chunk.length);
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
      ctx.onFileInstalled(finalDestPath);
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
        return downloadManifestFile(ctx, entry, retryCount + 1);
      }
      throw chunkErr;
    }
  }

  // Caso B: Archivo convencional individual
  let fileUrl = entry.downloadUrl;
  if (!fileUrl) {
    fileUrl = buildSafeUrl(rawBase, entry.path);
  } else {
    fileUrl = normalizeDownloadUrl(fileUrl);
  }

  const tempPath = `${finalDestPath}.tmp_${Date.now()}`;

  try {
    assertSafeDownloadUrl(fileUrl);
    const response = await axios({
      url: fileUrl,
      method: 'GET',
      responseType: 'stream',
      timeout: 45000,
      signal,
      httpsAgent: keepAliveAgent,
    });

    const writer = fs.createWriteStream(tempPath);

    response.data.on('data', (chunk: Buffer) => {
      if (signal.aborted) {
        response.data.destroy();
        writer.destroy();
        return;
      }
      ctx.onBytes(chunk.length);
    });

    await pipeline(response.data, writer);

    if (signal.aborted) {
      if (fs.existsSync(tempPath)) {
        try { fs.unlinkSync(tempPath); } catch {}
      }
      throw new Error('CANCELLED');
    }

    // Verificar integridad del archivo descargado contra el hash del manifiesto
    if (entry.sha1) {
      const downloadedSha1 = await calculateSha1Async(tempPath);
      if (downloadedSha1.toLowerCase() !== entry.sha1.toLowerCase()) {
        throw new Error(`Hash SHA-1 inválido para "${entry.path}" (descarga corrupta o manipulada)`);
      }
    }

    // Mover temp a destino final con reemplazo seguro en Windows
    if (fs.existsSync(finalDestPath)) {
      try { fs.unlinkSync(finalDestPath); } catch {}
    }
    fs.renameSync(tempPath, finalDestPath);
    ctx.onFileInstalled(finalDestPath);
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
      return downloadManifestFile(ctx, entry, retryCount + 1);
    }
    throw err;
  }
}
