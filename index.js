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
      webSecurity: true,
    }
    
  });
  mainWindow.maximize()
  mainWindow.loadFile(path.join(__dirname, 'src/html/vieux.html'));
  const defaultPrefs = require('./jsons/defaultPrefs.json')
  mainWindow.webContents.send("set-user-preferences", defaultPrefs)
  if (process.env.DEV_TOOLS === 'true') {
    mainWindow.webContents.openDevTools()
  }
  // Do not allow popups
// Mitigate spam
mainWindow.webContents.on('did-attach-webview', (event, webviewWebContents) => {
  // Intercept window.open calls from inside guest pages
  webviewWebContents.setWindowOpenHandler(({ url }) => {
    // Send URL to renderer tab manager instead of letting Electron spawn a window
    mainWindow.webContents.send('open-guest-tab', url);
    return { action: 'deny' }; // Block native window popups
  });
});
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
  
  win.loadFile(path.join(__dirname, 'src/html/vieux.html')).then(() => {
    // Send user choices to the renderer after vieux.html loads
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
app.whenReady().then(() =>{
  createWindow();
session.defaultSession.on('will-download', (event, item, webContents) => {
  // Check if download was initiated automatically without user action
  const userGesture = item.hasUserGesture();

  if (!userGesture) {
    event.preventDefault(); // Cancel rapid-fire script downloads
    console.warn('[Security] Blocked automated download attempt:', item.getURL());
  }
});


});

// Intercept popups/window.open calls from guest webviews
app.on('web-contents-created', (event, contents) => {
  if (contents.getType() === 'webview') {
    contents.setWindowOpenHandler(({ url }) => {
      // Send the requested URL to your main window tab manager
      mainWindow.webContents.send('open-new-tab-request', url);
      
      // Deny Electron from spawning a new desktop BrowserWindow
      return { action: 'deny' };
    });
  }
});

// SE magic
const prefsPath = path.join(__dirname, 'jsons/defaultPrefs.json');

// Memory state for the active search engine
let currentSearchEngine = 'https://google.com/search?q=';

// Read initial setting from disk on application boot
try {
  if (fs.existsSync(prefsPath)) {
    const rawPrefs = fs.readFileSync(prefsPath, 'utf8');
    const parsed = JSON.parse(rawPrefs);
    if (parsed.searchEngineScheme) {
      currentSearchEngine = parsed.searchEngineScheme;
    }
  }
} catch (err) {
  console.warn('[Main Process] Failed to load initial search engine preference:', err);
}

// ---------------- IPC Handlers ----------------

// 1. Fetch current search engine state
ipcMain.handle('get-search-engine', () => {
  return currentSearchEngine;
});

// 2. Set search engine state, persist to disk, and broadcast updates
ipcMain.handle('set-search-engine', (event, engineUrl) => {
  if (!engineUrl) return { success: false, error: 'No engine URL provided' };

  currentSearchEngine = engineUrl;

  // Persist updated scheme to disk
  try {
    let prefs = {};
    if (fs.existsSync(prefsPath)) {
      prefs = JSON.parse(fs.readFileSync(prefsPath, 'utf8'));
    }
    
    prefs.searchEngineScheme = engineUrl;

    fs.writeFileSync(prefsPath, JSON.stringify(prefs, null, 2), 'utf8');
    console.log('[Main Process] Saved active search engine to defaultPrefs.json:', engineUrl);
  } catch (err) {
    console.error('[Main Process] Failed to save search engine to disk:', err);
  }

  // Broadcast the update to the parent renderer (app.js / navigation.js)
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('search-engine-updated', currentSearchEngine);
  }

  return { success: true };
});



app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});


process.on("uncaughtException", (err) => {
})