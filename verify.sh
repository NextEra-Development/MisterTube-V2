#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

node --check youtube-enhancer/content.js
node --check youtube-enhancer/background.js
node --check youtube-enhancer/popup.js
for f in youtube-enhancer/features/*.js; do node --check "$f"; done
echo "syntax OK"

python3 - <<'PY' || exit 1
import json
import pathlib
root = pathlib.Path('.')
ext = root / 'youtube-enhancer'

# No NUL/control bytes anywhere in shipped text files
for f in ['manifest.json', 'background.js', 'content.js', 'popup.html', 'popup.js', 'popup_styles.css']:
    data = (ext / f).read_bytes()
    assert b'\x00' not in data, f'NUL byte in {f}'
for f in list((ext / 'features').glob('*.js')) + list((ext / 'features').glob('*.css')):
    data = f.read_bytes()
    assert b'\x00' not in data, f'NUL byte in {f}'
print('no NUL bytes')

m = json.loads((ext / 'manifest.json').read_text())
assert m['manifest_version'] == 2, 'this repo targets Manifest V2 browsers'
assert m['background'].get('scripts') == ['background.js'], 'MV2 uses background scripts'
assert m['background'].get('persistent') is False, 'event page, not persistent'
assert 'service_worker' not in m.get('background', {})
assert 'host_permissions' not in m
assert '*://*.youtube.com/*' in m['permissions'], 'YouTube host permission must go through permissions in MV2'
assert 'storage' in m['permissions'] and 'tabs' in m['permissions']
assert 'default_popup' in m['browser_action']
assert 'css' in m['content_scripts'][0] and m['content_scripts'][0]['css'] == ['features/vidplayer.css', 'features/subs-comment.css', 'features/shortsblock.css']
assert isinstance(m['web_accessible_resources'], list) and all(isinstance(r, str) for r in m['web_accessible_resources'])
assert m['browser_specific_settings']['gecko']['id'].startswith('{')
for p in list(m['icons'].values()) + [m['browser_action']['default_icon']]:
    assert (ext / p).exists(), f'missing {p}'
print('manifest OK')
PY

node --test 2>&1 | tail -1
grep -q 'youtube-enhancer-enabled' youtube-enhancer/content.js && echo "master class gate OK"
grep -q 'init()' youtube-enhancer/features/vidplayer.js && echo "feature modules OK"
grep -q 'SHORTZ BLOCK\|sblock' youtube-enhancer/popup.html && echo "feature toggles OK"
! grep -q 'chrome.scripting' youtube-enhancer/background.js && echo "no chrome.scripting OK"

echo 'VERIFY PASS'
