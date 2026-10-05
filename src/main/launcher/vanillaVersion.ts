import fs from 'fs';
import path from 'path';
import { getJsonWithRetry } from './httpJson';

const MANIFEST_URLS = [
  'https://piston-meta.mojang.com/mc/game/version_manifest.json',
  'https://launchermeta.mojang.com/mc/game/version_manifest.json',
];

/**
 * Garantiza que `<root>/versions/<mc>/<mc>.json` exista antes de lanzar.
 *
 * minecraft-launcher-core lo descarga con `throw` dentro de un callback: si la red falla en ese instante
 * (reset de TLS, timeout...) se produce una excepción sin capturar que cierra el proceso principal.
 * Descargándolo aquí, con reintentos, el fallo llega como un error normal que se muestra al jugador.
 */
export async function ensureVanillaVersionJson(
  root: string,
  minecraftVersion: string,
  sharedGameDir?: string,
): Promise<void> {
  const dest = path.join(root, 'versions', minecraftVersion, `${minecraftVersion}.json`);
  if (fs.existsSync(dest)) return;

  fs.mkdirSync(path.dirname(dest), { recursive: true });

  // Copia local ya descargada por otro modpack: sin red
  if (sharedGameDir) {
    const shared = path.join(sharedGameDir, 'versions', minecraftVersion, `${minecraftVersion}.json`);
    if (shared !== dest && fs.existsSync(shared)) {
      fs.copyFileSync(shared, dest);
      return;
    }
  }

  try {
    const manifest = await getJsonWithRetry(MANIFEST_URLS);
    const entry = Array.isArray(manifest.versions)
      ? manifest.versions.find((v: any) => v.id === minecraftVersion)
      : null;
    if (!entry?.url) {
      throw new Error(`La versión ${minecraftVersion} de Minecraft no existe en el manifiesto de Mojang.`);
    }
    const versionJson = await getJsonWithRetry([entry.url]);
    // Escritura atómica: nunca queda un JSON a medias que MCLC intentaría leer
    const tmp = `${dest}.tmp_${Date.now()}`;
    fs.writeFileSync(tmp, JSON.stringify(versionJson, null, 4), 'utf8');
    fs.renameSync(tmp, dest);
  } catch (err: any) {
    if (/no existe en el manifiesto/.test(err?.message || '')) throw err;
    throw new Error(
      `No se pudo descargar la información de Minecraft ${minecraftVersion} desde los servidores de Mojang. ` +
        'Comprueba tu conexión a internet (o antivirus/firewall) e inténtalo de nuevo.',
    );
  }
}
