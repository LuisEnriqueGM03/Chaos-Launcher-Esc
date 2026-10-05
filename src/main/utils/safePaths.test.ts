import { describe, it, expect } from 'vitest';
import path from 'path';
import { resolveInside, isInside, assertSafeDownloadUrl, normalizeDownloadUrl } from './safePaths';

describe('normalizeDownloadUrl', () => {
  it('no vuelve a codificar un + ya codificado (causa del 403 en el CDN de CurseForge)', () => {
    const url = 'https://edge.forgecdn.net/files/4944/647/alloy-forgery-2.1.2%2b1.20.jar';
    expect(normalizeDownloadUrl(url)).toBe(url);
    expect(normalizeDownloadUrl(url)).not.toContain('%252');
  });

  it('un + literal se queda como está', () => {
    const url = 'https://edge.forgecdn.net/files/4944/647/alloy-forgery-2.1.2+1.20.jar';
    expect(normalizeDownloadUrl(url)).toBe(url);
  });

  it('codifica lo que no estaba codificado (espacios y corchetes)', () => {
    expect(normalizeDownloadUrl('https://x.test/a b.jar')).toBe('https://x.test/a%20b.jar');
    expect(normalizeDownloadUrl('https://x.test/[fabric]ctov.jar')).toBe('https://x.test/%5Bfabric%5Dctov.jar');
  });

  it('conserva los escapes de GitHub raw y los símbolos permitidos', () => {
    const url = 'https://raw.githubusercontent.com/o/r/main/resourcepacks/Refreshing%20Soundtracks!.zip';
    expect(normalizeDownloadUrl(url)).toBe(url);
  });

  it('es idempotente', () => {
    const once = normalizeDownloadUrl('https://x.test/a b+c[d]%23e.jar');
    expect(normalizeDownloadUrl(once)).toBe(once);
  });
});

const base = path.resolve('/tmp/game/modpack');

describe('resolveInside', () => {
  it('resuelve rutas normales dentro de la base', () => {
    expect(resolveInside(base, 'mods/a.jar')).toBe(path.join(base, 'mods', 'a.jar'));
    expect(resolveInside(base, 'config\\x.toml')).toBe(path.join(base, 'config', 'x.toml'));
  });

  it.each(['../evil.jar', 'mods/../../evil.jar', '..\\evil.jar', '/etc/passwd', 'C:\\Windows\\x.dll', 'a\0b', ''])(
    'rechaza "%s"',
    (bad) => {
      expect(() => resolveInside(base, bad)).toThrow();
    },
  );
});

describe('isInside', () => {
  it('distingue carpetas hermanas con prefijo común', () => {
    expect(isInside(base, path.join(base, 'mods'))).toBe(true);
    expect(isInside(base, base + '-otra')).toBe(false);
    expect(isInside(base, path.join(base, '..'))).toBe(false);
  });
});

describe('assertSafeDownloadUrl', () => {
  it('acepta https y http a localhost', () => {
    expect(() => assertSafeDownloadUrl('https://raw.githubusercontent.com/a/b/main/x.jar')).not.toThrow();
    expect(() => assertSafeDownloadUrl('http://localhost:3000/api/v1/x')).not.toThrow();
  });

  it.each(['http://evil.com/x.jar', 'file:///C:/x', 'ftp://a/b', 'no-es-url'])('rechaza "%s"', (bad) => {
    expect(() => assertSafeDownloadUrl(bad)).toThrow();
  });
});
