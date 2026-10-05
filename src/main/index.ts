import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import os from 'os';
import axios from 'axios';
import { AuthManager } from './auth/authManager';
import { SkinManager } from './auth/skinManager';
import { store } from './store/persistentStore';
import { UpdateChecker } from './modpack/updateChecker';
import { PackDownloader } from './modpack/packDownloader';
import { DifferentialSync } from './modpack/differentialSync';
import { gameLauncher } from './launcher/gameLauncher';
import { JavaDetector } from './launcher/javaDetector';
import { AppUpdater } from './updater/appUpdater';
import { UninstallerService } from './system/uninstaller';
import { formatFriendlyError } from './utils/errorFormatter';
import { isInside } from './utils/safePaths';

let mainWindow: BrowserWindow | null = null;

function openExternalSafe(url: string): void {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'https:') {
      shell.openExternal(url);
    } else {
      console.warn(`[Seguridad] Bloqueada apertura externa con protocolo no permitido: ${parsed.protocol}`);
    }
  } catch {
    console.warn('[Seguridad] URL externa inválida bloqueada.');
  }
}

/** Nunca se envían tokens de acceso al renderer. */
function publicAccount<T extends { accessToken?: string; refreshToken?: string } | null>(acc: T): T {
  if (!acc) return acc;
  const { accessToken, refreshToken, ...safe } = acc as any;
  return safe as T;
}

function publicAuthState() {
  return {
    activeAccount: publicAccount(AuthManager.getActiveAccount()),
    accounts: AuthManager.getAllAccounts().map((a) => publicAccount(a)),
  };
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1080,
    height: 720,
    minWidth: 950,
    minHeight: 640,
    frame: false, // Ventana sin bordes estilo gamer
    titleBarStyle: 'hidden',
    backgroundColor: '#080505',
    icon: path.join(__dirname, '../../icon.png'),
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  // Cargar dev server si estamos en desarrollo activo, o cargar dist/index.html
  const distHtmlPath = path.join(__dirname, '../../dist/index.html');
  if (process.env.VITE_DEV_SERVER_URL || process.env.NODE_ENV === 'development') {
    const url = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
    mainWindow.loadURL(url).catch(() => {
      if (fs.existsSync(distHtmlPath)) {
        mainWindow?.loadFile(distHtmlPath);
      }
    });
  } else if (fs.existsSync(distHtmlPath)) {
    mainWindow.loadFile(distHtmlPath);
  } else {
    mainWindow.loadURL('http://localhost:5173').catch(() => {
      console.error('No se pudo encontrar dist/index.html ni el servidor Vite.');
    });
  }

  // Forward de logs del renderer a la consola de Electron
  mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    const levels = ['LOG', 'WARN', 'ERROR', 'INFO'];
    console.log(`[Renderer ${levels[level] || level}] ${message} (${sourceId}:${line})`);
  });

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error(`[Error de carga] ${errorCode}: ${errorDescription} (${validatedURL})`);
  });

  // Atajo F12 para abrir/cerrar DevTools durante desarrollo
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12' && input.type === 'keyDown') {
      mainWindow?.webContents.toggleDevTools();
      event.preventDefault();
    }
  });

  // Prevenir navegación externa indebida
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    openExternalSafe(url);
    return { action: 'deny' };
  });

  // Bloquear cualquier navegación del renderer fuera de la app (dev server o archivo local)
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const isDevUrl = !!process.env.VITE_DEV_SERVER_URL && url.startsWith(process.env.VITE_DEV_SERVER_URL);
    const isLocalApp = url.startsWith('file://') || url.startsWith('http://localhost:5173');
    if (!isDevUrl && !isLocalApp) {
      event.preventDefault();
      openExternalSafe(url);
    }
  });

  // Inicializar el actualizador automático ligado a GitHub Releases
  // La comprobación la dispara el renderer (updater:checkForUpdates) una vez suscrito a los eventos,
  // para que ninguna respuesta se pierda antes de mostrar la interfaz.
  AppUpdater.init(mainWindow);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  store.unlockAccounts();
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.chaoslauncher.app');
  }
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// ==========================================
// IPC HANDLERS: VENTANA
// ==========================================
ipcMain.handle('window:minimize', () => {
  mainWindow?.minimize();
});

