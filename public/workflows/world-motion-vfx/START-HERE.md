# Haggs Studio — Playable World, Motion-to-Movie, LTX VFX

This adds the three requested systems. All user interaction is inside ComfyUI. Eden's neural renderer still requires its own configured GPU backend; embedding its interface does not remove that requirement.

## Install

1. Copy `custom_nodes/ComfyUI-HaggsStudio` into your ComfyUI `custom_nodes` folder. Restart ComfyUI and refresh the browser so the custom controls load.
2. Copy the four files directly inside this pack's `input` folder into the top level of your ComfyUI `input` folder. Files have the `haggs-studio-` prefix. The nested legacy fixture directory, if present, is unused.
3. Use a current ComfyUI with the native VIDEO interface. This pack uses its PyTorch, Pillow, NumPy, aiohttp and PyAV dependencies. It does not install models automatically.
4. Start with workflow 01 (playable proxy) or 07 (effect-mask preview). These do not run a generative model.

## 1. Playable World Renderer

**Implemented:** a keyboard-controlled isometric room, collision geometry, three collectible crystals, knight/mage/robot proxy colors, three environment palettes, reference-image input, five-second recording, native Eden game registration, an embedded Eden Live connection, and an actual Eden offline inference adapter.

**Not demonstrated:** neural live generation, its latency, or neural replay output. Those need Eden weights, a compatible GPU environment and an end-to-end run. Proxy rendering is visibly labeled and never represented as neural output.

### Use it

- Open `01-playable-world-room.json` and Queue. Click inside the room, then use WASD or arrows. Enter restarts. The level is winnable and obstacles stop movement.
- Connect a target first-frame image to `visual_reference` for the appearance Eden should render. The proxy selector changes its simple avatar color; it is not a detailed character generator.
- Click **Record 5 seconds**. The browser sends 120 proxy frames to the ComfyUI backend. It writes a real MP4, matching first frame, target cover, prompts and a native Eden CSV manifest.
- Copy the session ID shown in the node output. It is a generated identifier, not an account credential.
- Use workflow 09 with that ID to inspect the recorded proxy through ComfyUI's native video output.

### Connect actual Eden Live

