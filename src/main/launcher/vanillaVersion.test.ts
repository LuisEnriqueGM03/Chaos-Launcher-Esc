import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

const get = vi.fn();
vi.mock('axios', () => ({ default: { get: (...a: unknown[]) => get(...a) } }));

import { ensureVanillaVersionJson } from './vanillaVersion';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'chaos-vanilla-'));
const versionFile = (root: string, v: string) => path.join(root, 'versions', v, `${v}.json`);

describe('ensureVanillaVersionJson', () => {
  beforeEach(() => {
    get.mockReset();
    vi.useRealTimers();
  });

  it('si el JSON ya existe no hace ninguna petición', async () => {
    const root = tmp();
    fs.mkdirSync(path.dirname(versionFile(root, '1.20.1')), { recursive: true });
    fs.writeFileSync(versionFile(root, '1.20.1'), '{}');
    await ensureVanillaVersionJson(root, '1.20.1');
    expect(get).not.toHaveBeenCalled();
  });

  it('reutiliza la copia de la carpeta compartida sin usar la red', async () => {
    const root = tmp();
    const shared = tmp();
    fs.mkdirSync(path.dirname(versionFile(shared, '1.20.1')), { recursive: true });
    fs.writeFileSync(versionFile(shared, '1.20.1'), '{"id":"1.20.1"}');
    await ensureVanillaVersionJson(root, '1.20.1', shared);
    expect(JSON.parse(fs.readFileSync(versionFile(root, '1.20.1'), 'utf8')).id).toBe('1.20.1');
    expect(get).not.toHaveBeenCalled();
  });

  it('lo descarga de Mojang y lo guarda en la carpeta del modpack', async () => {
    const root = tmp();
    get.mockImplementation(async (url: string) => {
      if (url.endsWith('version_manifest.json')) {
        return { data: { versions: [{ id: '1.20.1', url: 'https://piston-meta.mojang.com/v1/packages/x/1.20.1.json' }] } };
      }
      return { data: { id: '1.20.1', downloads: {} } };
    });
    await ensureVanillaVersionJson(root, '1.20.1');
    expect(JSON.parse(fs.readFileSync(versionFile(root, '1.20.1'), 'utf8')).id).toBe('1.20.1');
  });

  it('reintenta ante un fallo de red puntual (AggregateError) y termina bien', async () => {
    const root = tmp();
    vi.useFakeTimers();
    let first = true;
    get.mockImplementation(async (url: string) => {
      if (first) {
        first = false;
        throw new AggregateError([new Error('ECONNRESET')]);
      }
      if (url.endsWith('version_manifest.json')) {
        return { data: { versions: [{ id: '1.20.1', url: 'https://piston-meta.mojang.com/v1/packages/x/1.20.1.json' }] } };
      }
      return { data: { id: '1.20.1' } };
    });
    const promise = ensureVanillaVersionJson(root, '1.20.1');
    await vi.runAllTimersAsync();
    await promise;
    expect(fs.existsSync(versionFile(root, '1.20.1'))).toBe(true);
  });

  it('si la red falla siempre lanza un error normal y legible (no una excepción sin capturar)', async () => {
    const root = tmp();
    vi.useFakeTimers();
    get.mockRejectedValue(new AggregateError([new Error('ETIMEDOUT')]));
    const promise = ensureVanillaVersionJson(root, '1.20.1');
    const assertion = expect(promise).rejects.toThrow(/conexión a internet/);
    await vi.runAllTimersAsync();
    await assertion;
    expect(fs.existsSync(versionFile(root, '1.20.1'))).toBe(false);
  });

  it('una versión inexistente da un mensaje claro', async () => {
    const root = tmp();
    get.mockResolvedValue({ data: { versions: [{ id: '1.21', url: 'u' }] } });
    await expect(ensureVanillaVersionJson(root, '9.9.9')).rejects.toThrow(/no existe en el manifiesto/);
  });
});
