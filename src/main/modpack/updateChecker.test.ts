import { describe, it, expect, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

vi.mock('electron', () => ({
  safeStorage: { isEncryptionAvailable: () => false },
}));

const file = (p: string) => ({ path: p, sha1: 'a'.repeat(40), size: 1 });

const manifestFor = (tag: string, version: string, mods: string[]) => ({
  tag,
  name: tag,
  version,
  minecraftVersion: '1.20.1',
  loader: { type: 'fabric', version: '0.19.3' },
  changelog: [],
  forceUpdate: true,
  files: [...mods.map((m) => file(`mods/${m}`)), ...Array.from({ length: 6 }, (_, i) => file(`config/c${i}.toml`))],
});

/** Config temporal con un modpack instalado (mods + config en disco) y su manifiesto guardado. */
async function setup(opts: { installed?: boolean; installedVersion?: string; remoteVersion?: string; diskMods?: string[] }) {
  const appData = fs.mkdtempSync(path.join(os.tmpdir(), 'chaos-upd-'));
  const baseDir = path.join(appData, '.chaoslauncher');
  const gameDir = path.join(baseDir, 'game');
  const tag = 'mimic-pm';
  const mods = ['a.jar', 'b.jar'];

  if (opts.installed !== false) {
    const dir = path.join(gameDir, tag);
    fs.mkdirSync(path.join(dir, 'mods'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'config'), { recursive: true });
    for (const m of opts.diskMods || mods) fs.writeFileSync(path.join(dir, 'mods', m), 'x');
    for (let i = 0; i < 6; i++) fs.writeFileSync(path.join(dir, 'config', `c${i}.toml`), 'x');
  }

  fs.mkdirSync(baseDir, { recursive: true });
  fs.writeFileSync(
    path.join(baseDir, 'config.json'),
    JSON.stringify({
      gameDir,
      activeModpackTag: tag,
      installedModpackVersions: opts.installed === false ? {} : { [tag]: opts.installedVersion || '4.1.2' },
      cachedManifests: { [tag]: manifestFor(tag, opts.remoteVersion || '4.1.2', mods) },
      cachedModpacks: [{ tag, name: tag }],
    })
  );
  process.env.APPDATA = appData;
  vi.resetModules();
  const { UpdateChecker } = await import('./updateChecker');
  return { UpdateChecker, tag };
}

describe('UpdateChecker.checkUpdateCached (comprobación instantánea, sin red)', () => {
  it('modpack instalado y al día: no hay actualización (el botón debe ser Jugar)', async () => {
    const { UpdateChecker, tag } = await setup({});
    const res = UpdateChecker.checkUpdateCached(tag);
    expect(res.isUpdateAvailable).toBe(false);
    expect(res.currentVersion).toBe('4.1.2');
  });

  it('no usa la red', async () => {
    const { UpdateChecker, tag } = await setup({});
    const spy = vi.spyOn(UpdateChecker as any, 'getWithFallback');
    UpdateChecker.checkUpdateCached(tag);
    expect(spy).not.toHaveBeenCalled();
  });

  it('sin instalar: hay que descargar', async () => {
    const { UpdateChecker, tag } = await setup({ installed: false });
    const res = UpdateChecker.checkUpdateCached(tag);
    expect(res.isUpdateAvailable).toBe(true);
    expect(res.currentVersion).toBeNull();
  });

  it('versión instalada distinta de la del manifiesto: actualización obligatoria', async () => {
    const { UpdateChecker, tag } = await setup({ installedVersion: '4.1.1', remoteVersion: '4.1.2' });
    const res = UpdateChecker.checkUpdateCached(tag);
    expect(res.isUpdateAvailable).toBe(true);
    expect(res.isMandatory).toBe(true);
  });

  it('falta un mod del manifiesto en disco: hay que actualizar', async () => {
    const { UpdateChecker, tag } = await setup({ diskMods: ['a.jar'] });
    expect(UpdateChecker.checkUpdateCached(tag).isUpdateAvailable).toBe(true);
  });

  it('sobra un mod que no es del modpack: hay que actualizar', async () => {
    const { UpdateChecker, tag } = await setup({ diskMods: ['a.jar', 'b.jar', 'extra.jar'] });
    expect(UpdateChecker.checkUpdateCached(tag).isUpdateAvailable).toBe(true);
  });

  it('el manifiesto devuelto lleva el tag pedido', async () => {
    const { UpdateChecker, tag } = await setup({});
    expect(UpdateChecker.checkUpdateCached(tag).manifest?.tag).toBe(tag);
  });
});
