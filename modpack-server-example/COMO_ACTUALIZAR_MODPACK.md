# 🚀 Guía: Cómo Publicar y Actualizar tu Modpack

¡No necesitas pagar ningún servidor ni base de datos para actualizar tu modpack a todos tus jugadores!

## Pasos para Publicar una Nueva Actualización:

1. **Prepara tus mods y configs**:
   - Agrega o quita los mods que quieras en tu carpeta `mods/` y las configuraciones en `config/`.
2. **Empaqueta en un ZIP**:
   - Comprime las carpetas `mods` y `config` en un archivo `.zip` (por ejemplo `chaos-pack-v1.1.0.zip`).
   - *Tip: Puedes usar el script `npm run bundle-pack` incluido en este proyecto.*
3. **Sube el ZIP**:
   - Ve a tu repositorio de GitHub (o Google Drive / Dropbox / MediaFire con enlace directo).
   - Crea un **Release** en GitHub (ej. `v1.1.0`) y adjunta el archivo ZIP.
   - Copia el enlace de descarga directa del ZIP.
4. **Actualiza `modpack.json`**:
   - Abre `modpack.json`.
   - Cambia `"version": "1.1.0"` (debe ser mayor a la anterior).
   - Pega tu enlace en `"downloadUrl": "https://..."`.
   - Añade en `"changelog"` la lista de novedades y cambios.
   - Haz `git commit` y `git push`.

¡Listo! En cuanto tus amigos o jugadores abran **ChaosLauncher**, el launcher detectará que hay una nueva versión, **bloqueará el botón de jugar** y les obligará a presionar **"DESCARGAR E INSTALAR ACTUALIZACIÓN OBLIGATORIA"**. Una vez termine la descarga, ¡podrán entrar a jugar sin problemas de versión!
