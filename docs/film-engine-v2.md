# Haggs Film Engine V2 — standalone cinematic production workspace

**Branch:** feature/haggs-worlds-film-engine  
**Draft PR:** https://github.com/IBFolding/haggs/pull/140  
**Status:** in-development. Do not merge or deploy until visual/runtime tests and explicit approval.

## Why this lives separately from the Editor

- **Worlds** (`/worlds`): construct and explore editable 3D sets; control weather, objects and lights.
- **Film Engine** (`/film-engine`): direct a sequence of camera shots inside a world, review shot plans, preview in real time, prepare Blender/Comfy handoffs.
- **Main Editor** (`/editor`): cut delivered takes, work with voice/music/captions, finish actual media and export final video.

The Film Engine is a **separate Haggs page**, not a separate service or a new top-nav item. It opens from **Worlds → Make a Film** or **Projects → Create a 3D film**. Existing Editor code remains unchanged. The direct Editor link in Film Engine is navigation only; no shot is inserted into an Editor project without a future dedicated media handoff.

## What works

- A dedicated, responsive production page matching the original Haggs design tokens (`#0a0a0b`, `#35e48a`).
- Full real Three.js/WebGL film monitor driven by the linked Haggs world and a deterministic 24-fps shot timeline.
- Eight-shot local storyboard (60 seconds) with story beat, lens length, start/end cameras.
- Shot selection updates the monitor; playable camera transitions and a scrubbable film timeline.
- Actual thumbnails captured from the Three.js canvas (not externally generated illustrative thumbnails).
- Camera edit mode: orbit camera, capture start/end positions, lens adjustment, playback.
- Manual shot review flags, notes, approve/needs changes.
- **AI Director**: explicit click sends the film brief and concise world metadata to the existing Claude provider key via a guarded server action; validates an 8-shot plan. This may incur Claude account usage charges. No Comfy/cloud render is triggered.
- Browser-local saved projects, editable film JSON export/import, production manifest output, world export including film cameras.
- Browser-side WebM recording via MediaRecorder when supported. Keep the tab visible. Recording is a realtime preview rather than a path-traced final.
- Blender handoff uses `scripts/worlds/render_blender.py`; ComfyUI node handoff uses `public/workflows/worlds/custom_nodes/ComfyUI-HaggsWorlds`.

## Important boundary

We deliberately **do not fake completion**: the monitor shows a real-time procedural scene, not a photorealistic multi-GPU movie like the reference artwork. Blender and Comfy buttons export portable scene definitions; they do not start heavy compute on the server. No placeholder '4K ready' or automatic render status appears in the UI. The bottom pipeline reflects actual states (planned, preview recorded, manually reviewed, exported). AI generation is not performed unless the user explicitly requests it.

In V2, local storage is for the whole user's browser, not a Haggs account-scoped database. Export the editable Film JSON regularly. Generated media has not yet been linked to project boards or the main editor.

## Running

```bash
npm ci
npm run typecheck
npm test
npm run dev
```

- `http://localhost:3111/worlds` creates a world. Click **Make a Film** (it saves the current world in browser storage before navigating).
- `http://localhost:3111/film-engine` opens the dedicated Film Engine.
- In **AI Director**, use **Local shot draft** for zero-provider planning, or **Generate with Claude** after connecting Claude in Provider Keys.
- Set start and end cameras on the Cameras tab. Approve or flag individual shots on Review. Export an editable project JSON from Outputs.
- Choose Three.js and **Record preview** for real browser video (WebM); choose Blender or ComfyUI to export a world/camera JSON for their respective installed toolchains.

## Blender render from the same camera definition

```bash
blender -b -P scripts/worlds/render_blender.py -- --scene /path/to/haggs-world.json --out ./outputs/film --preview
# Inspect the three-shot or eight-shot preview folder before committing to heavy inference.
blender -b -P scripts/worlds/render_blender.py -- --scene /path/to/haggs-world.json --out ./outputs/film --render
ffmpeg -framerate 24 -i outputs/film/frame_%04d.png -c:v libx264 -pix_fmt yuv420p outputs/film/film.mp4
```

Check Blender Cycles frame costs and device availability before any full sequence. Do not run cloud GPUs or Comfy Cloud automatically.

## Verification

- CI: TypeScript, existing Node tests, new film timeline/spec tests, Blender/Comfy Python syntax, model-neutral node tests.
- Manual remaining: actual browser WebGL and responsive viewport inspection, three film camera plays, thumbnail timing, WebM capture on Edge/Chrome, real Blender previews and installed ComfyUI node execution.
- Auth / AI: only a connected Claude key is used, no keys exposed to client code. Validate errors and quota states in a manual integration test.
- Before release: independent security review, end-to-end film-quality reference scene test, real actor/asset integration, project persistence, Editor export, stronger continuity review and retry pipeline, compatibility with existing Grey Room and Playable routes.

**No main merge, Vercel deploy, or real cloud model inference is authorized by this document.**
