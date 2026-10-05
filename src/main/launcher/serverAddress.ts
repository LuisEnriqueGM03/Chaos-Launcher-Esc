const HOST_RE = /^[A-Za-z0-9]([A-Za-z0-9.-]{0,251}[A-Za-z0-9])?$/;

export interface ServerAddress {
  host: string;
  port: number;
}

export interface QuickPlayOption {
  type: 'multiplayer' | 'legacy';
  identifier: string;
}

/**
 * Dirección del servidor del modpack tal como la define el backend (manifiesto o ficha del modpack).
 * Devuelve null si falta o no es válida: el valor llega de la red y acaba en los argumentos del juego.
 */
export function resolveServerAddress(
  manifestServer?: { ip?: string; port?: number } | null,
  modpack?: { serverIp?: string; serverPort?: number } | null,
): ServerAddress | null {
  let host = (manifestServer?.ip || modpack?.serverIp || '').trim();
  let port = Number(manifestServer?.ip ? manifestServer?.port : modpack?.serverPort);

  // "host:puerto" escrito en el campo de la IP
  const embedded = /^([^:]+):(\d{1,5})$/.exec(host);
  if (embedded) {
    host = embedded[1];
    if (!Number.isInteger(port) || port <= 0) port = Number(embedded[2]);
  }

  if (!host || !HOST_RE.test(host)) return null;
  if (!Number.isInteger(port) || port < 1 || port > 65535) port = 25565;
  return { host, port };
}

/**
 * Argumentos de "entrar directo al servidor". Desde Minecraft 1.20 existe Quick Play; antes se usa --server/--port.
 */
export function buildQuickPlay(minecraftVersion: string, address: ServerAddress): QuickPlayOption {
  const minor = parseInt((minecraftVersion || '').split('.')[1] || '0', 10);
  return {
    type: minor >= 20 ? 'multiplayer' : 'legacy',
    identifier: `${address.host}:${address.port}`,
  };
}
