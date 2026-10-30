# Game Director and Playable: supported atlas integration

These six workflows are distinct from the earlier four LTX concepts and seven Contest Lab effects. The archive contains 12 unique executable graphs (six no-model previews and six local H3 variants), plus two upstream reference graphs. No exact graph duplicates were found against previous packs.

The generation graphs remain ComfyUI downloads, not Haggs Run apps. Moveset Builder and Enemy Intent Painter atlas outputs now import into Playable through the Art panel. The drawing widget, multi-file atlas export, and embedded branch player require their native ComfyUI extension. Haggs's current video-result handling does not collect these custom STRING directory outputs or reproduce the drawing widget. No working ComfyUI installation or H3 model execution was available for verification.

## Input/output mapping

| Workflow | Inputs | Outputs | Potential Playable use / missing integration |
|---|---|---|---|
| Drag to Action | Actor path/action timeline JSON, scene text, reference image, dimensions/frame count | Pose frames, planned timing JSON, H3 video | Motion reference or future frame extraction; no runtime path/action importer |
| Boss Fight Choreographer | Two actors' paths, facing and action events, reference image | Two-skeleton guide and H3 video | Choreography reference; no collision or AI behavior conversion |
| Playable Scene Forge | Room reference, three prompts or three prepared clips, choice labels | Three MP4s, player.html, branches.json | Separate branching-video prototype; no Playable branch type, persistent state or importer |
| Game Reskin Director | Gameplay video, style/reference, edge threshold, optional HUD mask | Edge guide and restyled video | Trailer/reference material; cannot reskin a running Playable game |
| Animation Moveset Builder | Action timeline, reference, optional alpha mask, atlas cell size/columns | atlas.png, frame rectangles/FPS/action ranges in atlas.json, video | Supported: validated PNG + JSON import, action selection, opt-in looping, frame playback and browser storage |
| Enemy Intent Painter | Shape/position/windup/impact/end JSON, style, reference | Masked atlas and original geometry/timing | Supported as animated visual sprites. Gameplay geometry/time conversion remains manual; generated art must not define collision logic |

## Import and play

1. In ComfyUI use Export Game Atlas, then choose its `atlas.png` and `atlas.json` in a Playable sprite slot under **Art → Game Director animation**.
2. Press **Import animation**. Preview the frames, select an exported action range or `all`, and enable looping if appropriate. Looping is off for new imports because loops are not automatically verified.
3. Play or Replay. Runner, collector and match sprites use simulation time; generated-code games animate through `HAGGS.img`, `HAGGS.draw` and textures. Game rules, collision logic and controls stay unchanged. Action selection is a visual playback setting, not an automatic combat-state binding.
4. Reload to reopen the saved atlas and chosen action. Removing it returns the slot to a shape. Undo restores prior art.

PNG and JSON are selected separately; manifest paths are never fetched. PNG ≤ 2 MB, JSON ≤ 256 KB, 1–600 contiguous uniquely numbered frames, 1–120 FPS, bounded rectangles, ≤ 16 million pixels per atlas, up to four atlases / 32 million pixels per game. PNGs are decoded and re-encoded without resizing or chroma keying, preserving alpha and cell coordinates. Extra timeline fields and executable/remote references are not imported. Saves use an IndexedDB transaction and report failures instead of falling back to volatile memory. Imports stay in this browser; model-edit requests omit atlas pixels and metadata.

Playable's home page includes a free **Game Director atlas demo**. It uses the supplied deterministic pose/VFX PNG exports. Matching interchange manifests were reconstructed from their timelines and exporter cell layout; both PNGs and frame rectangles were reproduced pixel-for-pixel with the included core renderer/exporter. This verifies deterministic atlas handling, not a live ComfyUI wrapper or H3 generation. Files and provenance are in `playable-examples`.

Prepared branching HTML/video, video reskinning, root-motion timelines, skeletal rigs, and automatic telegraph collision logic are not imported. Those workflows remain separate. Atlas use on 3D textures is supported by the kit, but the browser acceptance check covers 2D playback; no claim of verified 3D model animation is made.

## Dependencies and verification

All variants require compatible ComfyUI and `ComfyUI-HaggsGameDirector` (included; not installed automatically). Custom wrappers need NumPy, Pillow, PyTorch, aiohttp and ComfyUI's native VIDEO/server APIs. Local H3 needs the exact UNET, CLIP, VAE and patch weights named in the graphs, native MiniMaxH3ReferenceToVideo / Fun ControlNet nodes, suitable GPU memory and applicable publisher license acceptance. No weights are bundled. These H3-local graphs are different from the earlier Contest Lab **paid API** H3 variants.

Core guide/atlas/player tests passed locally (23 tests); graph links and file bindings were inspected. This does not verify ComfyUI custom-node import, its browser widget, native VIDEO saves, H3 generations, model hardware fit, or game-engine execution. No paid inference was run.

Previews are deterministic synthetic fixtures supplied in the archive. New photographic concept images use built-in image generation and are explicitly illustrative; exact prompts and original file paths are in IMAGE-PROVENANCE.json. Original archive contents and hashes are preserved. The Haggs badge refers to custom-node authorship documented in the included MIT notice, not upstream models.
