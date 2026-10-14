const { clipboard } = require('electron');

const MAX_CHARS = 4000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- helpers ----------

function trackReady(view) {
    let ready = false;
    view.addEventListener('dom-ready', () => { ready = true; });
    view.addEventListener('did-finish-load', () => { ready = true; });
    return () => ready;
}

function writeClipboard(text) {
    try {
        clipboard.writeText(text);
    } catch (e) {
        navigator.clipboard.writeText(text).catch(() => {});
    }
}

function flash(btn, label, ok = true) {
    const original = btn.dataset.label || btn.innerText;
    btn.dataset.label = original;
    btn.innerText = label;
    btn.style.borderColor = ok ? '#8ab4f8' : '#f28b82';
    setTimeout(() => {
        btn.innerText = original;
        btn.style.borderColor = '#3d3d3d';
    }, 2000);
}

// ---------- scripts that run INSIDE the webviews ----------

const READ_PAGE_SCRIPT = `
(function () {
    try {
        var sel = (window.getSelection() || '').toString().trim();
        var body = document.body ? document.body.innerText : '';
        return {
            title: document.title || 'Untitled Page',
            url: location.href || '',
            selection: sel,
            text: body.substring(0, ${MAX_CHARS})
        };
    } catch (e) { return null; }
})()
`;

const READ_SELECTION_SCRIPT = `(window.getSelection() || '').toString().trim()`;

// AI Assistant selectors (Supports Gemini, ChatGPT, Claude DOM structures)
const AI_REPLY_SELECTORS = [
    'model-response message-content',
    'message-content .markdown',
    '.model-response-text',
    '.response-container',
    '.message-content',
    'div[data-message-author-role="assistant"]'
];

const AI_INPUT_SELECTORS = [
    'rich-textarea .ql-editor',
    'div.ql-editor[contenteditable="true"]',
    'div[contenteditable="true"][role="textbox"]',
    'textarea',
    'p[data-placeholder]'
];

const READ_AI_REPLY_SCRIPT = `
(function () {
    var selectors = ${JSON.stringify(AI_REPLY_SELECTORS)};
    for (var i = 0; i < selectors.length; i++) {
        var nodes = document.querySelectorAll(selectors[i]);
        if (nodes.length) return nodes[nodes.length - 1].innerText.trim();
    }
    return '';
})()
`;

const insertIntoAiScript = (text) => `
(function () {
    var selectors = ${JSON.stringify(AI_INPUT_SELECTORS)};
    var el = null;
    for (var i = 0; i < selectors.length; i++) {
        el = document.querySelector(selectors[i]);
        if (el) break;
    }
    if (!el) return false;
    el.focus();
    if (el.tagName === 'TEXTAREA') {
        el.value = ${JSON.stringify(text)};
        el.dispatchEvent(new Event('input', { bubbles: true }));
        return true;
    }
    document.execCommand('selectAll', false, null);
    return document.execCommand('insertText', false, ${JSON.stringify(text)});
})()
`;

const FOCUS_AI_INPUT_SCRIPT = `
(function () {
    var selectors = ${JSON.stringify(AI_INPUT_SELECTORS)};
    for (var i = 0; i < selectors.length; i++) {
        var el = document.querySelector(selectors[i]);
        if (el) { el.focus(); return true; }
    }
    return false;
})()
`;

const insertIntoPageScript = (text) => `
(function () {
    var el = document.activeElement;
    if (!el || el === document.body) return 'no-focus';
    var editable = el.isContentEditable ||
        el.tagName === 'TEXTAREA' ||
        (el.tagName === 'INPUT' && /^(text|search|url|email|)$/i.test(el.type));
    if (!editable) return 'not-editable';
    return document.execCommand('insertText', false, ${JSON.stringify(text)}) ? 'ok' : 'failed';
})()
`;

// ---------- main ----------

function initContextBridge(els) {
    const { workView, geminiView: aiView, geminiContainer: aiContainer,
            toPageBtn, toGeminiBtn: toAiBtn, messageText } = els;

    for (const [name, el] of Object.entries(els)) {
        if (!el) {
            console.error(`[context bridge] missing element: ${name}`);
            if (messageText) messageText.innerText = `Missing element: ${name} (check HTML IDs)`;
            return;
        }
    }

    const workReady = trackReady(workView);
    const aiReady = trackReady(aiView);

    // ===== Page -> AI =====
    toAiBtn.addEventListener('click', async () => {
        if (!workReady()) {
            messageText.innerText = 'Wait for the page to finish loading!';
            return;
        }

        try {
            const data = await workView.executeJavaScript(READ_PAGE_SCRIPT);
            const body = data && (data.selection || data.text);
            if (!body) {
                messageText.innerText = 'Could not read text from this page.';
                return;
            }

            const label = data.selection ? 'Selected text' : 'Content';
            const context =
                `[Context from current tab]\nTitle: ${data.title}\nURL: ${data.url}\n\n${label}:\n${body}\n\n[Prompt]: `;

            writeClipboard(context);

            if (aiContainer.classList.contains('hidden')) {
                aiContainer.classList.remove('hidden');
                await sleep(350);
            }

            if (!aiReady()) {
                flash(toAiBtn, 'Copied (AI loading)');
                return;
            }

            aiView.focus();
            await sleep(80);

            let inserted = await aiView.executeJavaScript(insertIntoAiScript(context));

            if (!inserted) {
                const focused = await aiView.executeJavaScript(FOCUS_AI_INPUT_SCRIPT);
                if (focused) {
                    aiView.paste();
                    inserted = true;
                }
            }

            flash(toAiBtn, inserted ? 'Sent to AI!' : 'Copied (paste manually)');
            if (!inserted) {
                messageText.innerText = "Couldn't find AI prompt box. Context is on your clipboard.";
            }
        } catch (err) {
            console.error('Page -> AI error:', err);
            messageText.innerText = `Failed to send context to AI: ${err.message}`;
            flash(toAiBtn, 'Failed', false);
        }
    });

    // ===== AI -> Page =====
    toPageBtn.addEventListener('click', async () => {
        if (!aiReady()) {
            messageText.innerText = 'AI assistant is still loading.';
            return;
        }

        try {
            let reply = await aiView.executeJavaScript(READ_SELECTION_SCRIPT);
            if (!reply) reply = await aiView.executeJavaScript(READ_AI_REPLY_SCRIPT);

            if (!reply) {
                messageText.innerText = 'No AI reply found.';
                return;
            }

            writeClipboard(reply);

            let result = 'no-focus';
            if (workReady()) {
                workView.focus();
                await sleep(80);
                result = await workView.executeJavaScript(insertIntoPageScript(reply));

                if (result === 'failed') {
                    workView.paste();
                    result = 'ok';
                }
            }

            flash(toPageBtn, result === 'ok' ? 'Inserted!' : 'Copied to clipboard');
            if (result !== 'ok') {
                messageText.innerText = 'Copied reply. Click a text field on the page first, then press the button.';
            }
        } catch (err) {
            console.error('AI -> Page error:', err);
            messageText.innerText = `Failed to read AI reply: ${err.message}`;
            flash(toPageBtn, 'Failed', false);
        }
    });
}

module.exports = { initContextBridge };