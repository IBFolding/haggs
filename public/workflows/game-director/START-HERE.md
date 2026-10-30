# Haggs Game Director — ComfyUI-only experimental pack

Six ideas, each with a local MiniMax H3 generation graph and a no-model preview graph. This is a separate add-on to the earlier seven-effects pack; it does not overwrite or depend on that pack.

## Install and first run

1. Copy `custom_nodes/ComfyUI-HaggsGameDirector` into your ComfyUI `custom_nodes` directory. Restart ComfyUI and refresh its browser interface so the path-drawing/player extension loads.
2. Copy `input/haggs-game` into your ComfyUI `input` directory.
3. Drag `workflows/preview-no-model/02-boss-fight-choreographer.json` into ComfyUI. Queue it to create a deterministic pose-guide video. No AI model is used by this preview.
4. Try drawing actor 1's path directly in the Draw Path / Combat Timeline node. Queue again to render the changed guides. The JSON timeline remains editable and is the saved source of truth.
5. To generate H3 footage, open the corresponding file under `workflows/H3-local`. Install current ComfyUI with its native MiniMax H3 Reference to Video and Fun ControlNet nodes. Obtain the weights named in the model loaders and replace the synthetic reference image with your own character or scene.

No Fal connection, partner API, outside editing program, or game engine is needed to execute these workflows. Local GPU capacity and model files are required for H3 generation. Neither model weights nor a live ComfyUI installation are bundled. Custom nodes use NumPy, Pillow, PyTorch, aiohttp and the native ComfyUI server/VIDEO interfaces available in a normal compatible installation. The file pack does not install packages or download weights itself.

## The six workflows

| File | Implemented prototype | Material boundary |
|---|---|---|
| 01-drag-to-action | Draw a root-motion path inside a ComfyUI node; it produces a colored 18-joint pose sequence, action prompt, and H3 dimensions/frame count. The H3 graph sends those guides through Fun ControlNet. | This guides whole-body motion. It does not drag arbitrary props, solve hand contact, or edit a video stream in real time. Path points are interpolated at uniform shot times; pointer drawing speed is not motion speed. |
| 02-boss-fight-choreographer | Two actors, independent paths, facing directions, and timed walk/attack/dodge/hit/victory poses. H3 receives the two-skeleton sequence. | Procedural choreography guides, not physically simulated combat or verified collisions. Actors can swap appearance in generated footage. Event timing remains design intent until the take is reviewed. |
| 03-playable-scene-forge | Three H3 outcome clips share a room reference and first-frame guide. A custom node writes a player and embeds its three choices directly inside ComfyUI. | Prepared branching video, not a persistent simulated world. The H3 graph generates THREE takes before the player is ready. The preview graph uses three included synthetic clips. |
| 04-game-reskin-director | Load gameplay; convert it to thresholded structural edge guides; condition H3; restore the source's top HUD strip after generation. Optional HUD mask can protect arbitrary UI regions. | Simple gradient edges, not a depth reconstruction or full Canny detector. Visual structure is guidance. Game mechanics and geometry are not guaranteed to survive generation. Source footage is resized to the selected guide size. |
| 05-animation-moveset-builder | A six-action timeline produces an H3 character take. Export Game Atlas writes a PNG sprite atlas, frame rectangles, action ranges, FPS and the original timeline as JSON. | Rendered 2D assets, not a rig or skeletal animation. Loops, anatomy, timing and identity need review. Without a supplied alpha mask, frames retain their backgrounds. |
| 06-enemy-intent-painter | Define circle/cone/rectangle danger areas and windup/impact/end times. Generate deterministic colored visual guides and alpha masks, condition H3, then export masked VFX atlases and original timing/geometry. | Generated art can drift from its guide. The planned geometry/times in the JSON define your intended gameplay area; do not infer collision authority from generated imagery. No physics or engine integration is included. |

## Path and combat timeline

Example actor:

