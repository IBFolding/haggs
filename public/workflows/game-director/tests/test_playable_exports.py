"""Reproduce supplied deterministic exports; does not run ComfyUI or H3."""
import importlib.util
import json
from pathlib import Path
import numpy as np
from PIL import Image
import pytest

root = Path(__file__).parents[1]
spec = importlib.util.spec_from_file_location('playable_export_core', root / 'custom_nodes/ComfyUI-HaggsGameDirector/core.py')
core = importlib.util.module_from_spec(spec)
spec.loader.exec_module(core)


@pytest.mark.parametrize('slug', ['05-animation-moveset-builder', '06-enemy-intent-painter'])
def test_provided_atlas_pixels_and_reconstructed_manifest_match_core_export(slug):
    meta = json.loads((root / f'previews/{slug}-metadata.json').read_text())
    args = (json.dumps(meta), meta['width'], meta['height'], meta['frames'], meta['fps'])
    if slug.startswith('05'):
        frames, _ = core.render_poses(*args)
        mask = None
    else:
        frames, mask, _ = core.telegraph(*args)
    sheet, rectangles = core.atlas(frames, mask, 128, 8)
    assert np.array_equal(np.asarray(sheet), np.asarray(Image.open(root / f'previews/{slug}-atlas.png')))
    manifest = json.loads((root / f'playable-examples/{slug}-atlas.json').read_text())
    assert manifest['frames'] == rectangles
    assert manifest['fps'] == meta['fps']
