import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

vi.mock('electron', () => ({
  safeStorage: { isEncryptionAvailable: () => false },
}));

const opt = (file: string, defaultEnabled = true) => ({ id: file, name: file, file, description: '', defaultEnabled });

/** Crea un APPDATA temporal (opcionalmente con un config.json previo) y carga un store limpio sobre él. */
async function loadStore(initialConfig?: Record<string, unknown>, setupDisk?: (gameDir: string) => void) {
  const appData = fs.mkdtempSync(path.join(os.tmpdir(), 'chaos-store-'));
  const baseDir = path.join(appData, '.chaoslauncher');
  const gameDir = path.join(baseDir, 'game');
  fs.mkdirSync(baseDir, { recursive: true });
  setupDisk?.(gameDir);
  if (initialConfig) {
    fs.writeFileSync(path.join(baseDir, 'config.json'), JSON.stringify({ gameDir, ...initialConfig }));
  }
  process.env.APPDATA = appData;
  vi.resetModules();
  const { store } = await import('./persistentStore');
  return { store, gameDir, baseDir };
}

function installMods(gameDir: string, tag: string, files: string[]) {
  const mods = path.join(gameDir, tag, 'mods');
  fs.mkdirSync(mods, { recursive: true });
  for (const f of files) fs.writeFileSync(path.join(mods, f), 'x');
  return mods;
}

describe('persistentStore: cada modpack es independiente', () => {
  beforeEach(() => vi.clearAllMocks());

  it('la versión instalada de un modpack no aparece en otro', async () => {
    const { store } = await loadStore();
    store.setInstalledModpackVersion('mimic-mc', '1.0.5');
    expect(store.getInstalledModpackVersion('mimic-mc')).toBe('1.0.5');
    expect(store.getInstalledModpackVersion('mimic-pm')).toBeNull();
  });

  it('instalar un modpack no cambia el modpack activo', async () => {
    const { store } = await loadStore();
    store.setConfig({ activeModpackTag: 'mimic-pm' });
    store.setInstalledModpackVersion('mimic-mc', '1.0.5');
    expect(store.getConfig().activeModpackTag).toBe('mimic-pm');
  });

  it('las preferencias de mods opcionales se guardan por tag y no se pisan', async () => {
    const { store, gameDir } = await loadStore();
    const modsA = installMods(gameDir, 'pack-a', ['shared.jar', 'a-only.jar']);
    const modsB = installMods(gameDir, 'pack-b', ['shared.jar']);

    store.getDisabledOptionalMods([opt('shared.jar')], 'pack-a');
    store.getDisabledOptionalMods([opt('shared.jar')], 'pack-b');
    store.toggleOptionalMod('shared.jar', false, 'pack-a');

    // Solo el pack A tiene el mod desactivado en disco y en preferencias
    expect(fs.existsSync(path.join(modsA, 'shared.jar.disabled'))).toBe(true);
    expect(fs.existsSync(path.join(modsB, 'shared.jar'))).toBe(true);
    expect(fs.existsSync(path.join(modsB, 'shared.jar.disabled'))).toBe(false);

    expect(store.getDisabledOptionalMods([opt('shared.jar')], 'pack-a')).toEqual(['shared.jar']);
    expect(store.getDisabledOptionalMods([opt('shared.jar')], 'pack-b')).toEqual([]);

    // Consultar B no borra lo que A tenía guardado (antes se limpiaba por no estar en la lista de B)
    expect(store.getDisabledOptionalMods([opt('shared.jar')], 'pack-a')).toEqual(['shared.jar']);
  });

  it('borrar un modpack solo elimina su carpeta y su estado', async () => {
    const { store, gameDir } = await loadStore();
    installMods(gameDir, 'pack-a', ['a.jar']);
    installMods(gameDir, 'pack-b', ['b.jar']);
    store.setInstalledModpackVersion('pack-a', '1.0.0');
    store.setInstalledModpackVersion('pack-b', '2.0.0');
    store.getDisabledOptionalMods([opt('b.jar')], 'pack-b');
    store.toggleOptionalMod('b.jar', false, 'pack-b');
    store.setConfig({ activeModpackTag: 'pack-a' });

    expect(store.deleteModpackFromCache('pack-a')).toBe(true);

    expect(fs.existsSync(path.join(gameDir, 'pack-a'))).toBe(false);
    expect(fs.existsSync(path.join(gameDir, 'pack-b', 'mods', 'b.jar.disabled'))).toBe(true);
    expect(store.getInstalledModpackVersion('pack-a')).toBeNull();
    expect(store.getInstalledModpackVersion('pack-b')).toBe('2.0.0');
    expect(store.getDisabledOptionalMods([opt('b.jar')], 'pack-b')).toEqual(['b.jar']);
  });

  it('no toca la carpeta mods compartida antigua (gameDir/mods) al borrar un modpack', async () => {
    const { store, gameDir } = await loadStore();
    const legacy = path.join(gameDir, 'mods');
    fs.mkdirSync(legacy, { recursive: true });
    fs.writeFileSync(path.join(legacy, 'legacy.jar'), 'x');
    installMods(gameDir, 'pack-a', ['a.jar']);
    store.deleteModpackFromCache('pack-a');
    expect(fs.existsSync(path.join(legacy, 'legacy.jar'))).toBe(true);
  });

  it('al cargar, un modpack sin mods en SU carpeta deja de figurar instalado aunque otro sí tenga mods', async () => {
    const { store } = await loadStore(
      {
        activeModpackTag: 'pack-a',
        installedModpackVersions: { 'pack-a': '1.0.0', 'pack-b': '2.0.0' },
      },
      (gameDir) => installMods(gameDir, 'pack-b', ['b.jar'])
    );
    expect(store.getInstalledModpackVersion('pack-a')).toBeNull();
    expect(store.getInstalledModpackVersion('pack-b')).toBe('2.0.0');
  });

  it('migra los valores globales antiguos solo al modpack que estaba activo', async () => {
    const { store } = await loadStore(
      {
        activeModpackTag: 'pack-a',
        installedModpackVersion: '3.0.0',
        installedModpackVersions: {},
        disabledOptionalMods: ['a.jar'],
        optionalModsPreferences: { 'a.jar': false },
        optionalModsDefaults: { 'a.jar': true },
      },
      (gameDir) => installMods(gameDir, 'pack-a', ['a.jar'])
    );

    expect(store.getInstalledModpackVersion('pack-a')).toBe('3.0.0');
    expect(store.getInstalledModpackVersion('pack-b')).toBeNull();
    expect(store.getConfig().installedModpackVersion).toBeNull();
    expect(store.getDisabledOptionalMods([opt('a.jar')], 'pack-a')).toEqual(['a.jar']);
    expect(store.getDisabledOptionalMods([opt('a.jar')], 'pack-b')).toEqual([]);
  });

  it('al actualizar la lista de modpacks se descartan los manifiestos de packs que ya no existen', async () => {
    const { store } = await loadStore();
    const manifest = (tag: string) => ({ tag, name: tag, version: '1', minecraftVersion: '1.20.1', loader: { type: 'fabric' as const }, changelog: [] });
    store.setCachedManifest('viejo', manifest('viejo'));
    store.setCachedManifest('vigente', manifest('vigente'));
    store.setCachedModpacks([{ tag: 'vigente', name: 'Vigente' } as any]);
    expect(store.getCachedManifest('viejo')).toBeNull();
    expect(store.getCachedManifest('vigente')).not.toBeNull();
  });
});
