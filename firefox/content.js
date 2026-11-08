(function() {
    'use strict';

    const SELECTORS = {
        // Live YouTube removed form#search-form; the current search UI's row is .ytSearchboxComponentInputBox (yt-searchbox's internal form row)
        SEARCH_CONTAINER: '.ytSearchboxComponentInputBox, form#search-form, form.ytSearchboxComponentSearchForm',
        VOICE_BUTTON: '#voice-search-button',
        PIP_CONTAINER: 'div#pip-container'
    };

    const ENABLED_CLASS = 'mistertube-enabled';

    const READY_TIMEOUT = 15000;
    const NAVIGATE_DEBOUNCE = 300;

    let navigateTimer = null;

    function init() {
        // Check if extension is enabled
        chrome.storage.local.get(['extensionEnabled', 'pipEnabled'], (result) => {
            if (chrome.runtime.lastError || !result) {
                console.warn('[MisterTube]', (chrome.runtime.lastError && chrome.runtime.lastError.message) || 'settings could not be read');
                return;
            }
            const isEnabled = result.extensionEnabled !== false;

            // Gate all custom styling: manifest CSS only applies under this class
            setEnabledClass(isEnabled);

            if (!isEnabled) return;

            // Apply PiP enhancements if enabled
            if (result.pipEnabled) {
                applyPipEnhancements();
            }

            setupUI();
            document.addEventListener('yt-navigate-finish', handleNavigate);
        });
    }

    function handleNavigate() {
        clearTimeout(navigateTimer);
        navigateTimer = setTimeout(() => {
            setupUI();
        }, NAVIGATE_DEBOUNCE);
    }

    function setEnabledClass(enabled) {
        const root = document.documentElement;
        if (root) root.classList.toggle(ENABLED_CLASS, enabled);
        if (document.body) document.body.classList.toggle(ENABLED_CLASS, enabled);
    }

    function applyPipEnhancements() {
        if (!document.body) return;

        const existing = document.querySelector(SELECTORS.PIP_CONTAINER);
        if (existing) {
            existing.classList.add('enhanced-pip');
            return;
        }

        let frame = null;
        let finished = false;
        let timeout = null;

        const applyEnhancement = () => {
            const pipContainer = document.querySelector(SELECTORS.PIP_CONTAINER);
            if (!pipContainer || pipContainer.classList.contains('enhanced-pip')) return false;
            pipContainer.classList.add('enhanced-pip');
            return true;
        };

        const stop = () => {
            if (finished) return;
            finished = true;
            observer.disconnect();
            clearTimeout(timeout);
        };

        const observer = new MutationObserver(() => {
            if (frame !== null) return;
            frame = requestAnimationFrame(() => {
                frame = null;
                if (applyEnhancement()) stop();
            });
        });

        const target = document.querySelector('#movie_player') || document.body;
        observer.observe(target, {
            childList: true,
            subtree: true
        });

        timeout = setTimeout(stop, 30000);
    }

    function waitForElement(selector, timeoutMs) {
        return new Promise((resolve) => {
            const existing = document.querySelector(selector);
            if (existing) {
                resolve(existing);
                return;
            }

            let settled = false;

            const finish = (element) => {
                if (settled) return;
                settled = true;
                observer.disconnect();
                clearTimeout(timeout);
                resolve(element);
            };

            const observer = new MutationObserver(() => {
                const element = document.querySelector(selector);
                if (element) finish(element);
            });

            const timeout = setTimeout(() => finish(null), timeoutMs);

            observer.observe(document.documentElement, {
                childList: true,
                subtree: true
            });
        });
    }

    async function setupUI() {
        const [searchForm, voiceTarget] = await Promise.all([
            waitForElement(SELECTORS.SEARCH_CONTAINER, READY_TIMEOUT),
            waitForElement(`${SELECTORS.VOICE_BUTTON}, .trash-icon-btn`, READY_TIMEOUT)
        ]);

        if (searchForm) {
            addClearHistoryButton();
        }

        if (voiceTarget) {
            replaceVoiceSearch();
        }

    }

    function addClearHistoryButton() {
        const container = document.querySelector(SELECTORS.SEARCH_CONTAINER);
        if (!container || container.querySelector('.clear-history-btn')) return;

        const button = createButton({
            text: 'Clear History',
            bgColor: '#ff0000',
            className: 'clear-history-btn',
            handler: sendClearHistory
        });
        container.appendChild(button);
    }

    function replaceVoiceSearch() {
        if (document.querySelector('.trash-icon-btn')) return;

        const voiceButton = document.querySelector(SELECTORS.VOICE_BUTTON);
        if (!voiceButton) return;

        const iconButton = createButton({
            icon: 'icons/trash.png',
            className: 'trash-icon-btn',
            ariaLabel: 'Clear watch history',
            handler: sendClearHistory
        });
        voiceButton.replaceWith(iconButton);
    }

    function createButton({ text, icon, bgColor, handler, className, ariaLabel }) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.style.cssText = `
            margin-left: 10px;
            padding: 5px 10px;
            flex: 0 0 auto;
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

        if (text) {
            btn.textContent = text;
            btn.style.color = '#fff';
        }

        if (ariaLabel) {
            btn.setAttribute('aria-label', ariaLabel);
            btn.title = ariaLabel;
        }

        if (icon) {
            const img = document.createElement('img');
            img.src = chrome.runtime.getURL(icon);
            img.alt = '';
            img.style.width = '20px';
            btn.appendChild(img);
        }

        btn.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            handler(event);
        });

        return btn;
    }

    function sendClearHistory() {
        try {
            chrome.runtime.sendMessage({ action: 'clearHistory' }, () => {
                if (chrome.runtime.lastError) {
                    console.warn('[MisterTube]', chrome.runtime.lastError.message);
                }
            });
        } catch (error) {
            console.warn('[MisterTube]', error.message);
        }
    }

    // Initialize the extension when the DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
