# Final workflow batch handoff

Branch: `codex/playable-game-director-atlas`, following Playable commit `c337a12` and prior workflow head `5ad0ced`. Do not merge, push or deploy; user's hold remains in force.

Added all ten distinct primary graphs from `libfile_c4be3a263f2881919e8784fa53a54db8` as three featured concepts: Playable World, Motion to Movie, Directed LTX VFX. Three new photographic illustrative thumbnails plus supplied deterministic preview videos. All downloads, custom source, fixtures, original ZIP, MIT and upstream licenses retained. Attribution badge is scoped to supplied Haggs custom code.

Cumulative catalog: 20 concepts, 20 illustrative images, 48 distinct primary graphs (4 LTX + 22 effects + 12 Game Director + 10 HaggsStudio), excluding two upstream reference graphs. There remain 18 registered web apps (4 LTX + 14 local effects); the final ten are native ComfyUI downloads because widgets, filesystem outputs and external services need setup. New pack isn't automatically connected to Playable: only Game Director sprite atlas outputs are supported there.

Verification: static graph links/types/DAG, subgraph references, fixture paths, source syntax; 21 Python tests passed with an already available PyAV dependency; room simulation checks passed. Final focused JS suite: 27 passed (new catalog plus atlas/storage). Final full JavaScript suite: 1,059 passed, including all later transaction and catalog cases. See `public/workflows/world-motion-vfx/INTEGRATION-VALIDATION.json` for hashes/counts and `INTEGRATION.md` for dependency and runtime limits.

Live ComfyUI custom widgets, Eden GPU/WebRTC, HY-Motion, H3 and LTX inference remain unverified. No model installation, paid inference, real Eden registry mutation, or deployment was performed. Supplied browser receipts are clearly distinguished from checks rerun here. Playable desktop/mobile-viewport checks and limitations are in `docs/game-director-playable.md`.

Combined release had already integrated through `5ad0ced`; apply only the commits after that head. It may conflict in `src/app/workflows/workflows.tsx` with that branch's earlier gallery edits. Preserve its routing/Open Weights changes. No overlapping Playable edits were present when its staged diff was inspected, and that checkout was not modified.

Final production webpack build and TypeScript check passed. Production browser check confirmed all three new photographic images loaded, room download links expanded, and the supplied room preview decoded and played to 5 seconds at 832×480 without a media error. This checks gallery delivery, not neural generation.
