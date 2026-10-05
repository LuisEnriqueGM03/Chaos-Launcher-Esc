import fs from 'fs';
import path from 'path';
import os from 'os';
import axios from 'axios';
import { BrowserWindow, dialog } from 'electron';
import { UserAccount } from './authTypes';
import { AuthManager } from './authManager';

export type SkinVariant = 'classic' | 'slim';

export interface SkinInfo {
  /** PNG como data URL (null si no hay skin personalizada). */
  dataUrl: string | null;
  variant: SkinVariant;
  /** Se puede cambiar la skin con la sesión actual. */
  canEdit: boolean;
  /** Dónde se aplica el cambio. */
  mode: 'mojang' | 'local';
  /** Mensaje informativo (sesión expirada, etc.). */
  notice?: string;
}

const MC_API = 'https://api.minecraftservices.com/minecraft/profile';
const MAX_SKIN_BYTES = 1024 * 1024;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const skinsDir = path.join(
  process.env.APPDATA || (process.platform === 'darwin' ? path.join(os.homedir(), 'Library', 'Application Support') : os.homedir()),
  '.chaoslauncher',
  'skins'
);

function localPaths(uuid: string) {
  const safe = uuid.replace(/[^a-zA-Z0-9-]/g, '');
  return { png: path.join(skinsDir, `${safe}.png`), meta: path.join(skinsDir, `${safe}.json`) };
}

function toDataUrl(buf: Buffer): string {
  return `data:image/png;base64,${buf.toString('base64')}`;
}

/** Valida firma PNG y dimensiones (Minecraft acepta 64x64 y 64x32). */
function validateSkinPng(buf: Buffer): void {
  if (buf.length > MAX_SKIN_BYTES) throw new Error('La imagen es demasiado grande.');
  if (buf.length < 24 || !buf.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error('El archivo no es un PNG válido.');
  }
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  if (width !== 64 || (height !== 64 && height !== 32)) {
    throw new Error(`La skin debe medir 64x64 px (la imagen mide ${width}x${height}).`);
  }
}

function parseDataUrl(dataUrl: string): Buffer {
  const match = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl || '');
  if (!match) throw new Error('Imagen de skin inválida.');
  return Buffer.from(match[1], 'base64');
}

async function downloadPng(url: string): Promise<Buffer> {
  const res = await axios.get<ArrayBuffer>(url, { responseType: 'arraybuffer', timeout: 10000 });
  return Buffer.from(res.data);
}

async function fetchDefaultSkin(name: string): Promise<string | null> {
  try {
    return toDataUrl(await downloadPng(`https://mc-heads.net/skin/${encodeURIComponent(name)}`));
  } catch {
    return null;
  }
}

