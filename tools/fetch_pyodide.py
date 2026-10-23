"""Fetch the pinned browser Python runtime and verify package wheel hashes.

Run once before offline workshops. All requests go to the pinned official
Pyodide distribution on jsDelivr; learners' code/data are never uploaded.
"""
from concurrent.futures import ThreadPoolExecutor
from hashlib import sha256
import json
from pathlib import Path
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / 'site/assets/python-runtime'
VERSION = '0.27.7'
BASE = f'https://cdn.jsdelivr.net/pyodide/v{VERSION}/full/'


def fetch(name, expected=None):
    path = DEST / name
    if not path.exists() or expected and sha256(path.read_bytes()).hexdigest() != expected:
        with urlopen(BASE + name, timeout=90) as response:
            data = response.read()
        if expected and sha256(data).hexdigest() != expected:
            raise ValueError(f'Upstream package checksum mismatch: {name}')
        path.write_bytes(data)
    return {'file': name, 'sha256': sha256(path.read_bytes()).hexdigest(), 'bytes': path.stat().st_size}


if __name__ == '__main__':
    DEST.mkdir(parents=True, exist_ok=True)
    for name, url in {
        'LICENSE-PYODIDE': f'https://raw.githubusercontent.com/pyodide/pyodide/{VERSION}/LICENSE',
        'LICENSE-CPYTHON': 'https://raw.githubusercontent.com/python/cpython/v3.12.7/LICENSE',
    }.items():
        license_path = DEST / name
        if not license_path.exists():
            with urlopen(url, timeout=30) as response:
                license_path.write_bytes(response.read())
    fetch('pyodide-lock.json')
    lock = json.loads((DEST/'pyodide-lock.json').read_text())
    assert lock['info']['version'] == VERSION
    packages = set()
    def add(name):
        if name in packages:
            return
        packages.add(name)
        for dependency in lock['packages'][name]['depends']:
            add(dependency)
    for package in ['numpy', 'pandas', 'matplotlib']:
        add(package)
    files = [(name, None) for name in ['pyodide.mjs','pyodide.asm.js','pyodide.asm.wasm','python_stdlib.zip']]
    files += [(lock['packages'][name]['file_name'], lock['packages'][name]['sha256']) for name in sorted(packages)]
    with ThreadPoolExecutor(max_workers=6) as pool:
        manifest = list(pool.map(lambda entry: fetch(*entry), files))
    (DEST/'runtime-manifest.json').write_text(json.dumps({'version': VERSION, 'source': BASE, 'files': manifest}, indent=2)+'\n')
    print(f'Browser Python {VERSION}: {len(files)} files, {sum(f["bytes"] for f in manifest)/1e6:.1f} MB; wheel checksums verified.')
