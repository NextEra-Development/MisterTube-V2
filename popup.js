document.addEventListener('DOMContentLoaded', () => {
    const toggleSwitch = document.getElementById('toggleSwitch');
    const pipToggle = document.getElementById('pipToggle');
    const statusText = document.getElementById('statusText');

    // Load saved settings
    chrome.storage.local.get(['extensionEnabled', 'pipEnabled'], (result) => {
        toggleSwitch.checked = result.extensionEnabled !== false;
        pipToggle.checked = result.pipEnabled === true;
        updateStatusText(toggleSwitch.checked);
    });

    // Toggle extension status handler
    toggleSwitch.addEventListener('change', (e) => {
        chrome.storage.local.set({ extensionEnabled: e.target.checked });
        updateStatusText(e.target.checked);

        // Notify background script to refresh YouTube tabs
        chrome.runtime.sendMessage({
            action: 'toggleExtension',
            enabled: e.target.checked
        });
    });

    // PiP toggle handler
    pipToggle.addEventListener('change', (e) => {
        chrome.storage.local.set({ pipEnabled: e.target.checked });

        // Refresh active YouTube tab to apply PiP changes
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0].url.includes('youtube.com')) {
                chrome.tabs.reload(tabs[0].id);
            }
        });
    });

    // Add click handler for clear history button (if exists)
    const clearHistoryBtn = document.getElementById('clearHistory');
    if (clearHistoryBtn) {
        clearHistoryBtn.addEventListener('click', () => {
            chrome.runtime.sendMessage({ action: 'clearHistory' });
        });
    }

    // Status update function
    function updateStatusText(enabled) {
        if (statusText) {
            statusText.textContent = enabled ? 'Extension active' : 'Extension paused';
            statusText.className = enabled ? 'status-active' : 'status-inactive';
        }
    }
});