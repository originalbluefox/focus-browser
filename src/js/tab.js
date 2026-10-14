// Tab Management Module
const state = require('./state.js');

// Create New Tab Button dynamically so it stays right after the tabs
const newTabBtn = document.createElement('button');
newTabBtn.type = 'button';
newTabBtn.className = 'new-tab-btn';
newTabBtn.id = 'new-tab-btn';
newTabBtn.title = 'Open New Tab';
newTabBtn.innerText = '+';
newTabBtn.addEventListener('click', () => createTabFromFile('../html/landing.html', 'New Tab'));

function createTab(initialUrl = 'https://google.com', initialTitle = 'New Tab') {
    const tabId = 'tab-' + Date.now() + '-' + Math.floor(Math.random() * 1000);

    const webview = document.createElement('webview');
    webview.id = `view-${tabId}`;
    webview.src = initialUrl;
    webview.style.display = 'none'; 
    state.workContainer.appendChild(webview);

    webview.addEventListener('did-navigate', (e) => {
        if (tabId === state.activeTabId) {
            state.urlInput.value = e.url;
        }
        updateTabUrl(tabId, e.url);
    });

    webview.addEventListener('did-navigate-in-page', (e) => {
        if (e.isMainFrame && tabId === state.activeTabId) {
            state.urlInput.value = e.url;
        }
        updateTabUrl(tabId, e.url);
    });

    webview.addEventListener('page-title-updated', (e) => {
        updateTabTitle(tabId, e.title);
    });

    state.tabs.push({ id: tabId, title: initialTitle, url: initialUrl, webview });
    switchTab(tabId);
}

function switchTab(tabId) {
    state.activeTabId = tabId;

    state.tabs.forEach(tab => {
        if (tab.id === tabId) {
            tab.webview.style.display = 'flex';
            if (state.urlInput) {
                // If it's a data URI landing page, leave the input empty/clean
                if (!tab.url.startsWith('data:')) {
                    state.urlInput.value = tab.url;
                } else {
                    state.urlInput.value = '';
                }
            }
        } else {
            tab.webview.style.display = 'none';
        }
    });

    renderTabStrip();
}
function switchTab2(tabId) {
    activeTabId = tabId;

    tabs.forEach(tab => {
        if (tab.id === tabId) {
            tab.webview.style.display = 'flex';
            if (state.urlInput) {
                // If it's a data URI landing page, leave the input empty/clean
                if (!tab.url.startsWith('data:')) {
                    state.urlInput.value = tab.url;
                } else {
                    state.urlInput.value = '';
                }
            }
        } else {
            tab.webview.style.display = 'none';
        }
    });

    renderTabStrip();
}
function closeTab(tabId) {
    if (state.tabs.length === 1) return; // Keep at least one tab open

    const tabIndex = state.tabs.findIndex(t => t.id === tabId);
    if (tabIndex === -1) return;

    state.tabs[tabIndex].webview.remove();
    state.tabs.splice(tabIndex, 1);

    if (state.activeTabId === tabId) {
        const nextTab = state.tabs[tabIndex] || state.tabs[state.tabs.length - 1];
        switchTab(nextTab.id);
    } else {
        renderTabStrip();
    }
}

function updateTabUrl(tabId, url) {
    const tab = state.tabs.find(t => t.id === tabId);
    if (tab) {
        tab.url = url;
    }
}

function updateTabTitle(tabId, title) {
    const tab = state.tabs.find(t => t.id === tabId);
    if (tab) {
        tab.title = title.length > 20 ? title.substring(0, 18) + '...' : title;
        renderTabStrip();
    }
}

function renderTabStrip() {
    state.tabStrip.innerHTML = '';
    
    // Render all tabs
    state.tabs.forEach(tab => {
        const tabEl = document.createElement('div');
        tabEl.className = `tab ${tab.id === state.activeTabId ? 'active' : ''}`;
        tabEl.innerHTML = `
            <span>${tab.title}</span>
            <span class="tab-close" data-id="${tab.id}">×</span>
        `;

        tabEl.addEventListener('click', (e) => {
            if (e.target.classList.contains('tab-close')) {
                closeTab(e.target.getAttribute('data-id'));
            } else {
                switchTab(tab.id);
            }
        });

        state.tabStrip.appendChild(tabEl);
    });

    // Always append the `+` button directly after the newest/last tab
    state.tabStrip.appendChild(newTabBtn);
}
function createHtmlTab(htmlString, title = 'Landing Page') {
    const encodedHtml = 'data:text/html;charset=utf-8,' + encodeURIComponent(htmlString);
    createTab(encodedHtml, title);
    return encodedHtml;
    
}
function createTabFromFile(filePath, title = 'Landing Page') {
    try {
        // Resolve path relative to the current js directory
        const path = require('path')
        const fs = require('fs')
        const resolvedPath = path.resolve(__dirname, filePath);
        
        if (fs.existsSync(resolvedPath)) {
            const htmlContent = fs.readFileSync(resolvedPath, 'utf8');
            createHtmlTab(htmlContent, title);
        } else {
            console.warn('[Tabs] Landing file not found at:', resolvedPath);
            createTab('https://google.com', title);
        }
    } catch (err) {
        console.error('[Tabs] Failed to read landing file:', err);
        createTab('https://google.com', title);
    }
}
module.exports = {
    createTab,
    switchTab,
    closeTab,
    renderTabStrip,
    createHtmlTab,
    createTabFromFile
};