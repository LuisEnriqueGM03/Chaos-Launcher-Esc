import { describe, it, expect } from 'vitest';
import path from 'path';
import { resolveInside, isInside, assertSafeDownloadUrl } from './safePaths';

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
