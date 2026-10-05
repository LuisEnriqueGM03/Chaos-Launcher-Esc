import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

const get = vi.fn();
vi.mock('axios', () => ({ default: { get: (...a: unknown[]) => get(...a) } }));

import { ensureFabricProfile, fabricVersionId } from './fabricProfile';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'chaos-fabric-'));
const profileFile = (root: string, id: string) => path.join(root, 'versions', id, `${id}.json`);
const profile = (id: string) => ({ id, mainClass: 'net.fabricmc.loader.impl.launch.knot.KnotClient', libraries: [{ name: 'a:b:1' }] });

describe('ensureFabricProfile', () => {
  beforeEach(() => {
    get.mockReset();
    vi.useRealTimers();
  });

  it('el id coincide con el que usa Fabric y MCLC', () => {
    expect(fabricVersionId('1.20.1', '0.19.3')).toBe('fabric-loader-0.19.3-1.20.1');
  });

  it('descarga el perfil de Fabric y lo guarda donde MCLC lo busca', async () => {
    const root = tmp();
    get.mockResolvedValue({ data: profile('fabric-loader-0.19.3-1.20.1') });
    const id = await ensureFabricProfile(root, '1.20.1', '0.19.3');
    expect(id).toBe('fabric-loader-0.19.3-1.20.1');
    expect(get.mock.calls[0][0]).toBe('https://meta.fabricmc.net/v2/versions/loader/1.20.1/0.19.3/profile/json');
    const saved = JSON.parse(fs.readFileSync(profileFile(root, id), 'utf8'));
    expect(saved.mainClass).toContain('KnotClient');
  });

  it('si ya está instalado no usa la red', async () => {
    const root = tmp();
    const id = 'fabric-loader-0.19.3-1.20.1';
    fs.mkdirSync(path.dirname(profileFile(root, id)), { recursive: true });
    fs.writeFileSync(profileFile(root, id), JSON.stringify(profile(id)));
    await ensureFabricProfile(root, '1.20.1', '0.19.3');
    expect(get).not.toHaveBeenCalled();
  });

  it('un JSON corrupto se vuelve a descargar', async () => {
    const root = tmp();
    const id = 'fabric-loader-0.19.3-1.20.1';
    fs.mkdirSync(path.dirname(profileFile(root, id)), { recursive: true });
    fs.writeFileSync(profileFile(root, id), '{ roto');
    get.mockResolvedValue({ data: profile(id) });
    await ensureFabricProfile(root, '1.20.1', '0.19.3');
    expect(JSON.parse(fs.readFileSync(profileFile(root, id), 'utf8')).id).toBe(id);
  });

  it('rechaza versiones con caracteres de ruta (vienen del backend)', async () => {
    await expect(ensureFabricProfile(tmp(), '1.20.1', '../../x')).rejects.toThrow(/inválida/);
    expect(get).not.toHaveBeenCalled();
  });

  it('sin red lanza un error legible tras reintentar', async () => {
    vi.useFakeTimers();
    get.mockRejectedValue(new AggregateError([new Error('ECONNRESET')]));
    const assertion = expect(ensureFabricProfile(tmp(), '1.20.1', '0.19.3')).rejects.toThrow(/conexión a internet/);
    await vi.runAllTimersAsync();
    await assertion;
  });

  it('una respuesta que no es el perfil esperado se rechaza', async () => {
    get.mockResolvedValue({ data: { id: 'otro', mainClass: 'x', libraries: [] } });
    await expect(ensureFabricProfile(tmp(), '1.20.1', '0.19.3')).rejects.toThrow(/no está disponible/);
  });
});
