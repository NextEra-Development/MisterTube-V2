# MisterTube

A lightweight, privacy-respecting, open-source browser extension that cleans up YouTube and puts you back in control of what you watch — **no accounts, no tracking, no data leaves your browser**.

![MisterTube Logo](youtube-enhancer/icons/icon128.png)

> **Status:** Active development (Manifest V2, Firefox ≥ 57 and compatible MV2 forks). Found a bug? Open an issue — reports from users are what drive each release.

---

## ✨ Features

Every feature can be toggled independently from the MisterTube popup, live (no reload needed), and everything resets cleanly when turned off.

| Feature | What it does |
| --- | --- |
| 🎬 **VidPlayz** | Cleaner video player: rounded corners, centered layout, hidden ad banners and promotional shelves, playlist-friendly layout — along with 1-click **Focus Mode** and a **speed dropdown (0.5x–2x)** in the player controls |
| 💬 **Disable Comments** | Removes the comments section as a whole while enabled; turn it off and comments come straight back |
| ⛔ **Shortz Block** | Hides Shorts everywhere — sidebar, tabs, homepage shelf, search results — and redirects any `/shorts/` page back to the homepage |
| 🖼️ **Show video frames** | Replaces carefully engineered uploader thumbnails with a plain still frame from the video, so you browse based on what a video actually is. Toggle off to restore the original thumbnails instantly |
| 🚀 **Performance** | No persistent background page, no tracking scripts, no page-context injection — a non-persistent event page and Firefox's CSP-safe content-script APIs |

**Sidebar recommendation cleanup:** on ordinary watch pages the right-hand recommendations rail is hidden and the video is centered; open a URL with a playlist (`&list=`) and the rail returns so you can manage the queue.

---

## 📦 Installation

Manifest V2 builds are not installable from addons.mozilla.org until this extension is signed and published there. Until then:

1. Download or clone this repository:
   ```bash
   git clone https://github.com/NextEra-Development/MisterTube-V2.git
   cd MisterTube-V2
   ```
2. Open `about:debugging` in Firefox
3. Click **This Firefox** → **Load Temporary Add-on…**
4. Select `youtube-enhancer/manifest.json`
5. Open a fresh YouTube tab and click the MisterTube icon to pick your features

> Temporary add-ons are removed when Firefox restarts. For a permanent install, sign a `.xpi` with your own keys and install it permanently, or install from the release page if/when one is published.
>
> Works in **Firefox ≥ 57** and Manifest V2-compatible forks.

---

## 🖱 Usage

Once installed, toggling the master switch (**Extension Status**) off disables everything at once (YouTube becomes 100% stock). Each feature card acts independently:

- **Focus mode** — click the eye icon in the player controls to dim the page and center the video
- **Speed control** — click the speed button (reads `1x`) in the player controls, then pick a speed from the dropdown
- **Disable Comments / Shortz Block / Show video frames** — flip the popup switch; changes apply immediately, and turning a feature off restores the original page state

Settings are stored in browser sync storage and persist across YouTube's page changes and browser restarts.

### Updating

When you pull new commits, go to `about:debugging` → **This Firefox** → click the **↻** button on MisterTube, and refresh your YouTube tabs.

---

## 🐞 Known Issues

- **TrustedHTML console warnings** — Firefox sometimes logs these page-internal warnings; they are harmless and do not affect the extension.
- **YouTube UI changes** — YouTube ships DOM changes frequently; if a selector-based feature (Shorts blocking, comment hiding) misses a new layout, open an issue with a screenshot and it gets picked up quickly.
- **Desktop only** — mobile browsers cannot load temporary add-ons.

---

## 🤝 Contributing

Contributions are welcome!

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes and run the checks:
   ```bash
   node --check youtube-enhancer/*.js youtube-enhancer/features/*.js
   node --test
   python3 -c "import json; json.load(open('youtube-enhancer/manifest.json'))"
   ```
4. Commit with a descriptive message (`feat: ...`, `fix: ...`, `docs: ...`)
5. Push to your fork and open a Pull Request

No dependency install needed — plain JavaScript, no build step.

---

## 🗂 Code Structure

```
youtube-enhancer/
├── manifest.json          # Extension configuration (Manifest V2)
├── content.js             # Feature loader: reads settings, applies feature
│                          # body-class CSS gates, enables/disables live
├── background.js          # MV2 event page: seeds defaults on install,
│                          # relays popup tab-reload messages
├── popup.html             # Popup UI (master switch + feature cards)
├── popup.js               # Popup storage writes
├── popup_styles.css       # Popup styles
├── features/
│   ├── vidplayer.js       # Enhanced video player (focus mode, speed, grid)
│   ├── vidplayer.css      # Player chrome, watch-page layout, rail collapse
│   ├── shortsblock.js     # Shorts blocking + /shorts/ redirect
│   ├── shortsblock.css    # Shorts hiding (guide, tabs, shelves, results)
│   ├── subs-comment.js    # Disable Comments (removes comments entirely)
│   ├── subs-comment.css   # Comments section rules
│   └── thumbnails.js      # Show video frames (frame swap with full restore)
├── tests/
│   └── thumbnails.test.js # Unit tests (standard library, no dependencies)
└── icons/                 # Extension icons (16 / 32 / 48 / 128)
```

**How it works:** every feature is a self-contained module exposing `init()`/`cleanup()` on `window.youtubeEnhancer`. `content.js` reads your toggles from `chrome.storage.sync`, applies a per-feature class gate on `<body>` so CSS only matches what you've enabled, and calls `init()`/`cleanup()` — so OFF always means *nothing running*, not just *hidden*.

---

## 📄 License

Licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Thanks to all contributors who have helped improve this extension
- Inspired by the open-source YouTube-enhancement community

---

**Made with ❤️ by Prarambha**
