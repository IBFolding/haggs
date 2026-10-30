# Playable atlas examples

The PNGs used by the free Playable demo are the original supplied files in `../previews/05-animation-moveset-builder-atlas.png` and `../previews/06-enemy-intent-painter-atlas.png`. They are deterministic pose/telegraph guide exports, not H3 generations.

The adjacent `*-atlas.json` interchange manifests were reconstructed from the supplied timeline metadata and the included exporter's 128px / eight-column layout. They are in the exact field format consumed from `HaggsAtlasExport`, but were not produced by a live ComfyUI wrapper run. The test `../tests/test_playable_exports.py` reproduces the PNG pixels and frame rectangles using the included `core.py` renderer and atlas function.

To try manual import, select the matching PNG and JSON in a Playable sprite slot. Do not select the timeline-only `*-metadata.json`: it contains a frame count, not atlas rectangles. Import does not require or call any inference provider. Action markers are planned ranges, and looping is opt-in. Telegraphed geometry is not imported as collision logic.
