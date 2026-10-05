import { describe, it, expect } from 'vitest';
import { resolveServerAddress, buildQuickPlay } from './serverAddress';

describe('resolveServerAddress', () => {
  it('usa la IP y el puerto del manifiesto del backend', () => {
    expect(resolveServerAddress({ ip: 'mimicsv.glemtrod.com', port: 25570 })).toEqual({ host: 'mimicsv.glemtrod.com', port: 25570 });
  });

  it('si el manifiesto no trae servidor usa el de la ficha del modpack', () => {
    expect(resolveServerAddress(undefined, { serverIp: 'mimicsv.glemtrod.com', serverPort: 25565 })).toEqual({
      host: 'mimicsv.glemtrod.com',
      port: 25565,
    });
  });

  it('puerto por defecto 25565 si falta o es inválido', () => {
    expect(resolveServerAddress({ ip: 'a.example.com' })?.port).toBe(25565);
    expect(resolveServerAddress({ ip: 'a.example.com', port: 99999 })?.port).toBe(25565);
  });

  it('acepta "host:puerto" en el campo de la IP', () => {
    expect(resolveServerAddress({ ip: 'a.example.com:25570' })).toEqual({ host: 'a.example.com', port: 25570 });
  });

  it('sin servidor o con un valor peligroso devuelve null (llega de la red y acaba en argumentos del juego)', () => {
    expect(resolveServerAddress(null, null)).toBeNull();
    expect(resolveServerAddress({ ip: '' })).toBeNull();
    expect(resolveServerAddress({ ip: 'a.com --username admin' })).toBeNull();
    expect(resolveServerAddress({ ip: '-Dx=1' })).toBeNull();
  });
});

describe('buildQuickPlay', () => {
  const addr = { host: 'mimicsv.glemtrod.com', port: 25565 };

  it('desde la 1.20 usa Quick Play multijugador', () => {
    expect(buildQuickPlay('1.20.1', addr)).toEqual({ type: 'multiplayer', identifier: 'mimicsv.glemtrod.com:25565' });
    expect(buildQuickPlay('1.21.1', addr).type).toBe('multiplayer');
  });

  it('antes de la 1.20 usa los argumentos --server/--port', () => {
    expect(buildQuickPlay('1.19.4', addr).type).toBe('legacy');
    expect(buildQuickPlay('1.12.2', addr).type).toBe('legacy');
  });
});
