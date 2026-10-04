import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import os from 'os';
import axios from 'axios';
import { AuthManager } from './auth/authManager';
import { store } from './store/persistentStore';
import { UpdateChecker } from './modpack/updateChecker';
import { PackDownloader } from './modpack/packDownloader';
import { DifferentialSync } from './modpack/differentialSync';
import { gameLauncher } from './launcher/gameLauncher';
import { JavaDetector } from './launcher/javaDetector';
import { AppUpdater } from './updater/appUpdater';
import { UninstallerService } from './system/uninstaller';
import { formatFriendlyError } from './utils/errorFormatter';

let mainWindow: BrowserWindow | null = null;

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
      sandbox: false,
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
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Inicializar el actualizador automático ligado a GitHub Releases
  AppUpdater.init(mainWindow);
  mainWindow.webContents.once('did-finish-load', () => {
    AppUpdater.checkForUpdates();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
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
ipcMain.handle('auth:getState', () => {
  return {
    activeAccount: AuthManager.getActiveAccount(),
    accounts: AuthManager.getAllAccounts(),
  };
});

ipcMain.handle('auth:loginOffline', async (_, username: string) => {
  const account = await AuthManager.loginOffline(username);
  return {
    activeAccount: account,
    accounts: AuthManager.getAllAccounts(),
  };
});

ipcMain.handle('auth:loginMicrosoft', async () => {
  if (!mainWindow) throw new Error('Ventana no disponible.');
  const account = await AuthManager.loginMicrosoft(mainWindow);
  return {
    activeAccount: account,
    accounts: AuthManager.getAllAccounts(),
  };
});

ipcMain.handle('auth:logout', () => {
  AuthManager.logout();
  return {
    activeAccount: null,
    accounts: AuthManager.getAllAccounts(),
  };
});

ipcMain.handle('auth:switchAccount', (_, accountId: string) => {
  const account = AuthManager.switchAccount(accountId);
  return {
    activeAccount: account,
    accounts: AuthManager.getAllAccounts(),
  };
});

ipcMain.handle('auth:deleteAccount', (_, accountId: string) => {
  AuthManager.deleteAccount(accountId);
  return {
    activeAccount: AuthManager.getActiveAccount(),
    accounts: AuthManager.getAllAccounts(),
  };
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
  return await UpdateChecker.checkUpdate(tag);
});

ipcMain.handle('modpack:downloadUpdate', async (_, tag?: string) => {
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
  return store.toggleOptionalMod(modFileName, enabled);
});

ipcMain.handle('modpack:deleteModpack', async (_, tag?: string) => {
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
ipcMain.handle('config:get', () => {
  return store.getConfig();
});

ipcMain.handle('config:update', (_, partial) => {
  return store.setConfig(partial);
});

ipcMain.handle('system:getJavaList', () => {
  return JavaDetector.detectJavaInstallations();
});

ipcMain.handle('system:getSystemMemory', () => {
  const totalBytes = os.totalmem();
  return Math.round(totalBytes / (1024 * 1024));
});

ipcMain.handle('system:openFolder', (_, folderPath: string) => {
  shell.openPath(folderPath);
});

ipcMain.handle('system:getServerStatus', async (_, host: string) => {
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
    const res = await axios.get(`https://api.mcsrvstat.us/3/${host}`, { timeout: 4000 });
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
