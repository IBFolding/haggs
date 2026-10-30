# HaggsStudio integration and verification

Imported from user attachment `libfile_c4be3a263f2881919e8784fa53a54db8`, an ordinary ZIP named `Haggs-ComfyUI-Playable-World-Motion-LTX-VFX.zip`. Ten distinct primary ComfyUI graphs, grouped into three featured concepts. None is an exact duplicate of the previous catalog; overlapping LTX/H3 generation subgraphs are retained as dependencies of distinct tools. The original archive, source, fixtures, upstream attribution and licenses are preserved.

These are native ComfyUI downloads, not registered Haggs web Run apps. Their custom widgets, session recording, filesystem outputs and service adapters cannot be faithfully mapped to the existing simple web form. No nodes were installed and no model jobs or weight downloads were performed during integration.

## Verified here

- Ten graphs: unique IDs, reciprocal input/output links and declared types, no cycles, supplied input fixtures, referenced subgraph definitions, Python and JavaScript syntax. This is static schema validation, not installed-node `/object_info` validation.
- All 16 custom-node instances match their supplied source input/output declarations, checked via AST without importing ComfyUI wrappers.
- 21 Python core/backend tests passed, using existing `/tmp/haggs-studio-test-deps` PyAV. The first run without PyAV had four dependency failures; rerun passed all tests. Registry tests use temporary repositories, not a real Eden installation.
- Final full JavaScript suite: 1,059 passed; focused catalog/atlas/storage suite: 27 passed.
- Node room simulation: wall/obstacle collision, reachable three-crystal win, immutable initial state.
- Original `VALIDATION.json` and `output/playwright/BROWSER-RECEIPT.json` are supplied-author evidence, not new browser/GPU tests by this integration.

## Dependencies and limits

**World:** native HaggsStudio frontend and backend create an isometric geometry proxy and record MP4/manifest data. Eden registration writes the chosen Eden repository's registry, preserving a backup; it is a deliberate local setup operation. Neural replay launches the configured Eden Python environment with local weights and offline model settings. Live service embedding needs a reachable service URL and compatible HTTPS/browser configuration. GPU replay, live WebRTC, latency and custom Comfy widgets remain untested here.

**Motion:** ComfyUI-HY-Motion1 with its network, text encoder, CLIP and body-model dependencies; missing weights may be downloaded by that dependency when queued. Local H3 requires its own named weights and nodes. Saved-motion preview uses the supplied synthetic NPZ. The bridge exports joint arrays and pose guides, not a rig/FBX or Playable atlas; face points are estimated. Live HY-Motion/H3 generation remains untested.

**VFX:** current compatible ComfyUI-LTXVideo/LTX-2.5 inpainting nodes, base weights, inpainting LoRA, encoders, VAE and upscalers named in the graphs. Single-effect or two sequential passes only, no arbitrary event fan-out. Source is prepared to 24 FPS, 8n+1 frames and aligned resolution; end frames can be held. Zero-mask pixels match that prepared source before lossy encoding, not the original source file byte-for-byte. Prompt enhancement is disabled. Live LTX inference remains untested.

## Playable scope

The separate Game Director PNG atlas integration supports sprite animation in Haggs Playable. This pack's geometry room, NPZ motion and MP4 effects are not automatically imported into that editor. No claim of universal Playable compatibility is made.

## Samples and attribution

Three photographic thumbnails are AI-created illustrative concepts, labeled as such. Supplied preview videos show deterministic proxy/synthetic data, not neural generation quality. The Haggs badge follows the pack's MIT notice and custom source attribution; it does not assert Haggs authorship of upstream models or independently verify contributor identity. Model weights have separate terms and are not included.

Final production webpack build and TypeScript check passed. Production browser check confirmed all three new photographic images loaded, room download links expanded, and the supplied room preview decoded and played to 5 seconds at 832×480 without a media error. This checks gallery delivery, not neural generation.
