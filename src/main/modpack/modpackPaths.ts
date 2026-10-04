import path from 'path';
import { ModpackManifest } from './modpackManifest';

export function sanitizeTag(tag?: string | null): string {
  if (!tag || typeof tag !== 'string' || tag.trim().length === 0) {
    return 'mimic-server';
  }
  return tag.trim().replace(/[^a-zA-Z0-9_\-\.]/g, '_');
}

export function getModpackGameDir(baseGameDir: string, tagOrManifest?: string | ModpackManifest | null): string {
  let tag = '';
  if (typeof tagOrManifest === 'string') {
    tag = tagOrManifest;
  } else if (tagOrManifest) {
    tag = tagOrManifest.tag || tagOrManifest.name || '';
  }
  const folderName = sanitizeTag(tag);
  return path.join(baseGameDir, folderName);
}

export function getModpackModsDir(baseGameDir: string, tagOrManifest?: string | ModpackManifest | null): string {
  return path.join(getModpackGameDir(baseGameDir, tagOrManifest), 'mods');
}
