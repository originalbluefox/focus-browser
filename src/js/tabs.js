// Tab Management Module
const { ipcRenderer } = require('electron');
const state = require('./state.js');

// Create New Tab Button dynamically so it stays right after the tabs


function createTab(initialUrl = 'https://google.com', initialTitle = 'New Tab') {

    // Is it a valid data tab?
    if (initialUrl.startsWith("data")) {
       }

    const tabId = 'tab-' + Date.now() + '-' + Math.floor(Math.random() * 1000);

    const webview = document.createElement('webview');
    webview.id = `view-${tabId}`;
    webview.src = initialUrl;
    webview.style.display = 'none'; 
    webview.setAttribute("parition", "persist:aether")
    state.workContainer.appendChild(webview);
    webview.addEventListener('dom-ready', () => {
        webview.executeJavaScript(`
            (function() {
                const select = document.getElementById('search-engine-select');
                if (select && !select.dataset.aetherBound) {
                    select.dataset.aetherBound = 'true';
                    select.addEventListener('change', (e) => {
                        console.log('[Aether IPC Bridge]', e.target.value);
                    });
                }
            })();
        `);
    });

    // Listen for console logs coming from the webview to relay them to index.js
    webview.addEventListener('console-message', async (e) => {
        if (e.message.startsWith('[Aether IPC Bridge]')) {
            const engineUrl = e.message.replace('[Aether IPC Bridge] ', '').trim();
            try {
                await ipcRenderer.invoke('set-search-engine', engineUrl);
                console.log('[Tabs] Synced search engine choice:', engineUrl);
            } catch (err) {
                console.warn('[Tabs] Failed to send search engine to main process:', err);
            }
        }
    });
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
    // Wipe the tab strip
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

         if (state.urlInput) {
                // If it's a data URI landing page, leave the input empty/clean
                if (!tab.url.startsWith('data:')) {
                    state.urlInput.value = tab.url;
                } else {
                    state.urlInput.value = '';
                }
            }
        state.tabStrip.appendChild(tabEl);
    });

    // Always append the `+` button directly after the newest/last tab


    state.tabStrip.insertAdjacentHTML('beforeend',`<button class="new-tab-btn" id="new-tab-btn" title="Open New Tab">+</button>`)
    const newTabBtn = document.getElementById("new-tab-btn")
    newTabBtn.addEventListener('click', () => createTabFromFile('../html/landing.html', 'New Tab'));

    // Add a dragable section
    state.tabStrip.insertAdjacentHTML("beforeend", `<div class="drag"></div>`)
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
            createTabFromFile("../html/error.html")
        }
    } catch (err) {
        console.error('[Tabs] Failed to read landing file:', err);
        createTab('https://google.com', title);
    }
}




// Listen for the request from the main process and invoke your existing tab creator
ipcRenderer.on('open-new-tab-request', (event, url) => {
  if (typeof createTab === 'function') {
    createTab(url, 'New Tab');
  }
});

ipcRenderer.on('open-guest-tab', (event, url) => {
  if (typeof createTab === 'function') {
    createTab(url, 'New Tab');
  }
});

function setupWebviewSecurity(webview) {
  // Prevent beforeunload dialogs from blocking window/tab closure
  webview.addEventListener('dom-ready', () => {
    const webContents = webview.getWebContents();
    if (webContents) {
      // Disable default dialog prompts triggered by onbeforeunload
      webContents.session.setPermissionRequestHandler((wc, permission, callback) => {
        if (permission === 'pointerLock' || permission === 'fullscreen') {
          callback(true);
        } else {
          callback(false);
        }
      });
    }
  });

  // Automatically dismiss or log guest page dialogs (alert, confirm, prompt)
  webview.addEventListener('ipc-message', (event) => {
    // Handle custom IPC triggers if using a preload script
  });
}
module.exports = {
    createTab,
    switchTab,
    closeTab,
    renderTabStrip,
    createHtmlTab,
    createTabFromFile
};