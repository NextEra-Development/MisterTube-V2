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
        // Page-context <link href="chrome-extension://...styles.css"> is blocked by YouTube's CSP.
        // Insert through the extension engine instead.
        const tabId = sender && sender.tab && sender.tab.id;
        if (tabId === undefined) {
            sendResponse({ ok: false, error: 'insertStyles needs a tab' });
            return false;
        }
        try {
            chrome.scripting.insertCSS({ target: { tabId }, files: ['styles.css'] }, () => {
                const err = chrome.runtime.lastError;
                sendResponse(err ? { ok: false, error: err.message } : { ok: true });
            });
        } catch (error) {
            sendResponse({ ok: false, error: String(error) });
            return false;
        }
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
// Reports the final outcome via done(result) instead of only logging.
function clearWatchHistory(done) {
    try {
        chrome.tabs.create({ url: 'https://www.youtube.com/feed/history' }, (tab) => {
            if (chrome.runtime.lastError || !tab || tab.id === undefined) {
                console.warn('MisterTube: could not open history tab:', chrome.runtime.lastError && chrome.runtime.lastError.message);
                done({ ok: false, reason: 'tab-create-failed' });
                return;
            }
            waitForTabComplete(tab.id, 20000).then((completed) => {
                if (!completed) {
                    console.warn('MisterTube: history tab never finished loading; leaving it open');
                    done({ ok: false, reason: 'load-timeout' });
                    return;
                }
                chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    func: clearHistoryInPage
                }, (results) => {
                    if (chrome.runtime.lastError) {
                        console.warn('MisterTube: history clear script failed:', chrome.runtime.lastError.message);
                        done({ ok: false, reason: 'script-failed' });
                        return;
                    }
                    const result = results && results[0] && results[0].result;
                    if (result && result.ok) {
                        chrome.tabs.remove(tab.id, () => void chrome.runtime.lastError);
                        done({ ok: true });
                    } else {
                        console.warn('MisterTube: history not cleared:', result && result.reason ? result.reason : 'unknown reason');
                        done(result && result.ok === false ? result : { ok: false, reason: 'unknown' });
                    }
                });
            }).catch(() => done({ ok: false, reason: 'exception' }));
        });
    } catch (error) {
        console.warn('MisterTube: clearWatchHistory failed:', error);
        done({ ok: false, reason: 'exception' });
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
async function clearHistoryInPage() {
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
    if (!clearBtn) return { ok: false, reason: 'clear-button-not-found' };
    clearBtn.click();

    const dialog = await pollFor(findConfirmDialog, 10000);
    if (!dialog) return { ok: false, reason: 'no-confirm-dialog' };
    const confirmBtn = findConfirmButton(dialog);
    if (!confirmBtn) return { ok: false, reason: 'confirm-button-not-found' };
    // Final guard: dialog must still be open and visible at the click site
    if (!isVisible(dialog)) return { ok: false, reason: 'dialog-closed' };
    confirmBtn.click();
    return { ok: true };
}
