(function() {
    'use strict';

    const SELECTORS = {
        SEARCH_CONTAINER: 'form#search-form',
        VOICE_BUTTON: '#voice-search-button',
        MINI_GUIDE: '#ytd-mini-guide-renderer',
        NOTIFICATION_BUTTON: '.ytd-notification-topbar-button-renderer',
        TARGET_ENTRY: 'ytd-mini-guide-entry-renderer:nth-of-type(4)',
        HIDDEN_ELEMENTS: [
            'ytd-guide-renderer',
            'ytd-rich-section-renderer',
            'ytd-reel-shelf-renderer'
        ],
        PIP_CONTAINER: 'div#pip-container'
    };

    const STYLE_URL = chrome.runtime.getURL('styles.css');
    let observerActive = false;

    function init() {
        // Check if extension is enabled
        chrome.storage.local.get(['extensionEnabled', 'pipEnabled'], (result) => {
            // Default to enabled if not set
            const isEnabled = result.extensionEnabled !== false;

            if (!isEnabled) return;

            // Apply PiP enhancements if enabled
            if (result.pipEnabled) {
                applyPipEnhancements();
            }

            injectStyles();
            setupUI();

            // Safely observe DOM
            if (!observerActive) {
                observeDOM();
                observerActive = true;
            }
        });
    }

    function applyPipEnhancements() {
        // Use MutationObserver to watch for PiP container
        const pipObserver = new MutationObserver(() => {
            const pipContainer = document.querySelector(SELECTORS.PIP_CONTAINER);
            if (pipContainer && !pipContainer.classList.contains('enhanced-pip')) {
                pipContainer.classList.add('enhanced-pip');
            }
        });

        pipObserver.observe(document.body, {
            childList: true,
            subtree: true
        });

        // Immediate check for existing PiP container
        const pipContainer = document.querySelector(SELECTORS.PIP_CONTAINER);
        if (pipContainer) {
            pipContainer.classList.add('enhanced-pip');
        }
    }

    function injectStyles() {
        // Prevent duplicate style injection
        if (!document.querySelector(`link[href="${STYLE_URL}"]`)) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = STYLE_URL;
            document.head.appendChild(link);
        }
    }

    function setupUI() {
        // Wait for UI elements to be available
        setTimeout(() => {
            addClearHistoryButton();
            replaceVoiceSearch();
            moveNotificationButton();
        }, 1500);
    }

    function addClearHistoryButton() {
        const container = document.querySelector(SELECTORS.SEARCH_CONTAINER);
        if (!container || container.querySelector('.clear-history-btn')) return;

        const button = createButton({
            text: 'Clear History',
            bgColor: '#ff0000',
            className: 'clear-history-btn',
            handler: clearHistory
        });
        container.appendChild(button);
    }

    function replaceVoiceSearch() {
        const voiceButton = document.querySelector(SELECTORS.VOICE_BUTTON);
        if (!voiceButton || voiceButton.dataset.replaced) return;

        const iconButton = createButton({
            icon: 'icons/trash.png',
            className: 'trash-icon-btn',
            handler: clearHistory
        });
        voiceButton.replaceWith(iconButton);
        iconButton.dataset.replaced = 'true';
    }

    function createButton({ text, icon, bgColor, handler, className }) {
        const btn = document.createElement('button');
        btn.style.cssText = `
            margin-left: 10px;
            padding: 5px 10px;
            background: ${bgColor || 'transparent'};
            border: none;
            border-radius: 5px;
            cursor: pointer;
            display: flex;
            align-items: center;
        `;

        if (className) {
            btn.className = className;
        }

        if (text) btn.textContent = text;
        if (icon) {
            const img = document.createElement('img');
            img.src = chrome.runtime.getURL(icon);
            img.style.width = '20px';
            btn.appendChild(img);
        }

        btn.addEventListener('click', handler);
        return btn;
    }

    function clearHistory() {
        chrome.tabs.create({ url: 'https://www.youtube.com/feed/history' }, (tab) => {
            // Use timeout to ensure page is loaded before script execution
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
    }

    function observeDOM() {
        // Create a throttled version of the observer callback
        let throttleTimeout = null;
        const throttleDelay = 200;

        const observer = new MutationObserver((mutations) => {
            if (throttleTimeout) return;

            throttleTimeout = setTimeout(() => {
                // Apply element hiding via CSS classes instead of removing elements
                document.querySelectorAll(SELECTORS.HIDDEN_ELEMENTS.join(', ')).forEach(el => {
                    if (!el.classList.contains('youtube-enhancer-hidden')) {
                        el.classList.add('youtube-enhancer-hidden');
                    }
                });

                // Ensure mini guide is shown
                const miniGuide = document.querySelector(SELECTORS.MINI_GUIDE);
                if (miniGuide && miniGuide.style.display !== 'block') {
                    miniGuide.style.display = 'block';
                }

                throttleTimeout = null;
            }, throttleDelay);
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    function moveNotificationButton() {
        // Only schedule the move once
        if (document.querySelector('.moved-notification-btn')) return;

        // Attempt to move the notification button
        const moveButton = () => {
            const notificationBtn = document.querySelector(SELECTORS.NOTIFICATION_BUTTON);
            const targetEntry = document.querySelector(SELECTORS.TARGET_ENTRY);

            if (notificationBtn && targetEntry && !notificationBtn.classList.contains('moved-notification-btn')) {
                targetEntry.parentNode.insertBefore(notificationBtn, targetEntry.nextSibling);
                notificationBtn.classList.add('moved-notification-btn');
                return true;
            }
            return false;
        };

        // Try immediately
        if (!moveButton()) {
            // If not successful, retry a few times
            let attempts = 0;
            const maxAttempts = 5;
            const interval = setInterval(() => {
                if (moveButton() || ++attempts >= maxAttempts) {
                    clearInterval(interval);
                }
            }, 1000);
        }
    }

    // Initialize the extension when the DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();