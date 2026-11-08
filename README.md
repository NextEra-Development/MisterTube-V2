# MisterTube

A focused, lightweight YouTube extension that strips the page down to what matters and stays out of the way. Plain watch pages center the player with no recommendation rail; a clean, full-width feed everywhere else; one-click watch-history clearing; everything resets cleanly when the switch is off.

Available for **Chromium browsers (MV3)** at the repo root and for **Firefox (MV2)** in `firefox/`. Both builds are generated from the same source and are byte-identical apart from the manifest.

## Features

| Feature | Detail |
| --- | --- |
| Full-width, rail-free feed | The left drawer, icon rail, Shorts shelves and promo sections are removed; the grid spans the full width |
| Clean watch page | Recommendation column hidden; player centered. Playlist playback keeps the queue panel (only plain watch is collapsed) |
| One knob on/off | Every rule is gated behind a single `mistertube-enabled` class the content script toggles. Off = factory YouTube |
| CSP-safe styling | CSS is registered through `content_scripts.css`, not injected into the page. No console spam, no extension URLs loaded in page context |
| Clear watch history | Trash icon next to the search magnifier opens the history page and clears it for you |
| Least-privilege | `storage` + `scripting` only (MV2 build: plus `tabs`) |

## Layout

```
.
├── manifest.json     # Chrome/Edge/Brave extension (Manifest V3)
├── background.js     # MV3 service worker: defaults, clear-history flow, tab reload
├── content.js        # Feature wiring (toggles, trash button, SPA re-run)
├── styles.css        # All custom styles; every rule is prefixed with `body.mistertube-enabled`
├── popup.*           # Action popup (master switch + clear history)
├── verify.sh         # Static verification gates (below)
├── firefox/          # Self-contained Manifest V2 build for Firefox ≥ 57
└── icons/
```

## Install (Chromium — MV3)

1. `git clone` this repository.
2. Open `chrome://extensions/`, enable **Developer mode**.
3. **Load unpacked** → select this directory.
4. Pin the extension; click it to toggle. Refresh open YouTube tabs for the change to take effect.

## Install (Firefox ≥ 57 — MV2)

Temporary/sideloaded (developers):
1. Open `about:debugging` → **This Firefox** → **Load Temporary Add-on…**
2. Select `firefox/manifest.json`.

Permanent (production): this requires a signed `.xpi` via [`web-ext sign`](https://extensionworkshop.com/documentation/develop/tutorials/getting-started-with-web-ext/) (an `amo`-issued key pair — bring your own).

## Development

Both builds are kept byte-identical; edit at the root, then mirror into `firefox/` (`firefox/` additionally carries its own MV2 `background.js` and the MV2 manifest with a distinct gecko UUID).

Verify everything with:

```bash
./verify.sh
```

It gates: JS syntax, NUL-byte hygiene, manifest shape (MV3 `service_worker`, MV2 `scripts`, declared `content_scripts.css`, least-privilege `permissions`, referenced icons present), enabled-class presence, and dead-rule removal. Browser-side smoke tests have been done headlessly on Chromium (`--pack-extension`); the signed-in watch-page flow is not automatable here and is a manual QA item.

## Known limits

- Watch-page layout selectors are attempted against YouTube's live DOM; YouTube ships DOM changes frequently — one `/watch` update can shift the layout. If the player column misaligns, check `ytd-watch-flexy`/`ytd-watch-next-secondary-results-renderer` on the current DOM first.
- Playlist queue panel only renders for playlist URLs (`?list=`); plain watch pages drop the recommendation column entirely.
- Signed-out YouTube shows API skeletons for comments that never resolve (not an extension issue — sign in to check it).

## Contributing

1. Branch from `main`.
2. Keep the Firefox tree byte-identical (`cp <file> firefox/<file>`) except its manifest/background.
3. Run `./verify.sh` before you push; match the existing commit style.
4. Open a PR against `main`. Keep PRs single-purpose; the service-worker repair, the live-layout migration, and the Firefox port landed as separate stacks.
