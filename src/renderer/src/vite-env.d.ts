/// <reference types="vite/client" />

export interface UserAccount {
  id: string;
  type: 'microsoft' | 'offline';
  name: string;
  uuid: string;
  skinUrl: string;
  accessToken?: string;
  refreshToken?: string;
}

export interface SkinInfo {
  dataUrl: string | null;
  variant: 'classic' | 'slim';
  canEdit: boolean;
  mode: 'mojang' | 'local';
  notice?: string;
}

export interface AuthState {
  activeAccount: UserAccount | null;
  accounts: UserAccount[];
}

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

export interface ModpackServerInfo {
  ip: string;
  port: number;
}

export interface ModpackItem {
  id?: string;
  name: string;
  tag: string;
  description?: string;
  accentColor?: string;
  iconUrl?: string;
  wallpaperUrl?: string;
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
  titleImageUrl?: string;
  titleDisplayMode?: string;
  titleText?: string;
  author?: {
    username: string;
    skinUrl?: string;
  };
}

export interface ModpackManifest {
  tag?: string;
  name: string;
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

export interface LauncherConfig {
  accounts: UserAccount[];
  activeAccountId: string | null;
  activeModpackTag?: string | null;
  allocatedRamMb: number;
  javaPath: string;
  gameDir: string;
  modpackManifestUrl: string;
  installedModpackVersion: string | null;
  installedModpackVersions?: Record<string, string>;
  autoJoinServerByTag?: Record<string, boolean>;
}

export interface JavaInstallation {
  path: string;
  version: string;
  majorVersion: number;
}

export interface AppUpdateInfo {
  version: string;
  releaseDate?: string;
  releaseNotes?: string | null;
  mandatory?: boolean;
}

export interface AppUpdateProgress {
  percent: number;
  bytesPerSecond: number;
  transferred: number;
  total: number;
}

export interface ChaosAPI {
  window: {
    minimize: () => Promise<void>;
    maximize: () => Promise<void>;
    close: () => Promise<void>;
  };
  auth: {
    getState: () => Promise<AuthState>;
    loginOffline: (username: string) => Promise<AuthState>;
    loginMicrosoft: () => Promise<AuthState>;
    logout: () => Promise<AuthState>;
    switchAccount: (accountId: string) => Promise<AuthState>;
    deleteAccount: (accountId: string) => Promise<AuthState>;
  };
  skin: {
    get: () => Promise<SkinInfo>;
    renewSession: () => Promise<SkinInfo>;
    pick: () => Promise<string | null>;
    apply: (dataUrl: string, variant: 'classic' | 'slim') => Promise<SkinInfo>;
  };
  modpack: {
    getAll: () => Promise<ModpackItem[]>;
    refreshList: () => Promise<ModpackItem[]>;
    checkUpdate: (tag?: string) => Promise<UpdateCheckResult>;
    checkUpdateCached: (tag?: string) => Promise<UpdateCheckResult>;
    downloadUpdate: (tag?: string) => Promise<{ success: boolean; installedVersion: string }>;
    cancelDownload: () => Promise<{ success: boolean; cancelled: boolean }>;
    getOptionalMods: (tag?: string) => Promise<{ optionalMods: OptionalMod[]; disabled: string[] }>;
    toggleOptionalMod: (modFileName: string, enabled: boolean, tag?: string) => Promise<{ success: boolean; currentDisabled: string[] }>;
    deleteModpack: (tag?: string) => Promise<boolean>;
    onProgress: (callback: (progress: DownloadProgress) => void) => () => void;
  };
  launcher: {
    launch: (tag?: string) => Promise<void>;
    setKeepOpen: (keep: boolean) => Promise<void>;
    setAutoJoin: (tag: string, enabled: boolean) => Promise<LauncherConfig>;
    isRunning: () => Promise<boolean>;
    onProgress: (callback: (progress: any) => void) => () => void;
    onLog: (callback: (logLine: string) => void) => () => void;
    onClosed: (callback: (code: any) => void) => () => void;
    onError: (callback: (error: string) => void) => () => void;
  };
  config: {
    get: () => Promise<LauncherConfig>;
    update: (partial: Partial<LauncherConfig>) => Promise<LauncherConfig>;
  };
  updater: {
    getVersion: () => Promise<string>;
    checkForUpdates: () => Promise<void>;
    startDownload: () => Promise<void>;
    quitAndInstall: () => Promise<void>;
    onChecking: (callback: () => void) => () => void;
    onUpdateAvailable: (callback: (info: AppUpdateInfo) => void) => () => void;
    onUpdateNotAvailable: (callback: (info: { version: string }) => void) => () => void;
    onDownloadProgress: (callback: (progress: AppUpdateProgress) => void) => () => void;
    onUpdateDownloaded: (callback: (info: { version: string }) => void) => () => void;
    onError: (callback: (error: string) => void) => () => void;
  };
  system: {
    getJavaList: () => Promise<JavaInstallation[]>;
    getSystemMemory: () => Promise<number>;
    openFolder: (folderPath: string) => Promise<void>;
    getServerStatus: (host: string) => Promise<{ online: boolean; players: number; max: number }>;
    uninstallApp: () => Promise<{ success: boolean; message?: string }>;
  };
}

declare global {
  interface Window {
    chaosAPI: ChaosAPI;
  }
}
