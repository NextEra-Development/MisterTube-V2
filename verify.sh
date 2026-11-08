#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

node --check background.js
node --check content.js
node --check popup.js
echo "syntax OK"

python3 - <<'PY' || exit 1
import json
import pathlib
root = pathlib.Path('.')

# No NUL/control bytes anywhere in shipped text files
for f in ['background.js', 'content.js', 'popup.js', 'manifest.json', 'popup.html', 'popup.css', 'styles.css']:
    data = (root / f).read_bytes()
    assert b'\x00' not in data, f'NUL byte in {f}'
print('no NUL bytes')

m = json.loads((root / 'manifest.json').read_text())
assert m['manifest_version'] == 2, 'this repo targets Manifest V2 browsers'
assert m['background'].get('scripts') == ['background.js'], 'MV2 uses background scripts'
assert 'service_worker' not in m.get('background', {})
assert 'scripting' not in m['permissions']
assert 'host_permissions' not in m
assert '*://*.youtube.com/*' in m['permissions'], 'YouTube host permission must go through permissions in MV2'
assert 'storage' in m['permissions'] and 'tabs' in m['permissions']
assert 'default_popup' in m['browser_action']
assert 'css' in m['content_scripts'][0] and m['content_scripts'][0]['css'] == ['styles.css'], 'styles must be declared in content_scripts (CSP-exempt)'
assert 'js' in m['content_scripts'][0] and m['content_scripts'][0]['js'] == ['content.js']
assert isinstance(m['web_accessible_resources'], list) and all(isinstance(r, str) for r in m['web_accessible_resources'])
assert m['browser_specific_settings']['gecko']['id'].startswith('{')
for p in list(m['icons'].values()) + [m['browser_action']['default_icon'], 'icons/trash.png']:
    assert (root / p).exists(), f'missing {p}'
print('manifest OK')
PY

grep -q "btn.type = 'button'" content.js && echo "button type OK"
grep -q 'yt-navigate-finish' content.js && echo "SPA re-run OK"
grep -q 'mistertube-enabled' content.js && echo "enabled-class toggle OK"
grep -q 'mistertube-enabled' styles.css && echo "CSS gated to enabled class OK"
grep -q 'onRemoved' background.js && echo "listener cleanup OK"
grep -q 'getManifest().version' popup.js && echo "version from manifest OK"
if grep -q 'moz-range-thumb' styles.css; then exit 1; else echo "dead CSS removed OK"; fi
if grep -q '\.footer a' popup.css; then exit 1; else echo "dead footer rules removed OK"; fi

echo 'VERIFY PASS'
