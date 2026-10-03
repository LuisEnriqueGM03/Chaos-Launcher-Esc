!macro customUnInstall
  DetailPrint "Eliminando datos locales y modpacks de Chaos Launcher..."
  RMDir /r "$APPDATA\.chaoslauncher"
  RMDir /r "$APPDATA\chaos-launcher"
  RMDir /r "$LOCALAPPDATA\chaos-launcher-updater"
!macroend