```json
{
  "actors": [{
    "name": "hero",
    "scale": 0.8,
    "facing": 1,
    "path": [[0, 0.3, 0.55], [2, 0.7, 0.55]],
    "events": [{"start": 0, "end": 2, "action": "walk"}]
  }]
}
```

Path rows are `[seconds, normalized_x, normalized_y]`. The point is the body root, so leave room above/below for the full skeleton. Allowed actions: `idle`, `walk`, `attack`, `dodge`, `hit`, `victory`. Up to four actors are supported. Later events win when events overlap. Outside an event the actor idles. The path holds its first/last coordinate outside its key times. `facing` is 1 or -1.

The canvas edits only actor 1's root path and preserves its action events and all other actors. Other actors and exact timing are edited in the JSON. To move an attack earlier, change its `start` and `end`. These guide poses are simple authored patterns, not motion capture.

H3 workflows use 24 FPS and frame counts on the `17n+5` grid. The default is 124 frames (about 5.17 seconds of displayed video). The custom guide nodes snap the requested count upward to that grid and feed the actual count and dimensions into H3. Paths/events beyond the actual duration will not appear. Preview generation rejects more than 600 frames, 1080p, or 100 million total pixels to limit memory; a practical GPU configuration may impose lower limits.

## Branch player inside ComfyUI

Queue the no-model Playable Scene Forge graph to test the embedded player. Click Walk, Dodge, or Attack inside its node. The local server serves only the generated player/media assets under its dedicated route. The node also writes the player, its three MP4s and `branches.json` to `ComfyUI/output/haggs-game-director/<id>/`.

The H3 version uses Open the door / Inspect the artifact / Flee. Edit each H3 reference-to-video prompt to change that outcome. Generation finishes before interaction begins; clicking a player button never starts a new model request. There is one decision with three outcomes and a reset button, not an arbitrary stateful game graph.

## Game exports

`Haggs · Export Game Atlas` writes to `ComfyUI/output/haggs-game-director/<asset-name>-<id>/`:

- `atlas.png`: fixed-size cells, aspect-preserving thumbnails, padded with transparency.
- `atlas.json`: per-frame rectangles, FPS, planned action ranges, and original timeline data.

Connect a tracked `MASK` batch to `alpha_mask` for transparent character sprites. A static mask repeats; shorter batches hold their last mask. Moveset graphs do not perform segmentation automatically. The telegraph graph already supplies its planned alpha masks.

The JSON is a generic interchange format; a Godot/Unity/Unreal importer is not included. Action ranges are markers from your plan, not action recognition. Seamless loops and animation readiness require visual review.

For game reskinning, the source is resampled to 24 FPS before edge extraction. `top_fraction=0.14` copies the original top 14% back after generation; set it to zero to disable, or connect a custom `hud_mask` where white means preserve source. The final H3 video retains H3's generated audio, not necessarily the original gameplay soundtrack.

## What was verified

Core guide rendering, path/event validation, two-actor rendering, telegraph timing, edge maps, HUD restoration, atlas packing/alpha and branch-player HTML have automated tests. The included guide previews and atlas examples were rendered from deterministic synthetic fixtures. Python/JavaScript syntax and workflow connection checks are recorded in `VALIDATION.json`.

Not verified: real ComfyUI import/execution, browser path widget/player behavior inside ComfyUI, native VIDEO saving through the custom node, H3 model rendering, hardware fit, or end-to-end game-engine use. This pack is an experimental implementation, not proof of real-time generation, reliable game physics, or a contest-ready app. No H3 generation jobs were run and no model weights were downloaded.

The original seven-effects pack remains separate. This add-on's local H3 graphs contain no partner/API generation nodes. Model/community-license terms and contest eligibility remain subject to their respective publishers.

Upstream model files: https://huggingface.co/Comfy-Org/MiniMax-H3
Official control workflow: https://github.com/Comfy-Org/workflow_templates/blob/main/templates/video_minimax_h3_fun_controlnet_union.json
