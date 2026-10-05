import { describe, it, expect } from 'vitest';
import path from 'path';
import { sanitizeTag, getModpackGameDir, getModpackModsDir } from './modpackPaths';

describe('sanitizeTag', () => {
  it('un tag válido del backend se usa tal cual como nombre de carpeta', () => {
    expect(sanitizeTag('mimic-pm')).toBe('mimic-pm');
    expect(sanitizeTag('mimic_mc-2')).toBe('mimic_mc-2');
  });

  it('sin tag no hay carpeta por defecto: lanza error', () => {
    expect(() => sanitizeTag('')).toThrow();
    expect(() => sanitizeTag('   ')).toThrow();
    expect(() => sanitizeTag(null)).toThrow();
    expect(() => sanitizeTag(undefined)).toThrow();
    expect(() => sanitizeTag('..')).toThrow();
  });

  it('no permite salir de la carpeta del juego', () => {
    expect(sanitizeTag('../../etc')).not.toContain('/');
    expect(sanitizeTag('a\\b')).not.toContain('\\');
  });

  it('evita nombres reservados de Windows', () => {
    expect(sanitizeTag('nul')).toBe('nul_');
    expect(sanitizeTag('COM1')).toBe('COM1_');
  });
});

describe('carpetas aisladas por modpack', () => {
  const base = path.join('C:', 'game');

  it('dos modpacks distintos nunca comparten carpeta', () => {
    expect(getModpackGameDir(base, 'mimic-mc')).not.toBe(getModpackGameDir(base, 'mimic-pm'));
    expect(getModpackModsDir(base, 'mimic-pm')).toBe(path.join(base, 'mimic-pm', 'mods'));
  });

  it('acepta un manifiesto, pero solo por su tag (no por el nombre)', () => {
    const manifest: any = { tag: 'mimic-pm', name: 'Prominence II Hasturian Era' };
    expect(getModpackGameDir(base, manifest)).toBe(path.join(base, 'mimic-pm'));
    expect(() => getModpackGameDir(base, { name: 'Sin tag' } as any)).toThrow();
  });
});
