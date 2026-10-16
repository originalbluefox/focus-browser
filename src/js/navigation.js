// Navigation & Toolbar Management Module
const state = require('./state.js');

async function navigate() {
    if (!state.urlInput) return;

    const rawInput = state.urlInput.value.trim();
    if (!rawInput) return;

    const tld = /^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/i;
    const isDomain = tld.test(rawInput);
    const isLink = /\w+:\/\//.test(rawInput);

    let validatedInput = rawInput;
    if (typeof state.checkSearch === 'function') {
        validatedInput = await state.checkSearch(rawInput);
        if (!validatedInput) {
            if (state.messageText) state.messageText.innerText = `x_x navigation blocked: "${rawInput}"`;
            return;
        }
    }

    if (rawInput.startsWith("data:")) {
        validatedInput = rawInput;
        state.urlInput.value = "";
    } else if (!isLink && isDomain) {
        validatedInput = 'https://' + validatedInput;
    } else if (!isLink && !isDomain) {
        const searchScheme = (state.preferences && state.preferences.searchEngineScheme) 
        console.log("[NAV] SEARCH SCHEMA", searchScheme)
        validatedInput = searchScheme + encodeURIComponent(validatedInput);
    }

    const currentView = state.getActiveWebview();
    if (currentView) {
        // Direct webview src navigation
        currentView.src = validatedInput;
    }
}

function initNavigationListeners() {
    if (state.goBtn) state.goBtn.addEventListener('click', navigate);
    if (state.urlInput) {
        state.urlInput.addEventListener('focus', (e) => e.target.select());
        state.urlInput.addEventListener('keypress', (e) => { 
            if (e.key === 'Enter') navigate(); 
        });
    }
    
    if (state.backBtn) {
        state.backBtn.addEventListener('click', () => { 
            const view = state.getActiveWebview();
            if (view && view.canGoBack()) view.goBack(); 
        });
    }

    if (state.reloadBtn) {
        state.reloadBtn.addEventListener('click', () => {
            const view = state.getActiveWebview();
            if (view) view.reload();
        });
    }

    if (state.toggleAiBtn && state.aiContainer) {
        state.toggleAiBtn.addEventListener('click', () => {
            state.aiContainer.classList.toggle('hidden');
        });
    }

    if (state.searchEngineSelect) {
        state.searchEngineSelect.addEventListener('change', (e) => {
            if (!state.preferences) state.preferences = {};
            state.preferences.searchEngineScheme = e.target.value;
        });
    }

    if (state.aiAssistantSelect && state.aiView) {
        state.aiAssistantSelect.addEventListener('change', (e) => {
            state.aiView.setAttribute('src', e.target.value);
        });
    }

    if (state.ipcRenderer) {
        state.ipcRenderer.on('set-user-preferences', (event, prefs) => {
            console.log('[App] Received preferences from setup:', prefs);
            if (prefs.searchEngine) {
                if (!state.preferences) state.preferences = {};
                state.preferences.searchEngineScheme = prefs.searchEngine;
                if (state.searchEngineSelect) state.searchEngineSelect.value = prefs.searchEngine;
            }
            if (prefs.aiAssistant && state.aiView) {
                state.aiView.setAttribute('src', prefs.aiAssistant);
                if (state.aiAssistantSelect) state.aiAssistantSelect.value = prefs.aiAssistant;
            }
        });
    }
}

function toggleStatusText() {
    document.querySelectorAll('#status-footer p').forEach(p => {
        p.style.display = (p.style.display === 'none' ? 'inline-block' : 'none');
    });
}
window.toggleStatusText = toggleStatusText;

window.addEventListener('message', async (event) => {
    if (event.data && event.data.type === 'SET_SEARCH_ENGINE') {
        console.log("SEARCH ENGINE EVENT")
        const { engineUrl } = event.data;
        
        try {
            // Forward selection to main process to write to defaultPrefs.json
            await ipcRenderer.invoke('set-search-engine', engineUrl);
        } catch (err) {
            console.warn('[Navigation] IPC set-search-engine failed:', err);
        }
    }
});

module.exports = {
    navigate,
    initNavigationListeners
};