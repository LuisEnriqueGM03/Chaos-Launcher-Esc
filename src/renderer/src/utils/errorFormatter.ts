/**
 * Formateador universal de errores para Chaos Launcher.
 * Transforma errores técnicos, códigos HTTP y excepciones de Electron IPC
 * en mensajes amigables, claros y en español para el usuario.
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

  // Eliminar trazas de pila (stack trace)
  raw = raw.split(/\r?\n\s*at\s+/)[0].trim();

  // Limpiar envolturas de Electron IPC y librerías
  raw = raw
    .replace(/^Error:\s*Error invoking remote method '[^']+':\s*Error:\s*/i, '')
    .replace(/^Error invoking remote method '[^']+':\s*Error:\s*/i, '')
    .replace(/^Error invoking remote method '[^']+':\s*/i, '')
    .replace(/^AxiosError:\s*/i, '')
    .replace(/^Error:\s*/i, '')
    .trim();

  const lower = raw.toLowerCase();

  // 1. Errores de cancelación voluntaria
  if (
    lower.includes('descarga cancelada') ||
    lower.includes('cancelled') ||
    lower === 'cancelado' ||
    lower === 'cancel'
  ) {
    return 'Operación cancelada por el usuario.';
  }

  // 2. Errores HTTP y de repositorio
  if (lower.includes('status code 404') || lower.includes('not found') || lower.includes('código 404')) {
    return 'No se encontró uno o más archivos en el servidor o repositorio (Error 404). Por favor, intenta de nuevo más tarde o verifica que el modpack esté actualizado.';
  }

  if (
    lower.includes('status code 403') ||
    lower.includes('rate limit') ||
    lower.includes('rate_limit') ||
    lower.includes('forbidden')
  ) {
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
    lower.includes('bad gateway') ||
    lower.includes('service unavailable')
  ) {
    return 'El servidor remoto está experimentando problemas temporales. Por favor, inténtalo más tarde.';
  }

  if (
    lower.includes('etimedout') ||
    lower.includes('timeout') ||
    lower.includes('econnaborted') ||
    lower.includes('tiempo de espera')
  ) {
    return 'Tiempo de espera agotado al conectar con el servidor. Tu conexión a internet es lenta o inestable.';
  }

  if (
    lower.includes('econnrefused') ||
    lower.includes('enotfound') ||
    lower.includes('getaddrinfo') ||
    lower.includes('network error') ||
    lower.includes('fetch failed') ||
    lower.includes('err_internet_disconnected')
  ) {
    return 'No se pudo conectar con el servidor. Comprueba tu conexión a internet o verifica si el servidor está en mantenimiento.';
  }

  // 3. Errores de disco y sistema de archivos
  if (lower.includes('enospc') || lower.includes('no space left') || lower.includes('espacio insuficiente')) {
    return 'Espacio en disco insuficiente en tu equipo para completar la descarga e instalación.';
  }

  if (
    lower.includes('eperm') ||
    lower.includes('eacces') ||
    lower.includes('operation not permitted') ||
    lower.includes('permission denied')
  ) {
    return 'Error de permisos en el disco. Intenta ejecutar Chaos Launcher como Administrador o verifica que tu antivirus no bloquee la carpeta del juego.';
  }

  if (lower.includes('ebusy') || lower.includes('resource locked') || lower.includes('locked')) {
    return 'Un archivo del juego está bloqueado por otro proceso. Cierra cualquier ventana de Minecraft o Java abierta e inténtalo de nuevo.';
  }

  // 4. Errores de autenticación (Microsoft, Xbox Live, Mojang)
  if (lower.includes('user does not have xbox account') || lower.includes('xbox live')) {
    return 'Tu cuenta de Microsoft no tiene un perfil de Xbox Live configurado. Ingresa a xbox.com para activarlo.';
  }

  if (
    lower.includes('user does not own game') ||
    lower.includes('not_owned') ||
    lower.includes('product not found') ||
    lower.includes('no posee minecraft')
  ) {
    return 'Esta cuenta de Microsoft no posee una copia comprada de Minecraft Java Edition.';
  }

  if (lower.includes('token expired') || lower.includes('sesión ha expirado') || lower.includes('sesion expirada')) {
    return 'Tu sesión de juego ha expirado. Por favor, vuelve a iniciar sesión con tu cuenta.';
  }

  // 5. Errores de Java y ejecución del juego
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

  if (
    lower.includes('código de salida: 1') ||
    lower.includes('código de salida 1') ||
    lower.includes('exit code: 1') ||
    lower.includes('exit code 1')
  ) {
    return 'El juego se cerró de forma inesperada (Código 1). Verifica que la memoria RAM asignada en Ajustes sea suficiente (mínimo 4 GB - 6 GB recomendados).';
  }

  if (lower.includes('0xc0000409') || lower.includes('-1073740791')) {
    return 'El controlador de tu tarjeta gráfica se detuvo de forma inesperada. Actualiza tus drivers gráficos (NVIDIA, AMD o Intel).';
  }

  if (lower.includes('0xc0000005') || lower.includes('-805306369')) {
    return 'El juego se quedó sin memoria RAM física disponible. Reduce la distancia de renderizado o cierra otros programas antes de jugar.';
  }

  // Si no coincidió con ninguna regla específica, devolver el texto limpio sin prefijos técnicos
  if (raw.length > 0) {
    const capitalized = raw.charAt(0).toUpperCase() + raw.slice(1);
    return capitalized.endsWith('.') ? capitalized : `${capitalized}.`;
  }

  return 'Ha ocurrido un error al procesar la solicitud.';
}
