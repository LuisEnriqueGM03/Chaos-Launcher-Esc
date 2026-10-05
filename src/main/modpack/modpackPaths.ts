import path from 'path';
import { ModpackManifest } from './modpackManifest';

// Nombres que Windows no permite como carpeta (CON, NUL, COM1...)
const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

/**
 * Convierte el tag del modpack (el mismo identificador que usa el backend y el front) en nombre de carpeta.
 * Nunca hay una carpeta "por defecto": sin tag no se puede saber a qué modpack pertenece, y una carpeta
 * compartida mezclaría mods y configuraciones de packs distintos.
 */
export function sanitizeTag(tag?: string | null): string {
  const clean = typeof tag === 'string' ? tag.trim().replace(/[^a-zA-Z0-9_\-\.]/g, '_') : '';
  if (!clean || /^\.+$/.test(clean)) {
    throw new Error('Tag de modpack inválido: no se puede determinar la carpeta del modpack.');
  }
  return WINDOWS_RESERVED.test(clean) ? `${clean}_` : clean;
}

export function getModpackGameDir(baseGameDir: string, tagOrManifest?: string | ModpackManifest | null): string {
  const tag = typeof tagOrManifest === 'string' ? tagOrManifest : tagOrManifest?.tag;
  return path.join(baseGameDir, sanitizeTag(tag));
}

export function getModpackModsDir(baseGameDir: string, tagOrManifest?: string | ModpackManifest | null): string {
  return path.join(getModpackGameDir(baseGameDir, tagOrManifest), 'mods');
}
