# Haggs integration notes

The ALL ZIP is the canonical pack. Every file in the H3-only and LTX-only ZIPs is byte-identical to its ALL counterpart. We retain 22 unique workflow graphs, omit 30 duplicate graph occurrences, and present seven effect cards, not 21 copies of the same card.

Seven local reuse-video apps and seven local LTX generation-to-compositor apps are registered in Haggs. They require a configured local ComfyUI with the included ComfyUI-HaggsContestLab pack. A cloud API key alone cannot run these apps. No custom pack has been installed automatically. The seven H3 variants remain download-only with their paid-generation gate OFF. The SAM2 helper is also download-only and may obtain model weights when run manually.

The four previously added LTX workflows are separate and are not duplicated by these effects. The new LTX variants reuse the upstream first/last-frame generation backbone but add a distinct custom compositor, original source footage, music and diagnostics. The existing Comfy template index has no matching effect IDs; the upstream generation backbones themselves are not claimed as new.

The seven WebP thumbnails are image_gen photographic concept illustrations, not outputs from LTX, H3 or the custom nodes. Their exact prompts are in IMAGE-PROVENANCE.json. The seven MP4 previews came with the pack and use synthetic fixtures with supplied masks. They show the deterministic compositor, not generated-video quality or successful ComfyUI wrapper execution.

Haggs exposes source/layer media, music, amount and manual beat settings; duet/echo get delay/spread, Reality Scrubber gets its time:mix curve, and Foley Orchestra gets the marked source impact. LTX apps expose the layer prompt. All return the final SaveVideo output, not the audit node. Advanced subject masks, portal masks and band maps must be connected in the downloaded ComfyUI graph. Without them the documented geometric defaults apply. No automatic tracking, instrument separation, impact detection, independent choreography or physical 3D simulation is implied.

Validation performed: all 22 JSON graph structures and embedded links checked; reuse graphs converted against the custom nodes' declared INPUT_TYPES and core fixture schemas; app field bindings and missing-node rejection tested. The supplied pure NumPy compositor suite passes 23 tests. The live VIDEO wrapper, installed node catalog, real media integration, LTX inference, H3 API execution and SAM2 remain unverified. No generation job was submitted.

Dependencies: current ComfyUI VIDEO interface; included custom nodes; NumPy and PyTorch in ComfyUI; ComfyUI-LTXVideo and exact named LTX/Gemma/VAE weights for generation; official MinimaxHailuo03FirstLastFrameNode and paid Comfy access for H3; Kijai ComfyUI-segment-anything-2 and SAM2 weights for the optional helper. Compositing holds complete frame batches in CPU RAM; defaults are intended for short previews. The code rejects over 1200 frames or more than 1080p, but smaller inputs can still exceed available memory.

Original source, license texts, fixtures, tests and manifest remain unchanged in this directory. Model weights are not bundled and retain their own licenses. The application changes remain under the user's merge/deployment hold.
