document.addEventListener('DOMContentLoaded', () => {
    const toggleSwitch = document.getElementById('toggleSwitch');
    const statusText = document.getElementById('statusText');
    const versionText = document.getElementById('versionText');
    const clearHistoryBtn = document.getElementById('clearHistory');

    if (versionText) {
        versionText.textContent = 'v' + chrome.runtime.getManifest().version;
    }

    const sendMessage = (message, callback) => {
        try {
            chrome.runtime.sendMessage(message, (response) => {
                if (chrome.runtime.lastError) {
                    console.warn('[MisterTube]', chrome.runtime.lastError.message);
                    if (callback) callback(null);
                    return;
                }
                if (callback) callback(response);
            });
        } catch (error) {
            console.warn('[MisterTube]', error.message);
            if (callback) callback(null);
        }
    };

    // Load saved settings
    chrome.storage.local.get(['extensionEnabled'], (result) => {
        if (!toggleSwitch) return;
        if (chrome.runtime.lastError) {
            console.warn('[MisterTube]', chrome.runtime.lastError.message);
            return;
        }
        toggleSwitch.checked = result.extensionEnabled !== false;
        updateStatusText(toggleSwitch.checked);
    });

    // Toggle extension status handler
    if (toggleSwitch) {
        toggleSwitch.addEventListener('change', (e) => {
            chrome.storage.local.set({ extensionEnabled: e.target.checked }, () => {
                if (chrome.runtime.lastError) {
                    console.warn('[MisterTube]', chrome.runtime.lastError.message);
                    return;
                }
                updateStatusText(e.target.checked);
                // Reload open YouTube tabs so the change takes effect
                sendMessage({ action: 'reloadYouTubeTabs' });
            });
        });
    }

    // Clear history button with brief feedback
    if (clearHistoryBtn) {
        const label = clearHistoryBtn.querySelector('span');
        const originalLabel = label ? label.textContent : null;
        clearHistoryBtn.addEventListener('click', () => {
            clearHistoryBtn.disabled = true;
            if (label) label.textContent = 'Opening history…';
            sendMessage({ action: 'clearHistory' }, (response) => {
                const ok = !!(response && response.ok);
                if (label) label.textContent = ok ? 'History cleared' : 'Could not clear';
                setTimeout(() => {
                    clearHistoryBtn.disabled = false;
                    if (label && originalLabel !== null) label.textContent = originalLabel;
                }, ok ? 1500 : 2500);
            });
        });
    }

    // Status update function
    function updateStatusText(enabled) {
        if (statusText) {
            statusText.textContent = enabled ? 'Extension active' : 'Extension paused';
            statusText.classList.remove('status-active', 'status-inactive');
            statusText.classList.add(enabled ? 'status-active' : 'status-inactive');
        }
    }
});
