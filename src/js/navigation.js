// Navigation & Toolbar Management Module
const state = require('./state.js');

async function navigate() {
    const rawInput = state.urlInput.value.trim();
    if (!rawInput) return;

    const tld = /^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/;
    const isDomain = tld.test(rawInput);
    const isLink = /\w+:\/\//.test(rawInput);

    let validatedInput = await state.checkSearch(rawInput);
    if (!validatedInput) {
        state.messageText.innerText = `x_x navigation blocked: "${rawInput}"`;
        return;
    }

    if (rawInput.startsWith("data:")) {
        validatedInput = rawInput
        state.urlInput.innerText = ""
    }else
    if (!isLink && isDomain) {
        validatedInput = 'https://' + validatedInput;
    } else if (!isLink && !isDomain) {
        validatedInput = state.preferences.searchEngineScheme + encodeURIComponent(validatedInput);
    }

    const currentView = state.getActiveWebview();
    if (currentView) {
        displayCurrentView(validatedInput)
        currentView.setAttribute('src', validatedInput);
    }
}



function initNavigationListeners() {
    state.goBtn.addEventListener('click', navigate);
    state.urlInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') navigate(); });
    
    state.backBtn.addEventListener('click', () => { 
        const view = state.getActiveWebview();
        if (view && view.canGoBack()) view.goBack(); 
    });

    state.reloadBtn.addEventListener('click', () => {
        const view = state.getActiveWebview();
        if (view) view.reload();
    });

    if (state.toggleAiBtn && state.aiContainer) {
        state.toggleAiBtn.addEventListener('click', () => {
            state.aiContainer.classList.toggle('hidden');
        });
    }

    if (state.searchEngineSelect) {
        state.searchEngineSelect.addEventListener('change', (e) => {
            state.preferences.searchEngineScheme = e.target.value;
        });
    }

    if (state.aiAssistantSelect && state.aiView) {
        state.aiAssistantSelect.addEventListener('change', (e) => {
            state.aiView.setAttribute('src', e.target.value);
        });
    }

    state.ipcRenderer.on('set-user-preferences', (event, prefs) => {
        console.log('[App] Received preferences from setup:', prefs);
        if (prefs.searchEngine) {
            state.preferences.searchEngineScheme = prefs.searchEngine;
            if (state.searchEngineSelect) state.searchEngineSelect.value = prefs.searchEngine;
        }
        if (prefs.aiAssistant && state.aiView) {
            state.aiView.setAttribute('src', prefs.aiAssistant);
            if (state.aiAssistantSelect) state.aiAssistantSelect.value = prefs.aiAssistant;
        }
    });
}

function toggleStatusText() {
    document.querySelectorAll('#status-footer p').forEach(p => {
        p.style.display = (p.style.display === 'none' ? 'inline-block' : 'none');
    });
}
window.toggleStatusText = toggleStatusText;

module.exports = {
    navigate,
    initNavigationListeners
};