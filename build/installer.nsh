!macro customUnInstall
  DetailPrint "Limpiando archivos temporales de actualización..."
  RMDir /r "$LOCALAPPDATA\chaos-launcher-updater"
!macroend
