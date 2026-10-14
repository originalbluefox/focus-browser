const { ipcRenderer } = require('electron');
const { checkSearch, getConfig } = require('../js/filter.js');
const { initContextBridge } = require('../js/context.js');

// DOM Handles
const workView = document.getElementById('work-view');
const aiView = document.getElementById('ai-view');
const urlInput = document.getElementById('url-input');
const goBtn = document.getElementById('go-btn');
const backBtn = document.getElementById('back-btn');
const reloadBtn = document.getElementById('reload-btn');
const toggleAiBtn = document.getElementById('toggle-ai');
const aiContainer = document.getElementById('ai-container');
const toAiBtn = document.getElementById('to-ai-btn');
const toPageBtn = document.getElementById('to-page-btn');

const versionText = document.getElementById('version');
const messageText = document.getElementById('message');

// Default search scheme fallback if not passed from setup
let preferences = { 
    searchEngineScheme: 'https://google.com/search?q=' 
};

// Listen for user preferences passed from setup window on launch
ipcRenderer.on('set-user-preferences', (event, prefs) => {
    console.log('[App] Received preferences from setup:', prefs);
    if (prefs.searchEngine) {
        console.log("[App] SEARCH ENGINE SELECTED", prefs.searchEngine)
        preferences.searchEngineScheme = prefs.searchEngine;
        workView.setAttribute('src', prefs.searchEngine)
    }
    if (prefs.aiAssistant && aiView) {
        aiView.setAttribute('src', prefs.aiAssistant);
    }
});

function toggleStatusText() {
    document.querySelectorAll('#status-footer p').forEach(p => {
        p.style.display = (p.style.display === 'none' ? 'inline-block' : 'none');
    });
}
window.toggleStatusText = toggleStatusText;

async function navigate() {
    const rawInput = urlInput.value.trim();
    if (!rawInput) return;

    const tld = /^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/;
    const isDomain = tld.test(rawInput);
    const isLink = /\w+:\/\//.test(rawInput);

    let validatedInput = await checkSearch(rawInput);
    if (!validatedInput) {
        messageText.innerText = `x_x navigation blocked: "${rawInput}"`;
        return;
    }

    if (!isLink && isDomain) {
        validatedInput = 'https://' + validatedInput;
    } else if (!isLink && !isDomain) {
        validatedInput = preferences.searchEngineScheme + encodeURIComponent(validatedInput);
    }

    workView.setAttribute('src', validatedInput);
}

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

// Event Listeners
goBtn.addEventListener('click', navigate);
urlInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') navigate(); });
backBtn.addEventListener('click', () => { if (workView.canGoBack()) workView.goBack(); });
reloadBtn.addEventListener('click', () => workView.reload());

workView.addEventListener('did-navigate', (e) => { urlInput.value = e.url; });
workView.addEventListener('did-navigate-in-page', (e) => {
    if (e.isMainFrame) urlInput.value = e.url;
});

if (toggleAiBtn && aiContainer) {
    toggleAiBtn.addEventListener('click', () => {
        aiContainer.classList.toggle('hidden');
    });
}

// Initialize Context Bridge (two-way) mapping the AI view container
initContextBridge({
    workView,
    geminiView: aiView,
    geminiContainer: aiContainer,
    toPageBtn,
    toGeminiBtn: toAiBtn,
    messageText
});

// Version Check
document.addEventListener('DOMContentLoaded', async () => {
    const appMeta = await ipcRenderer.invoke('get-app-version');
    const currentVersion = appMeta.version;

    versionText.innerText = `Version: v${currentVersion} (Build ${appMeta.build})`;
    await getConfig();

    try {
        messageText.innerText = 'Checking for updates...';
        const res = await fetch('https://raw.githubusercontent.com/originalbluef3x/versions/refs/heads/main/versions.json');
        const response = await res.json();

        const remoteVersion = response['projectAether']?.version || false;
        if (!remoteVersion) {
            messageText.innerText = 'No version entry found.';
            return;
        }

        const cmp = compareSemVer(remoteVersion, currentVersion);
        if (cmp > 0) messageText.innerText = `A new update is available: v${remoteVersion}`;
        else if (cmp < 0) messageText.innerText = `Running dev build (v${currentVersion})`;
        else messageText.innerText = 'Up-to-date!';
    } catch (err) {
        messageText.innerText = 'Unable to fetch version status.';
    }
});

const newSessionBtn = document.getElementById('new-session-btn');

if (newSessionBtn) {
    newSessionBtn.addEventListener('click', () => {
        ipcRenderer.send('return-to-setup');
    });
}