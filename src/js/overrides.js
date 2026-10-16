// overrides.js

function windowOpen(createTabFn) {
  const originalWindowOpen = window.open;

  window.open = function (url, target, features) {
    if (url && typeof createTabFn === 'function') {
      const newTab = createTabFn(url, target || 'New Tab');

      // Return a basic mock window object to prevent third-party script crashes
      return {
        closed: false,
        close: () => {},
        focus: () => {},
        blur: () => {},
        postMessage: (msg, targetOrigin) => {
          if (newTab && newTab.contentWindow) {
            newTab.contentWindow.postMessage(msg, targetOrigin);
          }
        }
      };
    }
    return originalWindowOpen.apply(window, arguments);
  };
}

const overrides = (options = {}) => {
  if (options.createTab) {
    windowOpen(options.createTab);
  }
};

module.exports = { overrides };