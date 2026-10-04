import path from 'path';

/**
 * Resuelve `relPath` dentro de `baseDir` y lanza si el resultado se sale de él
 * (path traversal con "..", rutas absolutas, unidades de Windows, etc.).
 */
export function resolveInside(baseDir: string, relPath: string): string {
  const base = path.resolve(baseDir);
  const normalizedRel = String(relPath).replace(/\\/g, '/');
  if (!normalizedRel || normalizedRel.includes('\0') || path.isAbsolute(normalizedRel) || /^[A-Za-z]:/.test(normalizedRel)) {
    throw new Error(`Ruta de archivo no permitida: "${relPath}"`);
  }
  const resolved = path.resolve(base, normalizedRel);
  if (resolved !== base && !resolved.startsWith(base + path.sep)) {
    throw new Error(`Ruta fuera de la carpeta del modpack: "${relPath}"`);
  }
  return resolved;
}

export function isInside(baseDir: string, target: string): boolean {
  const base = path.resolve(baseDir);
  const resolved = path.resolve(target);
  return resolved === base || resolved.startsWith(base + path.sep);
}

/** Solo https (o http hacia localhost, para desarrollo local del backend). */
export function assertSafeDownloadUrl(rawUrl: string): string {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error(`URL de descarga inválida: "${rawUrl}"`);
  }
  const isLocal = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol === 'https:' || (url.protocol === 'http:' && isLocal)) {
    return rawUrl;
  }
  throw new Error(`Protocolo no permitido en URL de descarga: "${url.protocol}"`);
}
