// Set default values on installation (never overwrite existing settings)
chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.get(['extensionEnabled', 'pipEnabled'], (current) => {
        if (chrome.runtime.lastError) {
            console.warn('MisterTube: could not read settings:', chrome.runtime.lastError.message);
            return;
        }
        const defaults = {};
        if (current.extensionEnabled === undefined) defaults.extensionEnabled = true;
        if (current.pipEnabled === undefined) defaults.pipEnabled = false;
        if (Object.keys(defaults).length === 0) return;
        chrome.storage.local.set(defaults, () => {
            if (chrome.runtime.lastError) {
                console.warn('MisterTube: could not write defaults:', chrome.runtime.lastError.message);
            } else {
                console.log('MisterTube extension initialized with default settings');
            }
        });
    });
});

// Listen for messages from popup or content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'insertStyles') {
        // Ext engine injection bypasses page CSP (link rel=stylesheet would be blocked).
        if (!sender || !sender.tab || sender.tab.id === undefined) {
            sendResponse({ ok: false, error: 'insertStyles needs a tab' });
            return false;
        }
        chrome.tabs.insertCSS(sender.tab.id, { file: 'styles.css' }, () => {
            const err = chrome.runtime.lastError;
            sendResponse(err ? { ok: false, error: err.message } : { ok: true });
        });
        return true; // async response
    }

    if (request.action === 'clearHistory') {
        clearWatchHistory((result) => sendResponse(result || { ok: false, reason: 'unknown' }));
        return true; // async response
    }

    if (request.action === 'reloadYouTubeTabs') {
        chrome.tabs.query({ url: '*://*.youtube.com/*' }, (tabs) => {
            if (chrome.runtime.lastError) {
                console.warn('MisterTube: tab query failed:', chrome.runtime.lastError.message);
                sendResponse({ ok: false });
                return;
            }
            tabs.forEach((tab) => {
                if (tab.id === undefined) return;
                try {
                    chrome.tabs.reload(tab.id, () => void chrome.runtime.lastError);
                } catch (error) {
                    console.warn('MisterTube: tab reload failed:', error);
                }
            });
            sendResponse({ ok: true, count: tabs.length });
        });
        return true; // async response
    }

    return false;
});

// Open the history page and clear it once it has finished loading.
// MV2 has no chrome.scripting.executeScript({func}) and no reliable cross-context promise
// results, so the injected page function reports back via a historyClearResult message.
function clearWatchHistory(done) {
    let tabId = null;
    let settled = false;
    const finish = (result) => {
        if (settled) return;
        settled = true;
        chrome.runtime.onMessage.removeListener(onClearResult);
        clearTimeout(guard);
        if (result && result.ok && tabId !== null) {
            chrome.tabs.remove(tabId, () => void chrome.runtime.lastError);
        } else {
            console.warn('MisterTube: history not cleared:', result && result.reason ? result.reason : 'unknown reason');
        }
        done(result);
    };
    const onClearResult = (request, sender) => {
        if (!request || request.action !== 'historyClearResult') return false;
        if (sender && sender.tab && tabId !== null && sender.tab.id !== tabId) return false;
        finish(request.result || { ok: false, reason: 'unknown' });
        return false;
    };
    chrome.runtime.onMessage.addListener(onClearResult);
    const guard = setTimeout(() => finish({ ok: false, reason: 'page-timeout' }), 60000);

    try {
        chrome.tabs.create({ url: 'https://www.youtube.com/feed/history' }, (tab) => {
            if (chrome.runtime.lastError || !tab || tab.id === undefined) {
                console.warn('MisterTube: could not open history tab:', chrome.runtime.lastError && chrome.runtime.lastError.message);
                finish({ ok: false, reason: 'tab-create-failed' });
                return;
            }
            tabId = tab.id;
            waitForTabComplete(tab.id, 20000).then((completed) => {
                if (!completed) {
                    console.warn('MisterTube: history tab never finished loading; leaving it open');
                    finish({ ok: false, reason: 'load-timeout' });
                    return;
                }
                chrome.tabs.executeScript(tab.id, { code: '(' + clearHistoryInPage.toString() + ')();' }, () => {
                    if (chrome.runtime.lastError) {
                        console.warn('MisterTube: history clear script failed:', chrome.runtime.lastError.message);
                        finish({ ok: false, reason: 'script-failed' });
                    }
                    // success/failure arrives later via historyClearResult
                });
            }).catch(() => finish({ ok: false, reason: 'exception' }));
        });
    } catch (error) {
        console.warn('MisterTube: clearWatchHistory failed:', error);
        finish({ ok: false, reason: 'exception' });
    }
}

