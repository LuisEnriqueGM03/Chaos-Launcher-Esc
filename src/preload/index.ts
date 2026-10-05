import { contextBridge, ipcRenderer } from 'electron';

export const chaosAPI = {
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
  },

  auth: {
    getState: () => ipcRenderer.invoke('auth:getState'),
    loginOffline: (username: string) => ipcRenderer.invoke('auth:loginOffline', username),
    loginMicrosoft: () => ipcRenderer.invoke('auth:loginMicrosoft'),
    logout: () => ipcRenderer.invoke('auth:logout'),
    switchAccount: (accountId: string) => ipcRenderer.invoke('auth:switchAccount', accountId),
    deleteAccount: (accountId: string) => ipcRenderer.invoke('auth:deleteAccount', accountId),
  },

  skin: {
    get: () => ipcRenderer.invoke('skin:get'),
    renewSession: () => ipcRenderer.invoke('skin:renewSession'),
    pick: () => ipcRenderer.invoke('skin:pick'),
    apply: (dataUrl: string, variant: 'classic' | 'slim') => ipcRenderer.invoke('skin:apply', dataUrl, variant),
  },

  modpack: {
    getAll: () => ipcRenderer.invoke('modpack:getAll'),
    refreshList: () => ipcRenderer.invoke('modpack:refreshList'),
    checkUpdate: (tag?: string) => ipcRenderer.invoke('modpack:checkUpdate', tag),
    checkUpdateCached: (tag?: string) => ipcRenderer.invoke('modpack:checkUpdateCached', tag),
    downloadUpdate: (tag?: string) => ipcRenderer.invoke('modpack:downloadUpdate', tag),
    cancelDownload: () => ipcRenderer.invoke('modpack:cancelDownload'),
    getOptionalMods: (tag?: string) => ipcRenderer.invoke('modpack:getOptionalMods', tag),
    toggleOptionalMod: (modFileName: string, enabled: boolean, tag?: string) =>
      ipcRenderer.invoke('modpack:toggleOptionalMod', modFileName, enabled, tag),
    deleteModpack: (tag?: string) => ipcRenderer.invoke('modpack:deleteModpack', tag),
    onProgress: (callback: (progress: any) => void) => {
      const listener = (_: any, data: any) => callback(data);
      ipcRenderer.on('modpack:progress', listener);
      return () => ipcRenderer.removeListener('modpack:progress', listener);
    },
  },

  launcher: {
    launch: (tag?: string) => ipcRenderer.invoke('launcher:launch', tag),
    setKeepOpen: (keep: boolean) => ipcRenderer.invoke('launcher:setKeepOpen', keep),
    isRunning: () => ipcRenderer.invoke('launcher:isRunning'),
    onProgress: (callback: (progress: any) => void) => {
      const listener = (_: any, data: any) => callback(data);
      ipcRenderer.on('launcher:progress', listener);
      return () => ipcRenderer.removeListener('launcher:progress', listener);
    },
    onLog: (callback: (logLine: string) => void) => {
      const listener = (_: any, data: string) => callback(data);
      ipcRenderer.on('launcher:log', listener);
      return () => ipcRenderer.removeListener('launcher:log', listener);
    },
    onClosed: (callback: (code: any) => void) => {
      const listener = (_: any, data: any) => callback(data);
      ipcRenderer.on('launcher:closed', listener);
      return () => ipcRenderer.removeListener('launcher:closed', listener);
    },
    onError: (callback: (error: string) => void) => {
      const listener = (_: any, data: string) => callback(data);
      ipcRenderer.on('launcher:error', listener);
      return () => ipcRenderer.removeListener('launcher:error', listener);
    },
  },

  config: {
    get: () => ipcRenderer.invoke('config:get'),
    update: (partial: any) => ipcRenderer.invoke('config:update', partial),
  },

  updater: {
    getVersion: () => ipcRenderer.invoke('app:getVersion'),
    checkForUpdates: () => ipcRenderer.invoke('updater:checkForUpdates'),
    startDownload: () => ipcRenderer.invoke('updater:startDownload'),
    quitAndInstall: () => ipcRenderer.invoke('updater:quitAndInstall'),
    onChecking: (callback: () => void) => {
      const listener = () => callback();
      ipcRenderer.on('updater:checking', listener);
      return () => ipcRenderer.removeListener('updater:checking', listener);
    },
    onUpdateAvailable: (callback: (data: any) => void) => {
      const listener = (_: any, data: any) => callback(data);
      ipcRenderer.on('updater:updateAvailable', listener);
      return () => ipcRenderer.removeListener('updater:updateAvailable', listener);
    },
    onUpdateNotAvailable: (callback: (data: any) => void) => {
      const listener = (_: any, data: any) => callback(data);
      ipcRenderer.on('updater:updateNotAvailable', listener);
      return () => ipcRenderer.removeListener('updater:updateNotAvailable', listener);
    },
    onDownloadProgress: (callback: (progress: any) => void) => {
      const listener = (_: any, data: any) => callback(data);
      ipcRenderer.on('updater:downloadProgress', listener);
      return () => ipcRenderer.removeListener('updater:downloadProgress', listener);
    },
    onUpdateDownloaded: (callback: (data: any) => void) => {
      const listener = (_: any, data: any) => callback(data);
      ipcRenderer.on('updater:updateDownloaded', listener);
      return () => ipcRenderer.removeListener('updater:updateDownloaded', listener);
    },
    onError: (callback: (error: string) => void) => {
      const listener = (_: any, data: string) => callback(data);
      ipcRenderer.on('updater:error', listener);
      return () => ipcRenderer.removeListener('updater:error', listener);
    },
  },

  system: {
    getJavaList: () => ipcRenderer.invoke('system:getJavaList'),
    getSystemMemory: () => ipcRenderer.invoke('system:getSystemMemory'),
    openFolder: (folderPath: string) => ipcRenderer.invoke('system:openFolder', folderPath),
    getServerStatus: (host: string) => ipcRenderer.invoke('system:getServerStatus', host),
    uninstallApp: () => ipcRenderer.invoke('system:uninstallApp'),
  },
};

contextBridge.exposeInMainWorld('chaosAPI', chaosAPI);