ipcMain.handle('window:maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});

ipcMain.handle('window:close', () => {
  mainWindow?.close();
});

// ==========================================
// IPC HANDLERS: AUTENTICACIÓN
// ==========================================
ipcMain.handle('app:getVersion', () => app.getVersion());

ipcMain.handle('auth:getState', () => publicAuthState());

ipcMain.handle('auth:loginOffline', async (_, username: string) => {
  if (typeof username !== 'string') throw new Error('Apodo inválido.');
  await AuthManager.loginOffline(username);
  return publicAuthState();
});

ipcMain.handle('auth:loginMicrosoft', async () => {
  if (!mainWindow) throw new Error('Ventana no disponible.');
  await AuthManager.loginMicrosoft(mainWindow);
  return publicAuthState();
});

ipcMain.handle('auth:logout', () => {
  AuthManager.logout();
  return { ...publicAuthState(), activeAccount: null };
});

ipcMain.handle('auth:switchAccount', (_, accountId: string) => {
  if (typeof accountId !== 'string') throw new Error('Cuenta inválida.');
  AuthManager.switchAccount(accountId);
  return publicAuthState();
});

ipcMain.handle('auth:deleteAccount', (_, accountId: string) => {
  if (typeof accountId !== 'string') throw new Error('Cuenta inválida.');
  AuthManager.deleteAccount(accountId);
  return publicAuthState();
});

// Skins (premium: API de Mojang; offline: almacenamiento local)
ipcMain.handle('skin:get', async () => {
  const account = AuthManager.getActiveAccount();
  if (!account) throw new Error('Inicia sesión para gestionar tu skin.');
  return SkinManager.getSkin(account);
});

// Renueva la sesión de Microsoft: primero con el token de renovación; si falla, abre el inicio de sesión.
ipcMain.handle('skin:renewSession', async () => {
  const account = AuthManager.getActiveAccount();
  if (!account || account.type !== 'microsoft') throw new Error('Solo las cuentas premium tienen sesión de Microsoft.');
  try {
    await AuthManager.refreshMicrosoft(account);
  } catch {
    if (!mainWindow) throw new Error('Ventana no disponible.');
    await AuthManager.loginMicrosoft(mainWindow);
  }
  const current = AuthManager.getActiveAccount();
  if (!current) throw new Error('No se pudo renovar la sesión.');
  return SkinManager.getSkin(current);
});

ipcMain.handle('skin:pick', async () => SkinManager.pickSkinFile(mainWindow));

ipcMain.handle('skin:apply', async (_, dataUrl: string, variant: string) => {
  const account = AuthManager.getActiveAccount();
  if (!account) throw new Error('Inicia sesión para gestionar tu skin.');
  if (typeof dataUrl !== 'string') throw new Error('Imagen de skin inválida.');
  await SkinManager.applySkin(account, dataUrl, variant === 'slim' ? 'slim' : 'classic');
  return SkinManager.getSkin(account);
});

// ==========================================
// IPC HANDLERS: MODPACK & ACTUALIZACIONES
// ==========================================
ipcMain.handle('modpack:getAll', async () => {
  return await UpdateChecker.getModpacks();
});

ipcMain.handle('modpack:refreshList', async () => {
  return await UpdateChecker.refreshModpacks();
});

ipcMain.handle('modpack:checkUpdate', async (_, tag?: string) => {
  assertTag(tag);
  return await UpdateChecker.checkUpdate(tag);
});

ipcMain.handle('modpack:downloadUpdate', async (_, tag?: string) => {
  assertTag(tag);
  try {
    const updateResult = await UpdateChecker.checkUpdate(tag);
    const manifest = updateResult.manifest || UpdateChecker.getDefaultManifest(tag);

    await DifferentialSync.sync(manifest, (progress) => {
      try {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('modpack:progress', progress);
        }
      } catch {
        // Safe ignore
      }
    });

    return { success: true, installedVersion: manifest.version };
  } catch (err: any) {
    console.error('[modpack:downloadUpdate] Error durante la descarga:', err);
    throw new Error(formatFriendlyError(err));
  }
});

