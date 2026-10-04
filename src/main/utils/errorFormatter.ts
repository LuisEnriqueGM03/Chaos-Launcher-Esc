/**
 * Formateador de errores para el proceso principal (Main / IPC) de Chaos Launcher.
 * Limpia y traduce excepciones antes de que Electron las envíe al Renderer.
 */

export function formatFriendlyError(err: any): string {
  if (!err) return 'Ha ocurrido un error inesperado.';

  let raw = '';
  if (typeof err === 'string') {
    raw = err;
  } else if (err.message && typeof err.message === 'string') {
    raw = err.message;
  } else if (err.toString && typeof err.toString === 'function') {
    raw = err.toString();
  } else {
    try {
      raw = JSON.stringify(err);
    } catch {
      raw = String(err);
    }
  }

  // Eliminar trazas de pila
  raw = raw.split(/\r?\n\s*at\s+/)[0].trim();

  // Limpiar prefijos comunes
  raw = raw
    .replace(/^AxiosError:\s*/i, '')
    .replace(/^Error:\s*/i, '')
    .trim();

  const lower = raw.toLowerCase();

  // 1. Cancelaciones
  if (lower.includes('cancelada') || lower.includes('cancelled') || lower === 'cancel') {
    return 'Operación cancelada por el usuario.';
  }

  // 2. Errores HTTP
  if (lower.includes('status code 404') || lower.includes('not found') || lower.includes('código 404')) {
    return 'No se encontró uno o más archivos en el servidor o repositorio (Error 404). Por favor, intenta de nuevo más tarde o verifica que el modpack esté actualizado.';
  }

  if (lower.includes('status code 403') || lower.includes('rate limit') || lower.includes('forbidden')) {
    return 'Límite de solicitudes alcanzado o acceso denegado por el servidor (Error 403). Por favor, espera unos minutos e inténtalo de nuevo.';
  }

  if (lower.includes('status code 401') || lower.includes('unauthorized')) {
    return 'Acceso no autorizado al recurso solicitado (Error 401). Verifica tus credenciales o el estado del servidor.';
  }

  if (
    lower.includes('status code 500') ||
    lower.includes('status code 502') ||
    lower.includes('status code 503') ||
    lower.includes('status code 504') ||
    lower.includes('bad gateway')
  ) {
    return 'El servidor remoto está experimentando problemas temporales. Por favor, inténtalo más tarde.';
  }

  if (lower.includes('etimedout') || lower.includes('timeout') || lower.includes('econnaborted')) {
    return 'Tiempo de espera agotado al conectar con el servidor. Tu conexión a internet es lenta o inestable.';
  }

  if (
    lower.includes('econnrefused') ||
    lower.includes('enotfound') ||
    lower.includes('getaddrinfo') ||
    lower.includes('network error')
  ) {
    return 'No se pudo conectar con el servidor. Comprueba tu conexión a internet o verifica si el servidor está en mantenimiento.';
  }

  // 3. Disco y archivos
  if (lower.includes('enospc') || lower.includes('no space left')) {
    return 'Espacio en disco insuficiente en tu equipo para completar la descarga e instalación.';
  }

  if (lower.includes('eperm') || lower.includes('eacces')) {
    return 'Error de permisos en el disco. Intenta ejecutar Chaos Launcher como Administrador o verifica que tu antivirus no bloquee la carpeta del juego.';
  }

  if (lower.includes('ebusy')) {
    return 'Un archivo del juego está bloqueado por otro proceso. Cierra cualquier ventana de Minecraft o Java abierta e inténtalo de nuevo.';
  }

  // 4. Java y ejecución
  if (lower.includes('java 21') || lower.includes('java detector') || lower.includes('java no encontrado')) {
    return 'No se encontró una instalación compatible de Java 21 en tu sistema. Instala Java 21 para poder iniciar este modpack.';
  }

  if (lower.includes('ya se encuentra en ejecución')) {
    return 'El juego ya se encuentra en ejecución en este momento.';
  }

  if (lower.includes('no hay ninguna cuenta seleccionada')) {
    return 'No hay ninguna cuenta seleccionada. Por favor, inicia sesión para jugar.';
  }

  if (lower.includes('actualización obligatoria detectada')) {
    return 'Hay una nueva versión obligatoria del modpack disponible. Debes actualizar antes de poder jugar.';
  }

  if (raw.length > 0) {
    const capitalized = raw.charAt(0).toUpperCase() + raw.slice(1);
    return capitalized.endsWith('.') ? capitalized : `${capitalized}.`;
  }

  return 'Ha ocurrido un error al procesar la solicitud.';
}
