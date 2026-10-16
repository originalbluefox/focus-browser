const { contextBridge, ipcRenderer, clipboard } = require('electron');
const fs = require('fs');
const path = require('path');

// Expose secure API bridge to window.electronAPI
contextBridge.exposeInMainWorld('electronAPI', {
    // ---------- Clipboard Bridge ----------
    writeClipboardText: (text) => {
        try {
            clipboard.writeText(text);
            return true;
        } catch (e) {
            return false;
        }
    },

    // ---------- File System Operations ----------
    readHtmlFile: (relativeFilePath) => {
        try {
            const resolvedPath = path.resolve(__dirname, relativeFilePath);
            if (fs.existsSync(resolvedPath)) {
                return { success: true, content: fs.readFileSync(resolvedPath, 'utf8') };
            }
            return { success: false, error: 'File not found', path: resolvedPath };
        } catch (err) {
            return { success: false, error: err.message };
        }
    },

    // ---------- IPC Communication ----------
    invoke: (channel, ...args) => {
        const validChannels = [
            'get-app-version',
            'get-search-engine',
            'set-search-engine'
        ];
        if (validChannels.includes(channel)) {
            return ipcRenderer.invoke(channel, ...args);
        }
        return Promise.reject(new Error(`Unauthorized IPC invoke on channel: ${channel}`));
    },

    send: (channel, ...args) => {
        const validChannels = [
            'launch-main-app',
            'return-to-setup'
        ];
        if (validChannels.includes(channel)) {
            ipcRenderer.send(channel, ...args);
        }
    },

    on: (channel, listener) => {
        const validChannels = [
            'set-user-preferences',
            'open-guest-tab',
            'open-new-tab-request',
            'search-engine-updated'
        ];
        if (validChannels.includes(channel)) {
            const subscription = (event, ...args) => listener(...args);
            ipcRenderer.on(channel, subscription);
            return () => ipcRenderer.removeListener(channel, subscription);
        }
    }
});

// src/js/preload.js

