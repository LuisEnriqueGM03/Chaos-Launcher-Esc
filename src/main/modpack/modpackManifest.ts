export interface ModpackLoader {
  type: 'vanilla' | 'fabric' | 'forge' | 'neoforge';
  version?: string;
}

export interface OptionalMod {
  id: string;
  name: string;
  file: string;
  description: string;
  defaultEnabled: boolean;
}

export interface ModpackFileEntry {
  path: string;
  sha1: string;
  size: number;
  downloadUrl?: string;
  parts?: string[];
}

export interface ModpackServerInfo {
  ip: string;
  port: number;
}

export interface ModpackItem {
  id?: string;
  /** URLs de origen de las imágenes ya convertidas a data URI (para no volver a descargarlas si no cambian). */
  _src?: { iconUrl?: string; wallpaperUrl?: string; titleImageUrl?: string };
  name: string;
  tag: string;
  description?: string;
  accentColor?: string;
  iconUrl?: string;
  wallpaperUrl?: string;
  titleImageUrl?: string;
  titleDisplayMode?: string;
  titleText?: string;
  serverIp: string;
  serverPort: number;
  version: string;
  minecraftVersion: string;
  loaderType: string;
  loaderVersion?: string;
  recommendedRam: number;
  minRam?: number;
  githubRepo?: string;
  downloadUrl?: string;
  forceUpdate?: boolean;
  hasOptionalMods?: boolean;
  optionalMods?: OptionalMod[];
  hasRules?: boolean;
  rulesContent?: string;
  hasDiscord?: boolean;
  discordUrl?: string;
  hasChangelog?: boolean;
  changelog?: string[];
  versions?: Array<{
    version: string;
    changelog?: string[];
    fileSizeMb?: number;
  }>;
  author?: {
    username: string;
    skinUrl?: string;
  };
}

export interface ModpackManifest {
  tag?: string;
  name: string;
  description?: string;
  version: string;
  minecraftVersion: string;
  loader: ModpackLoader;
  server?: ModpackServerInfo;
  recommendedRam?: number;
  optionalMods?: OptionalMod[];
  downloadUrl?: string;
  forceUpdate?: boolean;
  hasOptionalMods?: boolean;
  hasRules?: boolean;
  rulesContent?: string;
  hasDiscord?: boolean;
  discordUrl?: string;
  hasChangelog?: boolean;
  changelog: string[];
  fileSizeMb?: number;
  sha1?: string;
  files?: ModpackFileEntry[];
  accentColor?: string;
  iconUrl?: string;
  wallpaperUrl?: string;
  titleImageUrl?: string;
  titleDisplayMode?: string;
  titleText?: string;
  githubRepo?: string;
}

export interface UpdateCheckResult {
  isUpdateAvailable: boolean;
  isMandatory: boolean;
  currentVersion: string | null;
  remoteVersion: string;
  manifest: ModpackManifest | null;
}

export interface DownloadProgress {
  percent: number;
  transferredBytes: number;
  totalBytes: number;
  speedBytesPerSec: number;
  stage: 'downloading' | 'extracting' | 'verifying' | 'completed' | 'error';
  errorMessage?: string;
}
