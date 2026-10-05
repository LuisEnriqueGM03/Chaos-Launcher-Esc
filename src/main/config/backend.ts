/**
 * Dirección del backend de Chaos Launcher. Única fuente de verdad en el proceso principal.
 *
 * Por defecto es el servidor público. Para desarrollar contra un backend local, arranca el launcher con
 * CHAOS_BACKEND_URL=http://localhost:3000/api/v1
 */
export const DEFAULT_BACKEND_URL = 'https://chaos-launcher-backend.legm03.xyz/api/v1';

export const BACKEND_URL = (process.env.CHAOS_BACKEND_URL || DEFAULT_BACKEND_URL).replace(/\/$/, '');

/** Valores locales que versiones anteriores guardaron en config.json y que hay que migrar al servidor público. */
export function isLegacyLocalBackend(url: string | undefined | null): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\]):3000(\/|$)/i.test((url || '').trim());
}
