const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls
  setAlwaysOnTop: (value) => ipcRenderer.send('set-always-on-top', value),
  minimizeWindow: () => ipcRenderer.send('minimize-window'),

  // Chatbox controls
  openChatbox: () => ipcRenderer.send('open-chatbox'),
  closeChatbox: () => ipcRenderer.send('close-chatbox'),
  toggleChatbox: () => ipcRenderer.send('toggle-chatbox'),
  updateChatboxVisibility: () => ipcRenderer.send('update-chatbox-visibility'),

  // Storage
  getStoreValue: (key) => ipcRenderer.invoke('get-store-value', key),
  setStoreValue: (key, value) => ipcRenderer.invoke('set-store-value', key, value),
  deleteStoreValue: (key) => ipcRenderer.invoke('delete-store-value', key),

  // Listeners
  onShowSettings: (callback) => ipcRenderer.on('show-settings', callback),
  onToggleCompactMode: (callback) => ipcRenderer.on('toggle-compact-mode', callback),
  onToggleRecording: (callback) => ipcRenderer.on('toggle-recording', callback),
  onShowAbout: (callback) => ipcRenderer.on('show-about', callback),

  // Remove listeners
  removeListener: (channel, callback) => ipcRenderer.removeListener(channel, callback)
});
