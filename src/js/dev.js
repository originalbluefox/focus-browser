class DeveloperTools {
  constructor() {
    this.preferences = null;
    this.tabs = null;
    this.getActiveWebview = null;
  }

  init(options = {}) {
    this.preferences = options.preferences || {};
    this.tabs = options.tabs || [];
    this.getActiveWebview = options.getActiveWebview || (() => null);

    // Auto-attach console listeners or DevTools shortcuts
    this.setupGlobalShortcuts();
  }

  // Open DevTools for the currently selected tab
  openActiveDevTools() {
    const webview = typeof this.getActiveWebview === 'function' ? this.getActiveWebview() : null;
    if (webview) {
      if (!webview.isDevToolsOpened()) {
        webview.openDevTools();
      } else {
        webview.closeDevTools();
      }
    } else {
      console.warn('[DevTools] No active webview available.');
    }
  }

  // Forward guest webview console logs to the main renderer console
  attachConsoleForwarding(webview) {
    if (!webview) return;
    webview.addEventListener('console-message', (e) => {
      console.log(`[Webview Tab Log] (Line ${e.line}): ${e.message}`);
    });
  }

  setupGlobalShortcuts() {
    // Listen for F12 or Ctrl+Shift+I to open DevTools on current tab
    window.addEventListener('keydown', (e) => {
      if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && e.key === 'I')) {
        e.preventDefault();
        this.openActiveDevTools();
      }
    });
  }
}

module.exports = { DeveloperTools };