1. Install/configure the official [EdenLive GPU backend](https://github.com/VAST-AI-Research/EdenLive) in its supported environment. Backend installation is an infrastructure prerequisite; the pack does not claim Mac-native neural rendering or silently install hundreds of gigabytes of weights.
2. Record the room first, then use `02-register-room-for-eden-live.json`. Set the session ID and official Eden repository path. This copies the standalone room into `realtime/games`, adds its unique registry entry, and saves a registry backup. It preserves unrelated games and is idempotent for the same session.
3. In workflow 01, set `eden_service_url` to the native service address (default `http://127.0.0.1:8089`). The URL must be reachable by your browser. For an HTTPS ComfyUI page, use an HTTPS service URL to avoid mixed-content blocking.
4. Click **Connect Eden Live backend**. The native Eden interface appears inside the node. Connect/start its session and select the returned `haggs-room-…` game. Eden maintains its live renderer and streaming transport; our room supplies the geometry, keyboard controls and observation contract.

The proxy was tested against Eden's actual `host/standalone.js` virtual clock: keyboard input advanced state and produced the required JPEG capture. A GPU/WebRTC inference session and embedding of the deployed native service have not been tested. Native server framing/authentication policies may require configuration.

### Neural replay alternative

`03-eden-neural-replay.json` feeds a recorded session into the official Eden 5B few-step inference CLI. Set:

- `eden_repo`: absolute official source checkout path.
- `eden_python`: absolute executable path in its configured GPU Python environment.
- `weights_root`: existing Eden model directory with the 5B transformer/VAE, UMT5, scheduler and vision encoder components.

This node runs the documented inference module with explicit recording-manifest overrides and a fresh output directory. Model downloads are disabled. Its log and receipt stay in the session output directory. A failed run raises an error; no automatic retry is submitted. This is offline rendering of recorded play, not a substitute presented as live generation.

Eden's reference deployment and accelerated consumer-GPU configurations differ; follow the upstream instructions for your exact hardware. No performance guarantee is made by this adapter. The optional upstream game-generation/FLUX workbench is not invoked by this pack.

## 2. Motion-to-Movie Bridge

`04-generated-motion-to-h3.json` implements:

**text → actual HY-Motion generation → retained 3D motion → editable speed/camera projection → full-frame-rate H3 pose guidance → H3 video.**

Install [ComfyUI-HY-Motion1](https://github.com/jtydhr88/ComfyUI-HY-Motion1) and its required network, text-encoder, CLIP and body-model assets. Install the native H3 Reference-to-Video/Fun ControlNet nodes and the weights named in the graph. The dependency may fetch missing models when queued; prepare its files first if you want offline execution.

The bridge consumes real `HYMOTION_DATA`, rather than substituting our earlier procedural action patterns. It rejects missing or zero/degenerate joint positions, which can occur if the upstream body-model assets are unavailable.

Controls: sample index, playback speed, projection yaw, width and height. Projection uses one frame for the whole motion, so root movement is preserved. It resamples to 24 FPS and pads to H3's `17n+5` frame grid. Face guide points are estimated from the head joint; these are not generated facial animation.

Each conversion saves to `ComfyUI/output/haggs-studio/motion-<id>/`:

- `original-motion.npz`: original generated joint/rotation/translation arrays, without replacing them with rendered video.
- `retimed-joints.npz`: resampled joint positions and FPS.
- `motion.json`: source timing, chosen sample, speed, projection and frame-count metadata.

This is a motion-data export, not automatic FBX rig retargeting. H3 follows projected guides; generated anatomy, contact and identity require review.

`05-saved-motion-bridge-preview.json` lets you preview a saved NPZ without running HY-Motion or H3. Its included `haggs-studio-synthetic-motion.npz` is clearly synthetic test data. Replace it with actual saved HY-Motion joint data and set the correct duration. Synthetic previews do not establish that model inference passed.

## 3. LTX VFX — direct effects, not just describe a whole new video

The tool creates timed moving masks for **bursts, portals, trails and beams**, sends each effect into LTX's actual video-inpainting workflow, then preserves the prepared source outside the editable regions.

### Start with placement

Open `07-vfx-placement-mask-preview.json`. Replace the source video and Queue. The custom node shows its first prepared source frame behind the placement controls.

- Choose an event in the panel, select a time within its start/end interval, and click a position to create a path keyframe.
- Edit `timeline_json` to change type, start/end, radius, description, beam target or trail duration. Coordinates are normalized; path timestamps are absolute shot seconds.
- `effect_index=0` selects the first event, `1` the second, and `-1` previews all masks together. The panel's event selector chooses which path you edit; `effect_index` chooses which event is sent to generation.
- Attach a tracked MASK batch and set an event's `follow_tracking=true` to follow that mask's centroid. This tracks a region's center, not arbitrary skeletal joints or optical-flow physics.
- Attach `protected_masks` to keep a performer/foreground out of the editable mask. White protects source pixels. Use masks at the prepared 24 FPS shot start; static masks repeat and short protected batches hold their final frame.

### Generate one or several effects

- `06a-ltx-single-effect-inpainting.json`: one LTX inpainting pass for the chosen event.
- `06-ltx-directed-vfx-inpainting.json`: **two LTX passes**, one per event. Pass 1 adds the burst; pass 2 receives its composited result and adds the trail. Each pass has a separate effect mask and prompt. Edit the corresponding events in both placement nodes. More events need more passes; the graph does not automatically fan out an arbitrary event count.

Requires the official [ComfyUI-LTXVideo](https://github.com/Lightricks/ComfyUI-LTXVideo) nodes plus the exact LTX-2.5 base/encoder/VAE/upscaler and inpainting LoRA files named by the upstream graph. Embedded subgraphs are included. Prompt enhancement is disabled in this pack. No Fal or paid partner generation node is used.

The model creates the effect appearance. The final compositor controls placement and timing, and restores prepared-source audio. Where the final effect mask is exactly zero, the compositor preserves the prepared source array exactly **before video encoding**. Soft mask edges blend. MP4 encoding is lossy, so exported pixels are not claimed to be bit-identical.

The source is prepared at 24 FPS, conformed to an `8n+1` frame count, and resized to a multiple-of-32 working size. Up to seven held ending frames may be added. The default maximum side is 512 pixels and shot duration is five seconds. “Preserve source” refers to that prepared working clip, not a claim that resizing left the original file untouched.

`08-vfx-reuse-existing-take.json` lets you edit compositing against an existing take without a new model run. The bundled take is a colorful synthetic fixture. Moving masks after generation does not move the already-rendered effect content; rerender the relevant inpainting pass when the effect itself must change position.

## Validation and remaining boundary

Verified: model-independent motion conversion, effect masks/timing/selection, exact outside-mask preservation, recording encode/decode, manifest generation, native registry registration/backups, room movement, wall/obstacle collisions, reachable win, browser recording of 120 frames, and Eden's native standalone clock/JPEG contract. See `VALIDATION.json` and `output/playwright/`.

Not verified: loading these graphs in your actual ComfyUI installation; its custom DOM widgets and native VIDEO wrappers; HY-Motion generation; H3 generation; LTX inpainting output; Eden GPU inference/WebRTC or neural latency. No model generation jobs or model-weight downloads were performed while making this pack.

The workflow files are experimental implementations with reproducible tests, not a claim of a finished contest submission. A successful GPU-rendered demonstration is still required to show the model paths working end to end.
