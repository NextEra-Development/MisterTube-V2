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

# Manifest sanity
m = json.loads((root / 'manifest.json').read_text())
assert set(m['permissions']) == {'storage', 'scripting'}, f"unexpected permissions: {m['permissions']}"
assert 'css' not in m['content_scripts'][0], 'content_scripts must not inject styles.css'
for p in list(m['icons'].values()) + [m['action']['default_icon'], 'icons/trash.png']:
    assert (root / p).exists(), f'missing {p}'
assert 'styles.css' in m['web_accessible_resources'][0]['resources']
assert m['background']['service_worker'] == 'background.js'
print('manifest OK')
PY

grep -q "btn.type = 'button'" content.js && echo "button type OK"
grep -q 'yt-navigate-finish' content.js && echo "SPA re-run OK"
grep -q 'onRemoved' background.js && echo "listener cleanup OK"
grep -q 'getManifest().version' popup.js && echo "version from manifest OK"
if grep -q 'moz-range-thumb' styles.css; then exit 1; else echo "dead CSS removed OK"; fi
if grep -q '\.footer a' popup.css; then exit 1; else echo "dead footer rules removed OK"; fi

echo 'VERIFY PASS'
