import { Client } from 'minecraft-launcher-core';
import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';
import { store } from '../store/persistentStore';
import { AuthManager } from '../auth/authManager';
import { JavaDetector } from './javaDetector';
import { UpdateChecker } from '../modpack/updateChecker';
import { getModpackGameDir } from '../modpack/modpackPaths';

export class GameLauncher extends EventEmitter {
  private client: any;
  private isRunning: boolean = false;

  constructor() {
    super();
    this.client = new Client();
    this.setupListeners();
  }

  private setupListeners(): void {
    this.client.on('progress', (e: any) => {
      this.emit('progress', e);
    });

    this.client.on('download-status', (e: any) => {
      this.emit('download-status', e);
    });

    this.client.on('data', (e: any) => {
      const line = e.toString();
      this.emit('log', line);
    });

    this.client.on('close', (code: any) => {
      this.isRunning = false;
      this.emit('game-closed', code);
      if (code && code !== 0) {
        this.emit('error', `El juego se cerró de forma inesperada (código de salida: ${code}). Revisa que tu memoria RAM asignada sea suficiente.`);
      }
    });

    this.client.on('error', (err: any) => {
      this.isRunning = false;
      this.emit('error', err);
    });
  }

  public async launch(): Promise<void> {
    if (this.isRunning) {
      throw new Error('El juego ya se encuentra en ejecución.');
    }

    // 1. Verificación obligatoria de actualización de modpack
    const updateCheck = await UpdateChecker.checkUpdate();
    if (updateCheck.isMandatory && updateCheck.isUpdateAvailable) {
      throw new Error(
        `¡Actualización obligatoria detectada (v${updateCheck.remoteVersion})! Debes actualizar el modpack antes de poder iniciar el juego.`
      );
    }

    // 2. Verificación de cuenta activa
    const activeAccount = AuthManager.getActiveAccount();
    if (!activeAccount) {
      throw new Error('No hay ninguna cuenta seleccionada. Inicia sesión primero.');
    }

    const config = store.getConfig();
    const manifest = updateCheck.manifest || UpdateChecker.getDefaultManifest();

    // 3. Preparar credenciales de MCLC
    const authPayload = {
      access_token: activeAccount.accessToken || '0',
      client_token: activeAccount.uuid,
      uuid: activeAccount.uuid,
      name: activeAccount.name,
      user_properties: '{}',
    };

    // 4. Determinar ejecutable de Java
    const javaExecutable = config.javaPath || JavaDetector.getBestJava(21);

    // 5. Configurar opciones del juego y carpeta aislada del modpack
    const targetGameDir = getModpackGameDir(config.gameDir, manifest);
    if (!fs.existsSync(targetGameDir)) {
      fs.mkdirSync(targetGameDir, { recursive: true });
    }

    const launchOptions: any = {
      authorization: authPayload,
      root: config.gameDir,
      javaPath: javaExecutable,
      version: {
        number: manifest.minecraftVersion,
        type: 'release',
      },
      memory: {
        max: `${Math.max(config.allocatedRamMb || 4096, manifest.recommendedRam || 6144)}M`,
        min: '3072M',
      },
      overrides: {
        gameDirectory: targetGameDir,
      },
    };

    // Configuración para NeoForge o Fabric
    if (manifest.loader && manifest.loader.type === 'neoforge') {
      const neoVersion = manifest.loader.version || '21.1.248';
      const customId = `neoforge-${neoVersion}`;
      launchOptions.version.custom = customId;

      const curseforgeInstallDir = 'C:\\Users\\luise\\curseforge\\minecraft\\Install';

      // 1. Asegurar versión vanilla base (1.21.1)
      const targetVanillaDir = path.join(config.gameDir, 'versions', manifest.minecraftVersion);
      const cfVanillaDir = path.join(curseforgeInstallDir, 'versions', manifest.minecraftVersion);
      if (!fs.existsSync(targetVanillaDir) && fs.existsSync(cfVanillaDir)) {
        fs.cpSync(cfVanillaDir, targetVanillaDir, { recursive: true, force: true });
      }

      // 2. Asegurar que la definición de versión existe en .chaoslauncher/game/versions/neoforge-21.1.248/
      const targetVersionDir = path.join(config.gameDir, 'versions', customId);
      const targetJson = path.join(targetVersionDir, `${customId}.json`);
      const targetJar = path.join(targetVersionDir, `${customId}.jar`);

      const curseforgeVersionDir = path.join(curseforgeInstallDir, 'versions', customId);
      const cfJson = path.join(curseforgeVersionDir, `${customId}.json`);
      const cfJar = path.join(curseforgeVersionDir, `${customId}.jar`);

      if (!fs.existsSync(targetJson) && fs.existsSync(cfJson)) {
        if (!fs.existsSync(targetVersionDir)) fs.mkdirSync(targetVersionDir, { recursive: true });
        fs.copyFileSync(cfJson, targetJson);
        if (fs.existsSync(cfJar)) fs.copyFileSync(cfJar, targetJar);
      }

      // 3. Asegurar librerías críticas de NeoForge y client-srg
      const targetNeoDir = path.join(config.gameDir, 'libraries', 'net', 'neoforged');
      const cfNeoDir = path.join(curseforgeInstallDir, 'libraries', 'net', 'neoforged');
      if (fs.existsSync(cfNeoDir) && (!fs.existsSync(targetNeoDir) || !fs.existsSync(path.join(targetNeoDir, 'neoforge', neoVersion)))) {
        fs.cpSync(cfNeoDir, targetNeoDir, { recursive: true, force: true });
      }

      const targetMcClientDir = path.join(config.gameDir, 'libraries', 'net', 'minecraft');
      const cfMcClientDir = path.join(curseforgeInstallDir, 'libraries', 'net', 'minecraft');
      if (fs.existsSync(cfMcClientDir) && !fs.existsSync(targetMcClientDir)) {
        fs.cpSync(cfMcClientDir, targetMcClientDir, { recursive: true, force: true });
      }

      // 4. Cargar y procesar los argumentos JVM específicos de NeoForge
      const customArgs: string[] = [];
      if (fs.existsSync(targetJson)) {
        try {
          const neoData = JSON.parse(fs.readFileSync(targetJson, 'utf8'));
          const jvmArgs: string[] = neoData.arguments?.jvm || [];
          const libDir = path.join(config.gameDir, 'libraries').replace(/\\/g, '/');
          const sep = ';';

          for (const arg of jvmArgs) {
            if (typeof arg === 'string') {
              customArgs.push(
                arg
                  .replace(/\$\{library_directory\}/g, libDir)
                  .replace(/\$\{classpath_separator\}/g, sep)
                  .replace(/\$\{version_name\}/g, customId)
              );
            }
          }
        } catch (err) {
          console.error('Error al parsear argumentos JVM de NeoForge:', err);
        }
      }

      // Compatibilidad obligatoria con Java 21 para bootstraplauncher / modules
      customArgs.push('--add-opens', 'java.base/java.lang.invoke=ALL-UNNAMED');
      customArgs.push('--add-opens', 'java.base/java.util.jar=ALL-UNNAMED');

      launchOptions.customArgs = customArgs;
    } else if (manifest.loader && manifest.loader.type === 'fabric') {
      launchOptions.version.custom = `fabric-loader-${manifest.loader.version || '0.15.11'}-${manifest.minecraftVersion}`;
    }

    this.isRunning = true;
    this.emit('launch-start', {
      account: activeAccount.name,
      version: manifest.minecraftVersion,
      modpack: manifest.name,
    });

    try {
      const mcProcess = await this.client.launch(launchOptions);
      if (mcProcess && typeof mcProcess.unref === 'function') {
        mcProcess.unref();
      }
      this.emit('game-started');
    } catch (err: any) {
      this.isRunning = false;
      console.error('Error al lanzar Minecraft:', err);
      throw new Error(err.message || 'Error al iniciar el proceso de Minecraft.');
    }
  }

  public getIsRunning(): boolean {
    return this.isRunning;
  }
}

export const gameLauncher = new GameLauncher();
