// Global State & DOM Handles Module
const {ipcRenderer} = require('electron')
// DevTools & Electron Imports
let DeveloperTools = null;
try {
    DeveloperTools = require('../js/dev.js').DeveloperTools;
} catch (e) {
    console.warn('[DevTools] Optional module not loaded.');
}

const electronAPI = window.electronAPI || {
    invoke: () => Promise.resolve(),
    send: () => {},
    on: () => {}
};

const { checkSearch, getConfig } = require('../js/filter.js');
const { initContextBridge } = require('../js/context.js');

// DOM Handles
const workContainer = document.getElementById('work-container');
const aiView = document.getElementById('ai-view');
const urlInput = document.getElementById('url-input');
const goBtn = document.getElementById('go-btn');
const backBtn = document.getElementById('back-btn');
const reloadBtn = document.getElementById('reload-btn');
const toggleAiBtn = document.getElementById('toggle-ai');
const aiContainer = document.getElementById('ai-container');
const toAiBtn = document.getElementById('to-ai-btn');
const toPageBtn = document.getElementById('to-page-btn');

const searchEngineSelect = document.getElementById('search-engine-select');
const aiAssistantSelect = document.getElementById('ai-assistant-select');

const versionText = document.getElementById('version');
const messageText = document.getElementById('message');
const tabStrip = document.getElementById('tab-strip');

// Multi-Tab State
let tabs = [];
let activeTabId = null;

// Preferences
let preferences = { 
    searchEngineScheme: 'https://google.com/search?q=' 
};
// Listen for updates from main process and keep local state updated
ipcRenderer.on('search-engine-updated', (event, engineUrl) => {
    preferences.searchEngineScheme = engineUrl;
    console.log('[State] Updated state.preferences.searchEngineScheme:', engineUrl);
});

// Fetch active configuration on boot
ipcRenderer.invoke('get-search-engine').then((engineUrl) => {
    if (engineUrl) preferences.searchEngineScheme = engineUrl;
});
function getActiveWebview() {
    const active = tabs.find(t => t.id === activeTabId);
    return active ? active.webview : null;
}

module.exports = {
    DeveloperTools: new DeveloperTools(),
    ipcRenderer: electronAPI,
    checkSearch,
    getConfig,
    initContextBridge,
    workContainer,
    aiView,
    urlInput,
    goBtn,
    backBtn,
    reloadBtn,
    toggleAiBtn,
    aiContainer,
    toAiBtn,
    toPageBtn,
    searchEngineSelect,
    aiAssistantSelect,
    versionText,
    messageText,
    tabStrip,
    tabs,
    get activeTabId() { return activeTabId; },
    set activeTabId(id) { activeTabId = id; },
    preferences,
    getActiveWebview
};