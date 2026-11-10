# Haggs Worlds + Film Engine · V1

A new /worlds studio inside the existing Haggs Next.js app. Built as a separate feature branch so it does not modify Grey Room, Playable, billing, auth, existing ComfyUI jobs, or deployment behavior.

## Working features

- Real-time Three.js/WebGL world view: **Aether Isles**, **Neon District**, **Dune Cathedral**.
- Procedurally generated, seeded world objects (not claimed to be a trained text-to-3D AI).
- Orbit to explore, click objects to select, transform handles to move/rotate/scale; insert/remove 3D components.
- Adjust sunlight, fog density and ambient motion. Capture scene stills and GLB mesh snapshots.
- Three deterministic animated film cameras, lens parameters and a shared ten-second 24-fps timeline. Set start/end camera position from the editor view, then preview all cuts.
- Browser-local save and validated portable JSON import/export.
- One shared JSON world contract used by the browser, standalone Blender scene builder and open-source ComfyUI nodes.
- An agent-ready scene brief (including the complete JSON) can be copied and given to Claude/Codex.

**Every export is free and local.** There are no GPU charges or automatic Comfy/cloud jobs in this version.

## Run in Haggs

Existing package.json includes `three` and `@types/three`; no new npm dependency is required.

```bash
npm install
npm run typecheck
npm test
npm run dev
```

Open `http://localhost:3111/worlds`. The navbar includes Worlds on the feature branch.

## Send a world to Blender / Film Engine

1. In `/worlds`, set up the environment and 3 camera shots. Use **Export film scene** to download `haggs-world.json`.
2. With Blender 4.2+ installed, run the script from the Haggs project root:

```bash
blender -b -P scripts/worlds/render_blender.py -- --scene /path/to/haggs-world.json --out ./outputs/worlds --preview
```

This saves `outputs/worlds/haggs-world.blend` and one 960x540 Cycles preview PNG per shot. Review these before any full render. For final 1080p 24-fps frames:

```bash
blender -b -P scripts/worlds/render_blender.py -- --scene /path/to/haggs-world.json --out ./outputs/worlds --render
# If Blender's GPU preferences are configured: add --gpu
ffmpeg -framerate 24 -i outputs/worlds/frame_%04d.png -c:v libx264 -pix_fmt yuv420p outputs/worlds/film.mp4
```

The Blender builder constructs **procedural proxy geometry and cinematic cameras**, not photorealistically generated assets. It saves an editable .blend. For film-quality objects, replace the proxies with Hunyuan3D/TRELLIS meshes, hand-built GLB assets, or licensed models. For a production final, add real texture/PBR lookdev, character rigs, visual review, finishing, Foley and music.

**Coordinate systems:** Three.js is Y-up. The Blender bridge maps XYZ positions to Blender X,-Z,Y. Camera paths use the same mapping. The primitive proxy meshes are close interpretations of browser geometry; they are not bit-exact mesh exports. For exact appearance, import the separately exported GLB into Blender and use the world JSON for camera and timing; avoid duplicating both copies.

**Important:** The reference movie used ten rented GPUs. This builder never provisions cloud resources. `--render` invokes Blender on the selected local machine only. Unless `--gpu` is explicitly provided and a supported Cycles device is available, Blender uses CPU.

## Send a world to open-source ComfyUI nodes

Copy `public/workflows/worlds/custom_nodes/ComfyUI-HaggsWorlds` into `ComfyUI/custom_nodes/`, then restart ComfyUI.

- **Haggs · Load World**: paste the exported JSON and get validated world JSON, number of shots and frame rate.
- **Haggs · Direct Shot**: connect the world JSON and choose shot index (0-based). Outputs a detailed visual prompt, camera/timing JSON, and the requested number of frames for that shot.

Connect those outputs to compatible existing open-weight image/video workflows (for example, models you have separately installed with a compatible node graph). These are **model-neutral scene/camera metadata nodes**. They do not pretend to perform Hunyuan3D, Blender, Wan, or LTX inference. No model download, external provider key or paid action is built in.

For technical artists: add your own image/mesh generator nodes next, with validation of model/VRAM/runtime and explicit pricing/cap before any hosted provider call.

## Claude / Codex usage

Use **Copy AI brief** in Worlds. Paste it into a Claude or Codex coding session with the following rules:

- Work on a copy or branch; do not overwrite saved worlds without asking.
- Return only a complete v1 world JSON with supported kinds and continuous shot times.
- Explain which assets are procedural proxies versus generated meshes.
- Keep animation deterministic by film time, not wall-clock randomness.
- Preview and inspect actual browser/Blender images before declaring film quality.
- Never launch ComfyUI paid jobs or cloud GPUs without consent and preflight cost caps.

## What is *not* finished

- No direct Claude API call from the Worlds screen. Text input selects a preset through keyword matching, not AI generation. The copied agent brief is the explicit temporary workflow.
- No live ComfyUI inference, generated mesh retopology/texturing, remote cloud GPU dispatcher, or automated shot quality-control loop.
- No direct Grey Room shared-scene transfer or Playable export yet; portable JSON/GLB is the first interoperability boundary.
- No sound mix, final color grade, audio-synchronized film timeline, cloud worker isolation, or camera-driven video inference yet.
- Browser saves are local to a browser; use JSON export to back them up. They are not written to the Haggs database.

## Verification checklist

```bash
npm run typecheck
npm test
python3 -m unittest discover -s public/workflows/worlds/tests -v
python3 -m py_compile scripts/worlds/render_blender.py
```

Then manually: start /worlds; verify the three presets, scene object dragging, GLB/JSON export, save/reopen, film camera playback; capture screenshots; run Blender --preview and inspect every shot. The last steps require working WebGL and an installed Blender, and **must not be claimed passed based on static checks alone**.

This feature branch must stay unmerged and undeployed until those verification gates pass and the user approves deployment.
