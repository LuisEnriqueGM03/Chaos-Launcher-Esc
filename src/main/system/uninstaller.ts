import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';

export class UninstallerService {
  /**
   * Ejecuta el desinstalador nativo en producción o purga los datos en modo desarrollo.
   */
  public static async uninstall(): Promise<{ success: boolean; message?: string }> {
    console.log('[UninstallerService] Iniciando proceso de desinstalación...');

    const appData = process.env.APPDATA || '';
    const localAppData = process.env.LOCALAPPDATA || '';
    const chaosDataDir = path.join(appData, '.chaoslauncher');
    const electronUserDataDir = path.join(appData, 'chaos-launcher');
    const updaterCacheDir = path.join(localAppData, 'chaos-launcher-updater');

    if (app.isPackaged) {
      // 1. Buscar el desinstalador NSIS generado por electron-builder
      const candidates = [
        path.join(path.dirname(process.execPath), 'Uninstall Chaos Launcher.exe'),
        path.join(path.dirname(process.execPath), 'Uninstall.exe'),
        path.join(localAppData, 'Programs', 'Chaos Launcher', 'Uninstall Chaos Launcher.exe'),
        path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Chaos Launcher', 'Uninstall Chaos Launcher.exe'),
      ];

      let uninstallerPath: string | null = null;
      for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
          uninstallerPath = candidate;
          break;
        }
      }

      if (uninstallerPath) {
        console.log(`[UninstallerService] Desinstalador encontrado en: ${uninstallerPath}`);
        try {
          // Lanzar el desinstalador desacoplado para que pueda eliminar los archivos del launcher
          const child = spawn(uninstallerPath, [], {
            detached: true,
            stdio: 'ignore',
          });
          child.unref();

          // Cerrar la app para liberar bloqueos de archivos en disco
          setTimeout(() => {
            app.quit();
          }, 300);

          return { success: true };
        } catch (err: any) {
          console.error('[UninstallerService] Error al lanzar desinstalador:', err);
          return { success: false, message: err.message };
        }
      } else {
        console.warn('[UninstallerService] No se encontró el ejecutable del desinstalador. Realizando purga manual.');
      }
    }

    // Modo desarrollo o fallback si no hay uninstaller.exe
    try {
      if (fs.existsSync(chaosDataDir)) {
        fs.rmSync(chaosDataDir, { recursive: true, force: true });
        console.log(`[UninstallerService] Eliminado: ${chaosDataDir}`);
      }
      if (fs.existsSync(electronUserDataDir)) {
        fs.rmSync(electronUserDataDir, { recursive: true, force: true });
        console.log(`[UninstallerService] Eliminado: ${electronUserDataDir}`);
      }
      if (fs.existsSync(updaterCacheDir)) {
        fs.rmSync(updaterCacheDir, { recursive: true, force: true });
        console.log(`[UninstallerService] Eliminado: ${updaterCacheDir}`);
      }

      return {
        success: true,
        message: 'Todos los datos de Chaos Launcher (%APPDATA%\\.chaoslauncher) han sido eliminados correctamente.',
      };
    } catch (err: any) {
      console.error('[UninstallerService] Error durante la purga de datos:', err);
      return { success: false, message: err.message };
    }
  }
}
