import { contextBridge, ipcRenderer } from 'electron';

// Only a fixed, whitelisted set of channels may be subscribed to or invoked
// from the renderer. No raw ipcRenderer object is ever exposed.
const PROGRESS_CHANNELS = ['download:progress', 'download:status', 'download:complete', 'download:error'];

function subscribe(channel, callback) {
  if (!PROGRESS_CHANNELS.includes(channel)) return () => {};
  const listener = (_event, payload) => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld('api', {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (partial) => ipcRenderer.invoke('settings:update', partial),

  selectDownloadFolder: () => ipcRenderer.invoke('dialog:select-download-folder'),
  getDefaultDownloadsDir: () => ipcRenderer.invoke('paths:get-default-downloads-dir'),
  openFolder: (targetPath) => ipcRenderer.invoke('folder:open', targetPath),

  checkBinaries: () => ipcRenderer.invoke('binaries:check'),
  updateYtDlp: () => ipcRenderer.invoke('binaries:update-ytdlp'),

  startDownload: (options) => ipcRenderer.invoke('download:start', options),
  cancelDownload: () => ipcRenderer.invoke('download:cancel'),
  getActiveDownload: () => ipcRenderer.invoke('download:get-active'),

  onDownloadProgress: (callback) => subscribe('download:progress', callback),
  onDownloadStatus: (callback) => subscribe('download:status', callback),
  onDownloadComplete: (callback) => subscribe('download:complete', callback),
  onDownloadError: (callback) => subscribe('download:error', callback),

  getAppVersion: () => ipcRenderer.invoke('app:get-version')
});
