/**
 * Oculta credenciales en el texto que se muestra o copia desde la consola del launcher.
 * MCLC escribe la línea de arranque completa, que incluye el token de acceso de la cuenta.
 */
export function redactSecrets(text: string): string {
  return text
    .replace(/(--accessToken\s+)\S+/gi, '$1***')
    .replace(/(--clientId\s+)\S+/gi, '$1***')
    .replace(/(--xuid\s+)\S+/gi, '$1***')
    .replace(/(access_?token["']?\s*[:=]\s*["']?)[A-Za-z0-9._~+/=-]{8,}/gi, '$1***')
    .replace(/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, '***');
}
