#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

for f in background.js content.js popup.js; do
    node --check "$f"
done
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

# Manifest sanity: MisterTube-V3 pattern — styles are manifest-registered (CSP-exempt)
m = json.loads((root / 'manifest.json').read_text())
assert m['content_scripts'][0].get('css') == ['styles.css'], 'styles.css must be declared in content_scripts (CSP-exempt)'
assert set(m['permissions']) == {'storage', 'scripting'}, f"unexpected permissions: {m['permissions']}"
assert 'styles.css' not in m['web_accessible_resources'][0]['resources'], 'styles.css is registered via content_scripts, not page-linked'
assert m['background']['service_worker'] == 'background.js'
for p in list(m['icons'].values()) + [m['action']['default_icon'], 'icons/trash.png']:
    assert (root / p).exists(), f'missing {p}'
print('manifest OK')
PY

grep -q "btn.type = 'button'" content.js && echo "button type OK"
grep -q 'yt-navigate-finish' content.js && echo "SPA re-run OK"
grep -q 'onRemoved' background.js && echo "listener cleanup OK"
grep -q 'getManifest().version' popup.js && echo "version from manifest OK"
grep -q 'mistertube-enabled' content.js && echo "enabled-class toggle OK"
grep -q 'mistertube-enabled' styles.css && echo "CSS gated to enabled class OK"
if grep -q 'moz-range-thumb' styles.css; then exit 1; else echo "dead CSS removed OK"; fi
if grep -q '\.footer a' popup.css; then exit 1; else echo "dead footer rules removed OK"; fi

if [ -f firefox/manifest.json ]; then
    node --check firefox/background.js
    python3 - <<'PYCHECK'
import json
import pathlib
root = pathlib.Path('.')
fm = json.loads((root / 'firefox' / 'manifest.json').read_text())
assert fm['manifest_version'] == 2
assert fm['background'].get('scripts') == ['background.js'], 'MV2 uses background scripts'
assert 'service_worker' not in fm.get('background', {})
assert fm['content_scripts'][0].get('css') == ['styles.css'], 'MV2 styles must be declared in content_scripts (CSP-exempt)'
assert 'scripting' not in fm['permissions']
assert 'host_permissions' not in fm
assert '*://*.youtube.com/*' in fm['permissions']
assert 'default_popup' in fm['browser_action']
assert isinstance(fm['web_accessible_resources'], list) and all(isinstance(r, str) for r in fm['web_accessible_resources'])
assert fm['browser_specific_settings']['gecko']['id'].startswith('{')
for p in list(fm['icons'].values()) + [fm['browser_action']['default_icon'], 'background.js']:
    assert (root / 'firefox' / p).exists(), f'missing firefox/{p}'
for p in ['content.js', 'popup.js', 'popup.html', 'popup.css', 'styles.css']:
    assert (root / 'firefox' / p).exists(), f'missing firefox/{p}'
print('firefox MV2 manifest OK')
PYCHECK
fi

echo 'VERIFY PASS'
