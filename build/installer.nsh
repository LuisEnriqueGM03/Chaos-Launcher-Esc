!macro customUnInstall
  ; Nunca tocar %APPDATA%\.chaoslauncher (modpacks, configuración y cuentas):
  ; ni al actualizar ni al desinstalar manualmente.
  ${ifNot} ${isUpdated}
    DetailPrint "Limpiando archivos temporales de actualización..."
    RMDir /r "$LOCALAPPDATA\chaos-launcher-updater"
  ${endIf}
!macroend