ipcMain.handle('modpack:cancelDownload', async () => {
  return DifferentialSync.cancel();
});

ipcMain.handle('modpack:getOptionalMods', async (_, tag?: string) => {
  assertTag(tag);
  const updateResult = await UpdateChecker.checkUpdate(tag);
  const manifest = updateResult.manifest || UpdateChecker.getDefaultManifest(tag);
  const cachedModpack = store.getCachedModpacks().find((m) => m.tag === tag);
  const optionalMods = manifest?.optionalMods !== undefined
    ? manifest.optionalMods
    : (cachedModpack?.optionalMods || []);

  return {
    optionalMods,
    disabled: store.getDisabledOptionalMods(optionalMods),
  };
});

ipcMain.handle('modpack:toggleOptionalMod', (_, modFileName: string, enabled: boolean) => {
  if (typeof modFileName !== 'string' || /[\\/]|\.\./.test(modFileName) || typeof enabled !== 'boolean') {
    throw new Error('Mod inválido.');
  }
  return store.toggleOptionalMod(modFileName, enabled);
});

ipcMain.handle('modpack:deleteModpack', async (_, tag?: string) => {
  assertTag(tag);
  return store.deleteModpackFromCache(tag);
});

// ==========================================
// IPC HANDLERS: LANZADOR DE MINECRAFT
// ==========================================
ipcMain.handle('launcher:launch', async () => {
  try {
    return await gameLauncher.launch();
  } catch (err: any) {
    throw new Error(formatFriendlyError(err));
  }
});

ipcMain.handle('launcher:isRunning', () => {
  return gameLauncher.getIsRunning();
});

// Reenviar eventos del juego al Renderer
gameLauncher.on('progress', (e) => {
  mainWindow?.webContents.send('launcher:progress', e);
});

gameLauncher.on('log', (line) => {
  mainWindow?.webContents.send('launcher:log', line);
});

gameLauncher.on('game-closed', (code) => {
  mainWindow?.webContents.send('launcher:closed', code);
});

gameLauncher.on('game-started', () => {
  mainWindow?.webContents.send('launcher:started');
  setTimeout(() => {
    mainWindow?.close();
  }, 1200);
});

gameLauncher.on('error', (err) => {
  mainWindow?.webContents.send('launcher:error', formatFriendlyError(err));
});

// ==========================================
// IPC HANDLERS: CONFIGURACIÓN & SISTEMA
// ==========================================
function assertTag(tag?: unknown): void {
  if (tag !== undefined && tag !== null && (typeof tag !== 'string' || !/^[A-Za-z0-9_.-]{1,64}$/.test(tag))) {
    throw new Error('Tag de modpack inválido.');
  }
}

function publicConfig() {
  const cfg = store.getConfig();
  return { ...cfg, accounts: cfg.accounts.map((a) => publicAccount(a)) };
}

ipcMain.handle('config:get', () => publicConfig());

