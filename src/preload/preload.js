import { contextBridge, ipcRenderer } from 'electron';

// Only a fixed, whitelisted set of channels may be subscribed to or invoked
// from the renderer. No raw ipcRenderer object is ever exposed.
const QUEUE_CHANNELS = ['queue:item-updated', 'queue:item-complete'];

function subscribe(channel, callback) {
  if (!QUEUE_CHANNELS.includes(channel)) return () => {};
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

  addToQueue: (options) => ipcRenderer.invoke('queue:add', options),
  cancelQueueItem: (id) => ipcRenderer.invoke('queue:cancel', id),
  removeQueueItem: (id) => ipcRenderer.invoke('queue:remove', id),
  getQueueState: () => ipcRenderer.invoke('queue:get-state'),

  onQueueItemUpdated: (callback) => subscribe('queue:item-updated', callback),
  onQueueItemComplete: (callback) => subscribe('queue:item-complete', callback),

  getAppVersion: () => ipcRenderer.invoke('app:get-version')
});
