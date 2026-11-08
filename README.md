# MisterTube

A focused, lightweight YouTube extension that strips the page down to what matters and stays out of the way. Plain watch pages center the player with no recommendation rail; a clean, full-width feed everywhere else; one-click watch-history clearing; everything resets cleanly when the switch is off.

**Manifest V2 only.** This repository supports Firefox (≥ 57) and compatible Manifest V2 browsers (e.g. forks). The Manifest V3 line for Chromium browsers is maintained separately / upstream.

## Features

| Feature | Detail |
| --- | --- |
| Full-width, rail-free feed | The left drawer, icon rail, Shorts shelves and promo sections are removed; the grid spans the full width |
| Clean watch page | Recommendation column hidden; player centered. Playlist playback keeps the queue panel (only plain watch is collapsed) |
| One knob on/off | Every rule is gated behind a single `mistertube-enabled` class the content script toggles. Off = factory YouTube |
| CSP-safe styling | CSS is registered through `content_scripts.css`, not injected into the page. No console spam, no extension URLs loaded in page context |
| Clear watch history | Trash icon next to the search magnifier opens the history page and clears it for you |
| Least-privilege | `storage`, `tabs`, and the YouTube host permission only |

## Layout

```
.
├── manifest.json     # Manifest V2 (Firefox ≥ 57, compatible forks)
├── background.js     # Persistent MV2 background page: defaults, clear-history flow, tab reload
├── content.js        # Feature wiring (toggles, trash button, SPA re-run)
├── styles.css        # All custom styles; every rule is prefixed with `body.mistertube-enabled`
├── popup.*           # Action popup (master switch + clear history)
├── verify.sh         # Static verification gates (below)
└── icons/
```

## Install (Firefox ≥ 57)

Temporary/sideloaded (developers):
1. Open `about:debugging` → **This Firefox** → **Load Temporary Add-on…**
2. Select `manifest.json` in this directory.

Permanent (production): this requires a signed `.xpi` via [`web-ext sign`](https://extensionworkshop.com/documentation/develop/tutorials/getting-started-with-web-ext/) (an AMO-issued key pair — bring your own).

## Development

Verify everything with:

```bash
./verify.sh
```

It gates: JS syntax, NUL-byte hygiene, manifest shape (`manifest_version == 2`, `background.scripts`, declared `content_scripts.css`, least-privilege `permissions`, gecko id, referenced icons present), enabled-class presence, and dead-rule removal. Browser-side smoke tests are not automatable in this environment; a watch-page check on a live account is a manual QA item.

## Known limits

- Watch-page layout selectors are attempted against YouTube's live DOM; YouTube ships DOM changes frequently — one `/watch` update can shift the layout. If the player column misaligns, check `ytd-watch-flexy`/`ytd-watch-next-secondary-results-renderer` on the current DOM first.
- Playlist queue panel only renders for playlist URLs (`?list=`); plain watch pages drop the recommendation column entirely.
- Signed-out YouTube shows API skeletons for comments that never resolve (not an extension issue — sign in to check it).

## Contributing

1. Branch from `main`.
2. Run `./verify.sh` before you push; match the existing commit style.
3. Keep PRs single-purpose.
