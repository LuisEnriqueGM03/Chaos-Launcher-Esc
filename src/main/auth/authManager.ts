import path from 'path';
import crypto from 'crypto';
import { BrowserWindow, session } from 'electron';
import { UserAccount } from './authTypes';
import { store } from '../store/persistentStore';

export class AuthManager {
  /**
   * Genera el UUID v3 estándar que Minecraft usa para cuentas Offline (No Premium).
   * Equivalente a UUID.nameUUIDFromBytes(("OfflinePlayer:" + username).getBytes(StandardCharsets.UTF_8))
   */
  public static generateOfflineUUID(username: string): string {
    const hash = crypto.createHash('md5').update('OfflinePlayer:' + username).digest();
    // Set version to 3 (MD5 based)
    hash[6] = (hash[6] & 0x0f) | 0x30;
    // Set variant to IETF RFC 4122
    hash[8] = (hash[8] & 0x3f) | 0x80;
    
    const hex = hash.toString('hex');
    return `${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20, 32)}`;
  }

  public static async loginOffline(username: string): Promise<UserAccount> {
    const cleanNick = username.trim();
    if (!cleanNick || cleanNick.length < 3 || cleanNick.length > 16) {
      throw new Error('El apodo debe tener entre 3 y 16 caracteres.');
    }

    if (!/^[a-zA-Z0-9_]+$/.test(cleanNick)) {
      throw new Error('El apodo solo puede contener letras, números y guiones bajos (_).');
    }

    const uuid = this.generateOfflineUUID(cleanNick);
    const skinUrl = `https://mc-heads.net/avatar/${encodeURIComponent(cleanNick)}/100`;

    const account: UserAccount = {
      id: `offline_${cleanNick.toLowerCase()}`,
      type: 'offline',
      name: cleanNick,
      uuid: uuid,
      skinUrl: skinUrl,
    };

    store.addOrUpdateAccount(account);
    return account;
  }

  public static async loginMicrosoft(parentWindow?: BrowserWindow): Promise<UserAccount> {
    try {
      const msmc = await import('msmc');
      const auth = new msmc.Auth('login');
      const redirectUri = auth.token.redirect;
      const loginUrl = auth.createLink();

      // Usar partición aislada limpia y User-Agent de Chrome estándar para evitar 'error looking up account'
      const authSession = session.fromPartition('persist:ms_auth_user');
      await authSession.clearStorageData();
      authSession.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
      );

      const authWindow = new BrowserWindow({
        width: 520,
        height: 680,
        parent: parentWindow || undefined,
        modal: false,
        title: 'Iniciar sesión con Microsoft - Chaos Launcher',
        backgroundColor: '#120808',
        icon: path.join(__dirname, '../../../icon.png'),
        autoHideMenuBar: true,
        webPreferences: {
          session: authSession,
          nodeIntegration: false,
          contextIsolation: true,
        },
      });

      let codeResolved = false;

      const code = await new Promise<string>((resolve, reject) => {
        const checkUrl = (urlStr: string) => {
          if (codeResolved || !urlStr) return;
          if (urlStr.startsWith(redirectUri)) {
            try {
              const urlObj = new URL(urlStr);
              const authCode = urlObj.searchParams.get('code');
              if (authCode) {
                codeResolved = true;
                resolve(authCode);
                setTimeout(() => {
                  try { authWindow.destroy(); } catch {}
                }, 50);
              }
            } catch (e) {
              console.error('Error parsing OAuth redirect URL:', e);
            }
          }
        };

        // Interceptar navegación y redirecciones antes de que se queden en pantalla en blanco
        authWindow.webContents.on('will-navigate', (_, url) => checkUrl(url));
        authWindow.webContents.on('will-redirect', (_, url) => checkUrl(url));
        authWindow.webContents.on('did-navigate', (_, url) => checkUrl(url));
        authWindow.webContents.on('did-finish-load', () => checkUrl(authWindow.webContents.getURL()));

        authWindow.on('closed', () => {
          if (!codeResolved) {
            reject(new Error('cancel'));
          }
        });

        authWindow.loadURL(loginUrl).catch((err) => {
          if (!codeResolved) {
            reject(err);
          }
        });
      });

      const xbox = await auth.login(code);
      const mc = await xbox.getMinecraft();
      const mclcAuth = mc.mclc();
      const profile = mc.profile;

      if (!profile) {
        throw new Error('No se pudo obtener el perfil de Minecraft de la cuenta.');
      }

      const account: UserAccount = {
        id: `ms_${profile.id}`,
        type: 'microsoft',
        name: profile.name,
        uuid: profile.id,
        skinUrl: `https://mc-heads.net/avatar/${encodeURIComponent(profile.name)}/100`,
        accessToken: mclcAuth.access_token,
      };

      store.addOrUpdateAccount(account);
      return account;
    } catch (err: any) {
      if (err === 'error.gui.closed' || err?.message === 'cancel' || err?.message?.includes('closed')) {
        const cancelErr = new Error('Inicio de sesión cancelado.');
        (cancelErr as any).isCancelled = true;
        throw cancelErr;
      }
      console.error('Error al iniciar sesión con Microsoft:', err);
      throw new Error(err.message || 'Fallo al autenticar con Microsoft.');
    }
  }

  public static logout(): void {
    store.logout();
  }

  public static switchAccount(accountId: string): UserAccount | null {
    const config = store.getConfig();
    const account = config.accounts.find(a => a.id === accountId);
    if (account) {
      store.setConfig({ activeAccountId: accountId });
      return account;
    }
    return null;
  }

  public static deleteAccount(accountId: string): void {
    store.removeAccount(accountId);
  }

  public static getActiveAccount(): UserAccount | null {
    return store.getActiveAccount();
  }

  public static getAllAccounts(): UserAccount[] {
    return store.getConfig().accounts;
  }
}
