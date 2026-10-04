import axios from 'axios';
import { ModpackManifest, ModpackFileEntry, DownloadProgress } from './modpackManifest';
import { assertSafeDownloadUrl } from '../utils/safePaths';

/**
 * Completa el manifiesto con la lista de archivos remota:
 *  1. descarga modpack.json si downloadUrl apunta a uno;
 *  2. descubre archivos nuevos del repositorio vía GitHub Git Tree API.
 * Modifica `manifest` in-place.
 */
export async function resolveRemoteManifest(
  manifest: ModpackManifest,
  onProgress: (progress: DownloadProgress) => void,
): Promise<void> {
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
      assertSafeDownloadUrl(manifest.downloadUrl);
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
}
