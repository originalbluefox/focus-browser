// Main App Entry Point
const state = require('../js/state.js');
const { createTab, createTabFromFile } = require('../js/tabs.js');
const { initNavigationListeners } = require('../js/navigation.js');
const { overrides } = require('../js/overrides.js')
overrides({createTab})
function compareSemVer(v1, v2) {
    const p1 = v1.split('.').map(Number);
    const p2 = v2.split('.').map(Number);
    for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
        const a = p1[i] || 0;
        const b = p2[i] || 0;
        if (a > b) return 1;
        if (a < b) return -1;
    }
    return 0;
}

// Initialize navigation controls and listeners
initNavigationListeners();

// Initialize Context Bridge with dynamic active view getter
setTimeout(() => {
    state.initContextBridge({
        workView: state.getActiveWebview(),
        geminiView: state.aiView,
        geminiContainer: state.aiContainer,
        toPageBtn: state.toPageBtn,
        toGeminiBtn: state.toAiBtn,
        messageText: state.messageText
    });
}, 500);


// Version Check & Initial Startup Tab
document.addEventListener('DOMContentLoaded', async () => {
    // Initialize Developer Tools Hook
if (state.DeveloperTools) {
    try {
        state.DeveloperTools.init({
            preferences: state.preferences,
            tabs: state.tabs,
            getActiveWebview: state.getActiveWebview
        });
        console.log('[DevTools] Initialized successfully.');
    } catch (e) {
        console.warn('[DevTools] Failed to initialize:', e);
    }
}

    if (navigator.platform.toLowerCase().includes('mac') || navigator.userAgent.includes('Mac')) {
        document.body.classList.add('macos');
    }
    createTabFromFile("../html/landing.html")

    try {
        var {ipcRenderer} =require('electron')
        const appMeta = await ipcRenderer.invoke('get-app-version');
        
        
        const currentVersion = appMeta.version;
        
        state.versionText.innerText = `v${currentVersion} (Build ${appMeta.build})`;
    } catch (e) {
        console.log(e)
        state.versionText.innerText = 'v1.0.0';
    }

    await state.getConfig();

    try {
        state.messageText.innerText = 'Checking for updates...';
        const res = await fetch('https://raw.githubusercontent.com/originalbluef3x/versions/refs/heads/main/versions.json');
        const response = await res.json();

        const remoteVersion = response['Study Browser']?.version || false;
        if (!remoteVersion) {
            state.messageText.innerText = 'No version entry found.';
            return;
        }

        const currentVersionClean = state.versionText.innerText.split(' ')[0].replace('v', '');
        const cmp = compareSemVer(remoteVersion, currentVersionClean);
        if (cmp > 0) state.messageText.innerText = `Update available: v${remoteVersion}`;
        else if (cmp < 0) state.messageText.innerText = `Dev build`;
        else state.messageText.innerText = 'Up-to-date';
    } catch (err) {
        state.messageText.innerText = 'Offline / Status check failed';
    }
    const newSessionBtn = document.getElementById('new-session-btn');
if (newSessionBtn) {
    newSessionBtn.addEventListener('click', () => {
        state.ipcRenderer.send('return-to-setup');
    });
}
});

