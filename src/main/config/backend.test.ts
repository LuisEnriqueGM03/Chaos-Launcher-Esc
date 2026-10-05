import { describe, expect, it } from 'vitest';
import { DEFAULT_BACKEND_URL, isLegacyLocalBackend } from './backend';

describe('isLegacyLocalBackend', () => {
  it('detecta el backend local que guardaban las versiones anteriores', () => {
    expect(isLegacyLocalBackend('http://localhost:3000/api/v1/modpacks')).toBe(true);
    expect(isLegacyLocalBackend('http://127.0.0.1:3000/api/v1')).toBe(true);
    expect(isLegacyLocalBackend('https://localhost:3000')).toBe(true);
  });

  it('no toca el servidor público ni otras direcciones', () => {
    expect(isLegacyLocalBackend(DEFAULT_BACKEND_URL)).toBe(false);
    expect(isLegacyLocalBackend(`${DEFAULT_BACKEND_URL}/modpacks`)).toBe(false);
    expect(isLegacyLocalBackend('http://localhost:3006/api/v1')).toBe(false);
    expect(isLegacyLocalBackend('http://localhost:30001/api')).toBe(false);
    expect(isLegacyLocalBackend('')).toBe(false);
    expect(isLegacyLocalBackend(undefined)).toBe(false);
  });

  it('el servidor público es HTTPS', () => {
    expect(DEFAULT_BACKEND_URL.startsWith('https://')).toBe(true);
  });
});
