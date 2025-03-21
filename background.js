// Set default values on installation
chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.set({
        extensionEnabled: true,
        pipEnabled: false
    }, () => {
        console.log('MisterTube extension initialized with default settings');
    });
});

// Listen for messages from popup or content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'clearHistory') {
        chrome.tabs.create({ url: 'https://www.youtube.com/feed/history' }, (tab) => {
            // Wait for page to load
            setTimeout(() => {
                chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    function: () => {
                        const clearBtn = document.querySelector('button[aria-label="Clear all watch history"]');
                        if (clearBtn) {
                            clearBtn.click();
                            setTimeout(() => {
                                const confirmBtn = document.querySelector('tp-yt-paper-button[aria-label="Clear watch history"]');
                                if (confirmBtn) confirmBtn.click();
                            }, 1000);
                        }
                    }
                });
            }, 2000);
        });
        return true;
    }
});