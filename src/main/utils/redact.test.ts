import { describe, it, expect } from 'vitest';
import { redactSecrets } from './redact';

describe('redactSecrets', () => {
  it('oculta el token de acceso de la línea de arranque de MCLC', () => {
    const line = '[MCLC]: Launching with arguments -Xmx6G --username Goddark83 --accessToken eyJhbGciOi.abc.def --uuid 6610 --userType msa';
    const out = redactSecrets(line);
    expect(out).not.toContain('eyJhbGciOi');
    expect(out).toContain('--accessToken ***');
    expect(out).toContain('--username Goddark83');
  });

  it('oculta un JWT suelto y tokens clave=valor', () => {
    expect(redactSecrets('token eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcdefghijkl fin')).not.toContain('eyJhbGci');
    expect(redactSecrets('access_token=abcdef123456789')).toBe('access_token=***');
  });

  it('no altera el texto normal del juego', () => {
    const line = '[12:00:01] [Render thread/INFO]: Setting user: Goddark83';
    expect(redactSecrets(line)).toBe(line);
  });
});