// El renderer solo puede modificar estas claves (nada de cuentas, URLs de manifiesto, etc.)
ipcMain.handle('config:update', (_, partial: Record<string, unknown>) => {
  if (!partial || typeof partial !== 'object') throw new Error('Configuración inválida.');
  const safe: Record<string, unknown> = {};

  if ('allocatedRamMb' in partial) {
    const ram = Number(partial.allocatedRamMb);
    if (!Number.isFinite(ram) || ram < 512 || ram > 1024 * 128) throw new Error('RAM inválida.');
    safe.allocatedRamMb = Math.round(ram);
  }
  if ('javaPath' in partial) {
    const javaPath = partial.javaPath;
    if (typeof javaPath !== 'string' || javaPath.length > 1000) throw new Error('Ruta de Java inválida.');
    if (javaPath && !/(^|[\\/])javaw?(\.exe)?$/i.test(javaPath)) throw new Error('La ruta de Java debe apuntar a java o javaw.');
    safe.javaPath = javaPath;
  }
  if ('gameDir' in partial) {
    const gameDir = partial.gameDir;
    if (typeof gameDir !== 'string' || !path.isAbsolute(gameDir) || gameDir.length > 1000) throw new Error('Carpeta de juego inválida.');
    safe.gameDir = gameDir;
  }
  if ('activeModpackTag' in partial) {
    const tag = partial.activeModpackTag;
    if (tag !== null && (typeof tag !== 'string' || !/^[A-Za-z0-9_.-]{1,64}$/.test(tag))) throw new Error('Tag inválido.');
    safe.activeModpackTag = tag;
  }

  store.setConfig(safe);
  return publicConfig();
});

ipcMain.handle('system:getJavaList', () => {
  return JavaDetector.detectJavaInstallations();
});

ipcMain.handle('system:getSystemMemory', () => {
  const totalBytes = os.totalmem();
  return Math.round(totalBytes / (1024 * 1024));
});

ipcMain.handle('system:openFolder', (_, folderPath: string) => {
  if (typeof folderPath !== 'string' || !folderPath) return;
  // Solo carpetas dentro de la carpeta del juego o de los datos del launcher
  const allowedRoots = [store.getConfig().gameDir, store.getBaseDir()];
  if (!allowedRoots.some((root) => isInside(root, folderPath))) {
    console.warn('[Seguridad] openFolder bloqueado fuera de las carpetas del launcher:', folderPath);
    return;
  }
  shell.openPath(folderPath);
});

ipcMain.handle('system:getServerStatus', async (_, host: string) => {
  if (typeof host !== 'string' || !/^[A-Za-z0-9]([A-Za-z0-9.:-]{0,251}[A-Za-z0-9])?$/.test(host)) {
    return { online: false, players: 0, max: 20 };
  }
  const backendBase = process.env.CHAOS_BACKEND_URL || 'http://localhost:3000/api/v1';
  const urls: string[] = [];
  if (backendBase.includes('localhost')) {
    urls.push(backendBase.replace('localhost', '127.0.0.1'));
    urls.push(backendBase);
  } else if (backendBase.includes('127.0.0.1')) {
    urls.push(backendBase);
    urls.push(backendBase.replace('127.0.0.1', 'localhost'));
  } else {
    urls.push(backendBase);
  }

  for (const base of urls) {
    try {
      const res = await axios.get(`${base}/modpacks/ping/direct?ip=${encodeURIComponent(host)}`, { timeout: 4000 });
      if (res.data && res.data.data) {
        return {
          online: Boolean(res.data.data.online),
          players: res.data.data.players?.online ?? 0,
          max: res.data.data.players?.max ?? 20,
        };
      }
      break;
    } catch {
      // Intentar con siguiente URL si falló por conexión
    }
  }

  try {
    const res = await axios.get(`https://api.mcsrvstat.us/3/${encodeURIComponent(host)}`, { timeout: 4000 });
    return {
      online: Boolean(res.data?.online),
      players: res.data?.players?.online ?? 0,
      max: res.data?.players?.max ?? 20,
    };
  } catch {
    return { online: false, players: 0, max: 20 };
  }
});

// ==========================================
// IPC HANDLERS: ACTUALIZADOR Y DESINSTALADOR
// ==========================================
ipcMain.handle('updater:checkForUpdates', () => {
  return AppUpdater.checkForUpdates();
});

ipcMain.handle('updater:startDownload', () => {
  return AppUpdater.startDownload();
});

ipcMain.handle('updater:quitAndInstall', () => {
  AppUpdater.quitAndInstall();
});

ipcMain.handle('system:uninstallApp', () => {
  return UninstallerService.uninstall();
});
