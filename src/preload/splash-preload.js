import { contextBridge, ipcRenderer } from 'electron';

// Deliberately separate from the main app's preload/api surface — this
// window never touches downloads, settings, or any app data, so it gets
// its own minimal, unrelated bridge rather than reusing/extending `window.api`.
contextBridge.exposeInMainWorld('splashApi', {
  onStatus: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('splash:status', listener);
    return () => ipcRenderer.removeListener('splash:status', listener);
  },
  retry: () => ipcRenderer.send('splash:retry'),
  close: () => ipcRenderer.send('splash:close'),
  notifyListenerReady: () => ipcRenderer.send('splash:listener-ready')
});
