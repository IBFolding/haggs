#!/usr/bin/env python3
"""Build a reproducible offline node-only installer ZIP from the checked-in packs."""
import hashlib
import json
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo

ROOT = Path(__file__).resolve().parent.parent
PACKS = {
    'ComfyUI-HaggsContestLab': ROOT / 'public/workflows/contest-lab/custom_nodes/ComfyUI-HaggsContestLab',
    'ComfyUI-HaggsGameDirector': ROOT / 'public/workflows/game-director/custom_nodes/ComfyUI-HaggsGameDirector',
    'ComfyUI-HaggsStudio': ROOT / 'public/workflows/world-motion-vfx/custom_nodes/ComfyUI-HaggsStudio',
}
DEST = ROOT / 'public/workflows/haggs-local-node-installer.zip'
files = {
    'install.py': (ROOT / 'tools/haggs-comfy-installer/install.py').read_bytes(),
    'README.txt': (ROOT / 'tools/haggs-comfy-installer/README.txt').read_bytes(),
}
for pack in ('contest-lab', 'game-director', 'world-motion-vfx'):
    files[f'licenses/{pack}-LICENSE.txt'] = (ROOT / 'public/workflows' / pack / 'LICENSE').read_bytes()
checksums = {}
for name, source in PACKS.items():
    for path in sorted(source.rglob('*')):
        if path.is_symlink():
            raise ValueError(f'Unexpected symlink: {path}')
        if path.is_file() and '__pycache__' not in path.parts and path.name != '.DS_Store':
            key = f'nodes/{name}/{path.relative_to(source).as_posix()}'
            files[key] = path.read_bytes()
            checksums[key] = hashlib.sha256(files[key]).hexdigest()
files['SHA256.json'] = (json.dumps(checksums, indent=2, sort_keys=True) + '\n').encode()
with ZipFile(DEST, 'w') as archive:
    for name, data in sorted(files.items()):
        info = ZipInfo('Haggs-Comfy-Nodes/' + name, (2020, 1, 1, 0, 0, 0))
        info.compress_type = ZIP_DEFLATED
        info.external_attr = 0o644 << 16
        archive.writestr(info, data)
print(f'Built {DEST.relative_to(ROOT)} ({len(checksums)} node files, no model weights)')
