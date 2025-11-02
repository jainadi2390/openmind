const { contextBridge, ipcRenderer, desktopCapturer } = require('electron');

// Expose protected methods for the chatbox window
contextBridge.exposeInMainWorld('chatboxAPI', {
  // Window controls
  closeChatbox: () => ipcRenderer.send('close-chatbox'),
  minimizeChatbox: () => ipcRenderer.send('minimize-chatbox'),

  // Storage
  getStoreValue: (key) => ipcRenderer.invoke('get-store-value', key),
  setStoreValue: (key, value) => ipcRenderer.invoke('set-store-value', key, value),

  // Screen capture
  getScreenSources: async () => {
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 1920, height: 1080 }
    });
    return sources;
  },

  // Remove listeners
  removeListener: (channel, callback) => ipcRenderer.removeListener(channel, callback)
});