// Resolves true when the tab completes loading, false on removal or timeout.
// Always removes its listeners.
function waitForTabComplete(tabId, timeoutMs) {
    return new Promise((resolve) => {
        let done = false;
        const finish = (value) => {
            if (done) return;
            done = true;
            chrome.tabs.onUpdated.removeListener(onUpdated);
            chrome.tabs.onRemoved.removeListener(onRemoved);
            clearTimeout(timer);
            resolve(value);
        };
        const onUpdated = (updatedTabId, changeInfo) => {
            if (updatedTabId === tabId && changeInfo.status === 'complete') finish(true);
        };
        const onRemoved = (removedTabId) => {
            if (removedTabId === tabId) finish(false);
        };
        const timer = setTimeout(() => finish(false), timeoutMs);

        try {
            chrome.tabs.get(tabId, (tab) => {
                if (chrome.runtime.lastError || !tab) {
                    finish(false);
                    return;
                }
                if (tab.status === 'complete') finish(true);
            });
        } catch (error) {
            finish(false);
        }
        chrome.tabs.onUpdated.addListener(onUpdated);
        chrome.tabs.onRemoved.addListener(onRemoved);
    });
}

// Runs inside the history page: clicks the clear button, then the confirm dialog.
// Self-contained (injected into the tab, no closure over this file's scope).
// Never clicks blindly: the confirm click only happens when an open dialog is present.
// Reports the outcome to the background page via historyClearResult.
async function clearHistoryInPage() {
    const report = (result) => {
        try {
            chrome.runtime.sendMessage({ action: 'historyClearResult', result });
        } catch (error) { /* extension context invalidated */ }
    };
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const pollFor = async (find, timeoutMs) => {
        const deadline = Date.now() + timeoutMs;
        while (Date.now() < deadline) {
            const hit = find();
            if (hit) return hit;
            await sleep(250);
        }
        return null;
    };

    const isVisible = (el) => {
        if (!el.isConnected) return false;
        const rect = el.getBoundingClientRect();
        if (!rect || rect.width === 0 || rect.height === 0) return false;
        for (let node = el; node; node = node.parentElement) {
            const cs = getComputedStyle(node);
            if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return false;
        }
        return true;
    };

    const findClearButton = () => {
        const fast = document.querySelector('button[aria-label="Clear all watch history"]')
            || document.querySelector('ytd-browse button[aria-label*="watch history" i]');
        if (fast && isVisible(fast)) return fast;
        const candidates = document.querySelectorAll('ytd-browse #header button, ytd-browse #buttons button');
        for (const button of candidates) {
            if (!isVisible(button)) continue;
            const label = (button.getAttribute('aria-label') || '') + ' ' + (button.textContent || '');
            if (/clear/i.test(label)) return button;
        }
        return null;
    };

    // A dialog only counts when it is actually open and visible; YouTube keeps hidden renderers in the DOM.
    const findConfirmDialog = () => {
        const candidates = document.querySelectorAll('tp-yt-paper-dialog[opened], ytd-confirm-dialog-renderer[opened], ytd-confirm-dialog-renderer tp-yt-paper-dialog[opened]');
        for (const candidate of candidates) {
            if (isVisible(candidate)) return candidate;
        }
        return null;
    };

    // Stay strictly scoped to the confirmed dialog element; never fall back to searching the page.
    const findConfirmButton = (dialog) => {
        if (!dialog) return null;
        const scripted = dialog.querySelector('#confirm-button button, tp-yt-paper-button[dialog-confirm], #confirm-button tp-yt-paper-button');
        if (scripted && isVisible(scripted)) return scripted;
        const elements = dialog.querySelectorAll('button, tp-yt-paper-button, ytd-button-renderer button');
        for (const el of elements) {
            if (!isVisible(el)) continue;
            const label = (el.getAttribute('aria-label') || '') + ' ' + (el.textContent || '');
            if (/clear/i.test(label)) return el;
        }
        return null;
    };

    const clearBtn = await pollFor(findClearButton, 20000);
    if (!clearBtn) { report({ ok: false, reason: 'clear-button-not-found' }); return; }
    clearBtn.click();

    const dialog = await pollFor(findConfirmDialog, 10000);
    if (!dialog) { report({ ok: false, reason: 'no-confirm-dialog' }); return; }
    const confirmBtn = findConfirmButton(dialog);
    if (!confirmBtn) { report({ ok: false, reason: 'confirm-button-not-found' }); return; }
    // Final guard: dialog must still be open and visible at the click site
    if (!isVisible(dialog)) { report({ ok: false, reason: 'dialog-closed' }); return; }
    confirmBtn.click();
    report({ ok: true });
}
