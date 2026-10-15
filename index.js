const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

app.setPath('userData', path.join(app.getPath('appData'), 'focus-helper-dev'));
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
const pkg = require('./package.json');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    maximizable: true,
    minimizable: true,
    icon: path.join(__dirname, 'icon.ico'),
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#1e1e1e',
      symbolColor: '#e3e3e3',
      height: 38
    },
    webPreferences: {
      webviewTag: true,
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false
    }
    
  });
  mainWindow.maximize()
  mainWindow.loadFile(path.join(__dirname, 'src/html/setup.html'));

  if (process.env.DEV_TOOLS === 'true') {
    mainWindow.webContents.openDevTools()
  }
}

ipcMain.handle('get-app-version', () => {
  return {
    version: pkg.version,
    build: pkg.buildString || '000000'
  };
});

// Listen for preferences from setup.html and load the main application window
ipcMain.on('launch-main-app', (event, prefs) => {
  const win = BrowserWindow.fromWebContents(event.sender) || mainWindow;
  
  win.loadFile(path.join(__dirname, 'src/html/index.html')).then(() => {
    // Send user choices to the renderer after index.html loads
    win.webContents.send('set-user-preferences', prefs);
  });
  
  // Resize window to workspace dimensions and center it
  win.setSize(1400, 900);
  win.center();
});
// Listen for request to return to setup / new session
ipcMain.on('return-to-setup', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender) || mainWindow;
  
  win.loadFile(path.join(__dirname, 'src/html/setup.html')).then(() => {
    win.setSize(600, 500);
    win.center();
  });
});
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
