# Imagination Studio: comparison and reuse priorities

Reviewed November 11, 2026. Upstream main is still `ef88a0747686212749768b72d6a796932e8e583d`.

## Award fact versus inference

Comfy's announcement names Imagination Studio **Most Viral**, not Best Overall. Panorama Stickers received Best Overall. The announcement does not explain why individual judges preferred a project or why Haggs did not receive an award. The assessment below is a product/code inference, not a claim about private judging or measured superiority.

Sources: https://comfy.org/open-source-higgsfield#challenge-content and https://github.com/drowzeys/Imagination-Studio-by-keys-Wasserman.

## Where its implementation gives us something useful

| Capability and source | Their concrete implementation | Haggs gap and useful adaptation | State |
|---|---|---|---|
| Editorial direction: `app/static/slate/coverage-plans.json`, `setups.json` | Named coverage patterns plus camera, lens, lighting and look snippets. | Help creators choose editorially useful coverage rather than isolated attractive frames. | Already copied the two unmodified datasets: 12 plans, 165 setups; Apache licence/notices/visible credit retained. Haggs adapter creates separate storyboards. |
| Continuity compilation: `app/slate.py`, `compile_shot`, `sections`, `person`, `cast_voices` | Compiles cast, location, shot sections, references, voice details and selected take context into a model request. | Haggs has existing identity/reference machinery. Add a visible per-shot compiled brief and missing-reference checks so story/cast/world/voice choices do not get lost between tools. Preserve Haggs' explicit destination and no-silent-fallback behavior. | Independently adapted to Haggs: shared generation/compiler path, cast references and visible per-shot brief. See production-packs evidence. |
| Portable production packs: `app/slate_package.py` | Packages project media, screenplay, shot lists and contact sheets; normalizes media references and removes machine/job connection bindings. | Current comic JSON keeps editable data and media references; CBZ holds final PNG pages. Add a complete editable production archive with actual media, reference sheets, scripts, shot lists and a contact sheet. | Independently adapted to Haggs: media ZIP, script, CSV shot list, offline contact sheet, digests and bounded restore. Hosted storage restore remains unverified. |
| Machine qualification: `app/windows_qualification.py` and README | Binds checks to hardware/runtime compatibility and verifies changed model files; records recipe-specific opt-in render passes. | `/machine` currently discloses status, catalog and filenames. Add per-workflow render receipts bound to the exact graph/model/runtime; invalidate after changes. Never import someone else's successful hardware tests. | Read-only inspection implemented independently; qualification execution remains pending. |
| Memory scheduling: `app/memory_manager.py`, `idle`, `release_idle` | Tracks loaded/busy modules and unloads eligible idle modules while preserving those needed by current work. | Useful for a future owner-controlled local/rented worker that shares image/video/audio models. Keep it off the Vercel web process and do not terminate unrelated user processes. | Inspected; requires a worker/runtime adapter, not a blind Python-file copy. |
| Installation/demonstration: README, platform-specific setup and samples | Explicit machine/component requirements and install paths, with examples and documented limitations. | Haggs is broader and hosted; its remaining gap is proven complete user projects and setup-to-output receipts. Prioritize R2/R4 over more navigation tabs. | Adopt the evidence discipline; no installer/model/demo copying performed. |

## Direct reuse boundary

The two editorial JSON files are directly reused with their Apache-2.0 attribution. Other Apache-covered code can be considered for adaptation after file-level and third-party notice review. Python FastAPI/TensorFold/MLX/CUDA engines are not drop-in modules for a Next.js/Comfy workflow runner. Independently licensed models, images, voices and third-party dependencies do not acquire Apache permissions from the application repository. Do not copy their measured hardware claims, credentials, personal media, branding or demo outcomes into Haggs as our own evidence.

Recommended next work: finish the six tracked release gates, qualify the new **portable production packs** and **continuity compilation** against hosted accounts, then add **recipe qualification receipts**. These strengthen the complete filmmaking workflow; adding more disconnected feature screens alone does not address the gap.
