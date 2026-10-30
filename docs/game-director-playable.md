# Game Director → Playable

Implemented on isolated branch `codex/playable-game-director-atlas`, based on `5ad0ced`. This change does not merge, deploy, install custom nodes, download weights, or run paid inference.

## Delivered

- Free PNG + atlas JSON import in every Playable sprite slot; background slots retain their existing still-image behavior.
- Ordered source-frame cropping, alpha preservation, exported action selection, opt-in looping, preview and removal.
- Playback in runner/collector/match and generated-code games. The kit updates a stable frame canvas so existing `HAGGS.img`, `draw` and texture consumers receive frames without learning a new API.
- Atlas metadata persists with game art and undo history; prompt-preserving model edits keep it. Model requests strip atlas pixels and metadata.
- Strict IndexedDB saves for imports and demo creation, with an atomic record/index write. Storage failure is reported and does not silently fall back to memory.
- Free Playable demo using the supplied deterministic pose and VFX atlas PNGs. Workflow cards link Moveset Builder / Enemy Intent Painter to Playable.

## Validation

Final TypeScript check and production webpack build passed.

The full existing suite plus initial atlas tests passed (1,053 tests). Final focused atlas/storage suite passed 24 tests, including three later transaction cases. Game Director Python suite passed 25 tests, including two new pixel-exact reproduction checks for the supplied PNGs and reconstructed export-format manifests.

Browser checks used the normal desktop viewport and a 390 × 844 viewport:
- Created the two-atlas demo, played it, checked the rendered sprite/VFX samples and mobile layout; pointer input was exercised through the game canvas.
- Selected `hero-walk`, saved, reloaded and verified the selected range persisted.
- Uploaded the existing PNG through the file picker; a timeline-only JSON was rejected without replacing the existing animation; the matching atlas manifest imported successfully.
- Reloaded that import and verified `all` and non-looping defaults persisted.
- Imported the same atlas into a new Runner template, selected walk/loop, played and paused it. Existing game controls and rules remained available.

Unit tests cover malformed manifests, remote/path references, PNG signature and size bounds, non-finite FPS, duplicate/gapped frame indices, invalid rectangles/action ranges, ordering, exclusive ends, one-shot/loop timing, static-art replacement, persistence/undo, model-request stripping, aborted writes, commit timing, and actual source-rectangle use in both render paths. Browser checks used deterministic fixtures; no live H3 generation or ComfyUI wrapper execution is claimed. Mobile means a browser viewport/pointer check, not physical-device certification. 3D texture consumption is implemented but not visually verified in a 3D game.

## Limits and follow-up

Import accepts PNG ≤ 2 MB and JSON ≤ 256 KB, 1–600 frames, FPS 1–120, ≤ 16 million pixels per atlas, at most four atlases / 32 million pixels per game. It rejects invalid frames rather than guessing. The separately selected PNG is decoded and re-encoded; manifest URLs are never followed. Source alpha is preserved; unmasked backgrounds remain visible. Loop quality is a user review, not an inference claim.

Only visual atlas outputs are connected. Branching HTML/MP4 players, recorded-video reskins, root-motion timelines, rigs, and telegraph-to-collision conversion remain unsupported. Chosen actions play from the game clock; there is no automatic combat state/action binding.

The combined release task was read for coordination; its existing integration at LTX `5ad0ced` was not edited. Integrate only this branch's delta after `5ad0ced`, then rerun the combined checks. Keep the user's merge/deployment hold.
