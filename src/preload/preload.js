import { contextBridge, ipcRenderer } from 'electron';

// Only a fixed, whitelisted set of channels may be subscribed to or invoked
// from the renderer. No raw ipcRenderer object is ever exposed.
const SUBSCRIBABLE_CHANNELS = ['queue:item-updated', 'queue:item-complete', 'clipboard:url-detected'];

function subscribe(channel, callback) {
  if (!SUBSCRIBABLE_CHANNELS.includes(channel)) return () => {};
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
  analyzeUrl: (url) => ipcRenderer.invoke('media:analyze', url),

  addToQueue: (options) => ipcRenderer.invoke('queue:add', options),
  cancelQueueItem: (id) => ipcRenderer.invoke('queue:cancel', id),
  removeQueueItem: (id) => ipcRenderer.invoke('queue:remove', id),
  retryQueueItem: (id) => ipcRenderer.invoke('queue:retry', id),
  getQueueState: () => ipcRenderer.invoke('queue:get-state'),

  onQueueItemUpdated: (callback) => subscribe('queue:item-updated', callback),
  onQueueItemComplete: (callback) => subscribe('queue:item-complete', callback),
  onClipboardUrlDetected: (callback) => subscribe('clipboard:url-detected', callback),

  getAppVersion: () => ipcRenderer.invoke('app:get-version'),
  checkForUpdate: () => ipcRenderer.invoke('app:check-for-update'),
  openExternal: (url) => ipcRenderer.invoke('app:open-external', url),

  // Tells the main process the app has actually mounted and loaded its
  // initial data — this is what the splash screen waits on to know when
  // it's safe to hand off to the main window. See stores/queue.js's init().
  notifyReady: () => ipcRenderer.send('app:renderer-ready')
});
