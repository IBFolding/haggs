#!/usr/bin/env python3
"""Copy the three bundled Haggs node packs into an existing local ComfyUI.

This does not install models, Python packages, or connect a hosted website to
localhost. Existing node folders are never overwritten.
"""
import argparse
import hashlib
import json
import shutil
import sys
from pathlib import Path

PACKS = ('ComfyUI-HaggsContestLab', 'ComfyUI-HaggsGameDirector', 'ComfyUI-HaggsStudio')
ROOT = Path(__file__).resolve().parent


def verify_bundle(root):
    manifest = json.loads((root / 'SHA256.json').read_text(encoding='utf-8'))
    if not isinstance(manifest, dict) or not manifest:
        raise ValueError('The node bundle is missing its checksum list.')
    actual = {}
    for pack in PACKS:
        directory = root / 'nodes' / pack
        if not directory.is_dir() or directory.is_symlink():
            raise ValueError(f'The {pack} folder is missing or is a link.')
        for path in directory.rglob('*'):
            if path.is_symlink():
                raise ValueError('The bundle contains an unexpected link.')
            if path.is_file():
                actual[path.relative_to(root).as_posix()] = hashlib.sha256(path.read_bytes()).hexdigest()
    if actual != manifest:
        raise ValueError('The node bundle failed its integrity check. Download it again.')


def install(root, target, apply=False):
    root = Path(root)
    target = Path(target).expanduser()
    verify_bundle(root)
    if target.name != 'custom_nodes' or not target.is_dir():
        raise ValueError('Choose the existing custom_nodes folder inside your ComfyUI installation.')
    conflicts = [name for name in PACKS if (target / name).exists() or (target / name).is_symlink()]
    if conflicts:
        raise ValueError('These folders already exist and were not changed: ' + ', '.join(conflicts))
    if not apply:
        return 'Ready to install: ' + ', '.join(PACKS) + '. No files changed.'
    installed = []
    try:
        for name in PACKS:
            # copytree refuses an existing destination; do not overwrite user nodes.
            shutil.copytree(root / 'nodes' / name, target / name, symlinks=False)
            installed.append(name)
    except OSError as error:
        # Preserve any copied files for inspection; never delete a user folder.
        raise RuntimeError('Installation stopped. The target may contain partially copied folders; no files were deleted. Completed: ' + (', '.join(installed) or 'none') + f'. {error}') from error
    return 'Installed: ' + ', '.join(installed) + '. Restart ComfyUI to load the nodes.'


def main():
    parser = argparse.ArgumentParser(description='Install Haggs custom nodes into an existing local ComfyUI.')
    parser.add_argument('custom_nodes', help='Path to the existing ComfyUI custom_nodes folder')
    parser.add_argument('--install', action='store_true', help='Copy files after the checks pass (without this flag, only check)')
    args = parser.parse_args()
    try:
        print(install(ROOT, args.custom_nodes, args.install))
    except (OSError, ValueError, RuntimeError, json.JSONDecodeError) as error:
        print(f'Not installed: {error}', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
