import fs from 'fs';
import path from 'path';
import { getJsonWithRetry } from './httpJson';

const SAFE_VERSION = /^[A-Za-z0-9._+-]{1,64}$/;

/** Id de la versión de Fabric tal como la nombra Fabric y como la busca minecraft-launcher-core. */
export function fabricVersionId(minecraftVersion: string, loaderVersion: string): string {
  return `fabric-loader-${loaderVersion}-${minecraftVersion}`;
}

/**
 * Garantiza que exista `<root>/versions/<id>/<id>.json` (el perfil de Fabric: clase principal Knot y librerías).
 *
 * Nada más lo instala: sin este perfil minecraft-launcher-core falla en silencio (devuelve null) y el launcher
 * se cerraba sin abrir el juego. Se descarga del meta oficial de Fabric y se reutiliza si ya existe.
 * Devuelve el id de la versión para usarlo como `version.custom`.
 */
export async function ensureFabricProfile(
  root: string,
  minecraftVersion: string,
  loaderVersion: string,
): Promise<string> {
  // Estos valores llegan del backend y se usan en una URL y en una ruta de disco
  if (!SAFE_VERSION.test(minecraftVersion) || !SAFE_VERSION.test(loaderVersion)) {
    throw new Error('Versión de Minecraft o de Fabric inválida en el modpack.');
  }

  const id = fabricVersionId(minecraftVersion, loaderVersion);
  const dest = path.join(root, 'versions', id, `${id}.json`);

  if (fs.existsSync(dest)) {
    try {
      const existing = JSON.parse(fs.readFileSync(dest, 'utf8'));
      if (existing && existing.mainClass && Array.isArray(existing.libraries)) return id;
    } catch {
      // JSON corrupto: se vuelve a descargar
    }
  }

  let profile: any;
  try {
    profile = await getJsonWithRetry([
      `https://meta.fabricmc.net/v2/versions/loader/${encodeURIComponent(minecraftVersion)}/${encodeURIComponent(loaderVersion)}/profile/json`,
    ]);
  } catch {
    throw new Error(
      `No se pudo descargar Fabric ${loaderVersion} para Minecraft ${minecraftVersion}. ` +
        'Comprueba tu conexión a internet (o antivirus/firewall) e inténtalo de nuevo.',
    );
  }

  if (!profile || profile.id !== id || !profile.mainClass || !Array.isArray(profile.libraries)) {
    throw new Error(`Fabric ${loaderVersion} no está disponible para Minecraft ${minecraftVersion}.`);
  }

  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const tmp = `${dest}.tmp_${Date.now()}`;
  fs.writeFileSync(tmp, JSON.stringify(profile, null, 4), 'utf8');
  fs.renameSync(tmp, dest);
  return id;
}
