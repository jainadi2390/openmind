const { app, BrowserWindow, globalShortcut, ipcMain, Menu, Tray } = require('electron');
const path = require('path');
const Store = require('electron-store');

const store = new Store();
let mainWindow;
let tray;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    minWidth: 800,
    minHeight: 600,
    transparent: false, // Solid window for professional look
    frame: true, // Keep window controls visible
    backgroundColor: '#1a1a1a',
    alwaysOnTop: false, // User can toggle this
    resizable: true,
    title: 'OpenMind AI Assistant',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false
    }
  });

  mainWindow.loadFile('index.html');

  // Create application menu
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Settings',
          accelerator: 'CmdOrCtrl+,',
          click: () => {
            mainWindow.webContents.send('show-settings');
          }
        },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Toggle Compact Mode',
          accelerator: 'CmdOrCtrl+K',
          click: () => {
            mainWindow.webContents.send('toggle-compact-mode');
          }
        },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        {
          label: 'Always on Top',
          type: 'checkbox',
          checked: false,
          click: (menuItem) => {
            mainWindow.setAlwaysOnTop(menuItem.checked);
          }
        },
        { type: 'separator' },
        { role: 'minimize' },
        { role: 'zoom' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About OpenMind',
          click: () => {
            mainWindow.webContents.send('show-about');
          }
        },
        {
          label: 'Documentation',
          click: async () => {
            const { shell } = require('electron');
            await shell.openExternal('https://github.com/yourusername/openmind');
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);

  // IPC handlers
  ipcMain.on('set-always-on-top', (event, value) => {
    mainWindow.setAlwaysOnTop(value);
  });

  ipcMain.on('minimize-window', () => {
    mainWindow.minimize();
  });

  ipcMain.handle('get-store-value', (event, key) => {
    return store.get(key);
  });

  ipcMain.handle('set-store-value', (event, key, value) => {
    store.set(key, value);
  });

  ipcMain.handle('delete-store-value', (event, key) => {
    store.delete(key);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createTray() {
  // Tray icon for quick access
  // Note: You'll need to create an icon file for this
  // tray = new Tray(path.join(__dirname, 'assets', 'tray-icon.png'));

  // const contextMenu = Menu.buildFromTemplate([
  //   {
  //     label: 'Show OpenMind',
  //     click: () => {
  //       if (mainWindow) {
  //         mainWindow.show();
  //       }
  //     }
  //   },
  //   { type: 'separator' },
  //   { label: 'Quit', role: 'quit' }
  // ]);

  // tray.setToolTip('OpenMind AI Assistant');
  // tray.setContextMenu(contextMenu);

  // tray.on('click', () => {
  //   if (mainWindow) {
  //     mainWindow.show();
  //   }
  // });
}

app.whenReady().then(() => {
  createWindow();
  // createTray();

  // Global shortcuts
  globalShortcut.register('CmdOrCtrl+Shift+M', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });

  globalShortcut.register('CmdOrCtrl+Shift+R', () => {
    if (mainWindow) {
      mainWindow.webContents.send('toggle-recording');
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('will-quit', () => {
  // Unregister all shortcuts
  globalShortcut.unregisterAll();
});