/** Skin pública de un jugador premium (no requiere token). */
async function fetchPublicMojangSkin(uuid: string): Promise<{ dataUrl: string; variant: SkinVariant } | null> {
  try {
    const res = await axios.get(
      `https://sessionserver.mojang.com/session/minecraft/profile/${uuid.replace(/-/g, '')}`,
      { timeout: 10000 }
    );
    const prop = res.data?.properties?.find((p: any) => p.name === 'textures');
    if (!prop) return null;
    const textures = JSON.parse(Buffer.from(prop.value, 'base64').toString('utf8'));
    const skin = textures?.textures?.SKIN;
    if (!skin?.url || !/^https:\/\/textures\.minecraft\.net\//.test(skin.url)) return null;
    return {
      dataUrl: toDataUrl(await downloadPng(skin.url)),
      variant: skin.metadata?.model === 'slim' ? 'slim' : 'classic',
    };
  } catch {
    return null;
  }
}

export class SkinManager {
  /** Ejecuta la petición con el token actual; si Mojang responde 401/403 renueva la sesión una vez y reintenta. */
  private static async withRefresh<T>(account: UserAccount, fn: (token?: string) => Promise<T>): Promise<T> {
    try {
      return await fn(account.accessToken);
    } catch (err: any) {
      const status = err?.status ?? err?.response?.status;
      if ((status === 401 || status === 403) && account.refreshToken) {
        const updated = await AuthManager.refreshMicrosoft(account);
        return fn(updated.accessToken);
      }
      throw err;
    }
  }

  public static async getSkin(account: UserAccount): Promise<SkinInfo> {
    if (account.type === 'offline') {
      const { png, meta } = localPaths(account.uuid);
      let variant: SkinVariant = 'classic';
      try {
        if (fs.existsSync(meta)) {
          variant = JSON.parse(fs.readFileSync(meta, 'utf8')).variant === 'slim' ? 'slim' : 'classic';
        }
      } catch {}
      const dataUrl = fs.existsSync(png) ? toDataUrl(fs.readFileSync(png)) : await fetchDefaultSkin('Steve');
      return {
        dataUrl,
        variant,
        canEdit: true,
        mode: 'local',
        notice:
          'Cuenta no premium: la skin se guarda en el launcher. Minecraft solo la mostrará si el servidor o el modpack carga skins de cuentas offline.',
      };
    }

    // Premium: perfil con token; si falla, skin pública sin token.
    try {
      const res = await this.withRefresh(account, (token) =>
        axios.get(MC_API, { headers: { Authorization: `Bearer ${token}` }, timeout: 10000 })
      );
      const active = res.data?.skins?.find((s: any) => s.state === 'ACTIVE') || res.data?.skins?.[0];
      let dataUrl: string | null = null;
      if (active?.url && /^https:\/\/textures\.minecraft\.net\//.test(active.url)) {
        dataUrl = toDataUrl(await downloadPng(active.url));
      }
      return {
        dataUrl: dataUrl || (await fetchDefaultSkin(account.name)),
        variant: active?.variant === 'SLIM' ? 'slim' : 'classic',
        canEdit: true,
        mode: 'mojang',
      };
    } catch (err: any) {
      const pub = await fetchPublicMojangSkin(account.uuid);
      const expired =
        err?.response?.status === 401 ||
        err?.response?.status === 403 ||
        !account.accessToken ||
        /sesión de Microsoft expiró/.test(err?.message || '');
      return {
        dataUrl: pub?.dataUrl || (await fetchDefaultSkin(account.name)),
        variant: pub?.variant || 'classic',
        canEdit: false,
        mode: 'mojang',
        notice: expired
          ? 'Tu sesión de Microsoft expiró. Cierra sesión y vuelve a iniciar con Microsoft para cambiar la skin.'
          : 'No se pudo conectar con Mojang para cambiar la skin. Inténtalo de nuevo más tarde.',
      };
    }
  }

  /** Abre el selector de archivos y devuelve el PNG validado como data URL (o null si se cancela). */
  public static async pickSkinFile(parent?: BrowserWindow | null): Promise<string | null> {
    const options = {
      title: 'Elegir skin (PNG 64x64)',
      properties: ['openFile' as const],
      filters: [{ name: 'Imagen PNG', extensions: ['png'] }],
    };
    const result = parent ? await dialog.showOpenDialog(parent, options) : await dialog.showOpenDialog(options);
    if (result.canceled || !result.filePaths[0]) return null;
    const buf = fs.readFileSync(result.filePaths[0]);
    validateSkinPng(buf);
    return toDataUrl(buf);
  }

  public static async applySkin(account: UserAccount, dataUrl: string, variant: SkinVariant): Promise<void> {
    const buf = parseDataUrl(dataUrl);
    validateSkinPng(buf);
    const model: SkinVariant = variant === 'slim' ? 'slim' : 'classic';

    if (account.type === 'offline') {
      fs.mkdirSync(skinsDir, { recursive: true });
      const { png, meta } = localPaths(account.uuid);
      fs.writeFileSync(png, buf);
      fs.writeFileSync(meta, JSON.stringify({ variant: model }));
      return;
    }

    const res = await this.withRefresh(account, async (token) => {
      const form = new FormData();
      form.append('variant', model);
      form.append('file', new Blob([new Uint8Array(buf)], { type: 'image/png' }), 'skin.png');
      const r = await fetch(`${MC_API}/skins`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      if (r.status === 401 || r.status === 403) throw Object.assign(new Error('unauthorized'), { status: r.status });
      return r;
    }).catch((err: any) => {
      if (err?.status === 401 || err?.status === 403) {
        throw new Error('Tu sesión de Microsoft expiró. Cierra sesión y vuelve a iniciar con Microsoft.');
      }
      throw err;
    });
    if (res.status === 401 || res.status === 403) {
      throw new Error('Tu sesión de Microsoft expiró. Cierra sesión y vuelve a iniciar con Microsoft.');
    }
    if (res.status === 429) {
      throw new Error('Mojang limita los cambios de skin. Espera unos minutos e inténtalo de nuevo.');
    }
    if (!res.ok) {
      throw new Error(`Mojang rechazó la skin (código ${res.status}).`);
    }
  }
}
