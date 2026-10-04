import { resolveInside } from '../utils/safePaths';

export interface DestResolution {
  destPath: string;
  alsoCopyPath?: string;
}

export function resolveFileDest(filePath: string, targetGameDir: string, _baseGameDir: string): DestResolution {
  // Absolutamente todo el contenido del modpack se descarga e instala DENTRO de la carpeta del modpack (targetGameDir)
  const destPath = resolveInside(targetGameDir, filePath);
  return { destPath };
}
