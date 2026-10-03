import { app, BrowserWindow } from 'electron';
import { autoUpdater, UpdateInfo, ProgressInfo } from 'electron-updater';
import axios from 'axios';

export interface AppUpdateData {
  version: string;
  releaseDate?: string;
  releaseNotes?: string | null;
  mandatory?: boolean;
}

export interface AppProgressData {
  percent: number;
  bytesPerSecond: number;
  transferred: number;
  total: number;
}

export class AppUpdater {
  private static mainWindow: BrowserWindow | null = null;
  private static isChecking = false;
  private static isDownloading = false;
  private static GITHUB_OWNER = 'LuisEnriqueGM03';
  private static GITHUB_REPO = 'Chaos-Launcher-Esc';

  public static init(window: BrowserWindow): void {
    this.mainWindow = window;

    // Configuración base de electron-updater
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.logger = console;

    // Configuración de GitHub explícita por si no carga package.json
    autoUpdater.setFeedURL({
      provider: 'github',
      owner: this.GITHUB_OWNER,
      repo: this.GITHUB_REPO,
    });

    // Eventos de autoUpdater
    autoUpdater.on('checking-for-update', () => {
      console.log('[AppUpdater] Buscando actualizaciones en GitHub...');
      this.sendToRenderer('updater:checking');
    });

    autoUpdater.on('update-available', (info: UpdateInfo) => {
      console.log(`[AppUpdater] ¡Actualización disponible! Versión: ${info.version}`);
      this.isChecking = false;

      let notes = '';
      if (Array.isArray(info.releaseNotes)) {
        notes = info.releaseNotes.map((n) => (typeof n === 'string' ? n : n.note)).join('\n');
      } else if (typeof info.releaseNotes === 'string') {
        notes = info.releaseNotes;
      }

      const updateData: AppUpdateData = {
        version: info.version,
        releaseDate: info.releaseDate,
        releaseNotes: notes,
        mandatory: true,
      };

      this.sendToRenderer('updater:updateAvailable', updateData);
    });

    autoUpdater.on('update-not-available', (info: UpdateInfo) => {
      console.log(`[AppUpdater] El launcher está al día (Versión actual: ${info.version}).`);
      this.isChecking = false;
      this.sendToRenderer('updater:updateNotAvailable', { version: info.version });
    });

    autoUpdater.on('download-progress', (progress: ProgressInfo) => {
      const data: AppProgressData = {
        percent: Math.round(progress.percent * 10) / 10,
        bytesPerSecond: progress.bytesPerSecond,
        transferred: progress.transferred,
        total: progress.total,
      };
      this.sendToRenderer('updater:downloadProgress', data);
    });

    autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
      console.log(`[AppUpdater] Actualización v${info.version} descargada correctamente.`);
      this.isDownloading = false;
      this.sendToRenderer('updater:updateDownloaded', { version: info.version });
    });

    autoUpdater.on('error', (err: Error) => {
      console.warn('[AppUpdater] Error o sin conexión al buscar actualizaciones:', err.message);
      this.isChecking = false;
      this.isDownloading = false;
      this.sendToRenderer('updater:error', err.message);
    });
  }

  /**
   * Comprueba si hay una nueva versión disponible.
   * En desarrollo, consulta la API de GitHub directamente para permitir pruebas sin empaquetar.
   */
  public static async checkForUpdates(): Promise<void> {
    if (this.isChecking || this.isDownloading) return;
    this.isChecking = true;

    if (!app.isPackaged) {
      console.log('[AppUpdater - DEV] Comprobando actualizaciones vía GitHub API...');
      try {
        const url = `https://api.github.com/repos/${this.GITHUB_OWNER}/${this.GITHUB_REPO}/releases/latest`;
        const res = await axios.get(url, {
          timeout: 5000,
          headers: { 'User-Agent': 'Chaos-Launcher-Dev' },
        });

        if (res.data && res.data.tag_name) {
          const remoteVersion = res.data.tag_name.replace(/^v/, '').trim();
          const currentVersion = app.getVersion().trim();

          console.log(`[AppUpdater - DEV] Versión local: ${currentVersion} | Remota en GitHub: ${remoteVersion}`);

          if (this.isNewerVersion(remoteVersion, currentVersion)) {
            const updateData: AppUpdateData = {
              version: remoteVersion,
              releaseDate: res.data.published_at,
              releaseNotes: res.data.body || 'Novedades y optimizaciones de la versión.',
              mandatory: true,
            };
            this.isChecking = false;
            this.sendToRenderer('updater:updateAvailable', updateData);
            return;
          }
        }
      } catch (err: any) {
        console.log('[AppUpdater - DEV] No se pudo consultar GitHub Releases (normal en dev sin releases):', err.message);
      }
      this.isChecking = false;
      this.sendToRenderer('updater:updateNotAvailable', { version: app.getVersion() });
      return;
    }

    try {
      await autoUpdater.checkForUpdates();
    } catch (err: any) {
      console.warn('[AppUpdater] Error al comprobar actualización con autoUpdater:', err.message);
      this.isChecking = false;
    }
  }

  /**
   * Descarga la actualización.
   */
  public static async startDownload(): Promise<void> {
    if (this.isDownloading) return;
    this.isDownloading = true;

    if (!app.isPackaged) {
      // Simulación en modo desarrollo para verificar la UI de descarga
      console.log('[AppUpdater - DEV] Simulando descarga de actualización...');
      let percent = 0;
      const total = 45 * 1024 * 1024;
      const interval = setInterval(() => {
        percent += 5;
        this.sendToRenderer('updater:downloadProgress', {
          percent: Math.min(100, percent),
          bytesPerSecond: 4.5 * 1024 * 1024,
          transferred: (percent / 100) * total,
          total,
        });

        if (percent >= 100) {
          clearInterval(interval);
          this.isDownloading = false;
          this.sendToRenderer('updater:updateDownloaded', { version: '1.0.1' });
        }
      }, 200);
      return;
    }

    try {
      await autoUpdater.downloadUpdate();
    } catch (err: any) {
      console.error('[AppUpdater] Error al descargar actualización:', err);
      this.isDownloading = false;
      this.sendToRenderer('updater:error', err.message);
    }
  }

  /**
   * Aplica la actualización y reinicia el Launcher.
   */
  public static quitAndInstall(): void {
    console.log('[AppUpdater] Reiniciando e instalando nueva versión...');
    if (!app.isPackaged) {
      console.log('[AppUpdater - DEV] En modo desarrollo no se ejecuta quitAndInstall.');
      return;
    }
    autoUpdater.quitAndInstall(false, true);
  }

  private static isNewerVersion(remote: string, current: string): boolean {
    const parse = (v: string) => v.split('.').map((n) => parseInt(n, 10) || 0);
    const [rMajor, rMinor, rPatch] = parse(remote);
    const [cMajor, cMinor, cPatch] = parse(current);

    if (rMajor > cMajor) return true;
    if (rMajor === cMajor && rMinor > cMinor) return true;
    if (rMajor === cMajor && rMinor === cMinor && rPatch > cPatch) return true;
    return false;
  }

  private static sendToRenderer(channel: string, data?: any): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data);
    }
  }
}
