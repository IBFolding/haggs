# Grey Room control and take audit — 2026-10-30

Scope: local branch based on `9108e87`. Independent browser profile; disposable fixtures only. No paid jobs or production changes. This is an evidence inventory, not a claim that every provider-backed feature works.

## Defects fixed

1. At 1280×720 the default expanded timeline reduced the landscape canvas to 482×271. Layers now start collapsed; Fit is approximately 649×365. Focus canvas gives approximately 969×545. 125/150/200% zoom scrolls within the preview and never changes output framing. On mobile, 200% produces a 740px canvas inside a 370px viewport while document width remains 390px. Fit preserves aspect ratio; mobile focus avoids artificial empty space above the scene.
2. Editor flex layout shrank the take tray to 4px high, making its pick buttons overlap other controls. Inspector children now keep their intrinsic height and scroll.
3. Takes shared one Grey Room scene and trim. Each take now snapshots/restores its own optional `greyScene` and `trimIn`. Adding unrelated footage clears the active Grey scene; Grey Room output explicitly retains the editable source scene. Existing legacy take trims that were never stored cannot be reconstructed.
4. An immediate take switch followed by Grey Room navigation could read the old stored project. Both editor Grey Room links now await the pending save and refuse navigation on save failure.
5. The project-header Grey Room link always targeted the board's first shot. The editor now passes its selected shot (or current playhead shot) to that link.

## Controls and evidence

| Surface / visible controls | Status and practical meaning |
| --- | --- |
| Fit, 125/150/200%, Focus canvas / Show panels | Laptop Fit, 150% scroll bounds and focus visually checked. Mobile Fit, 200% bounds and focus visually checked. 125% uses the same sizing path; not independently exercised. |
| Composite / Original; composition guides | Browser assertions verified props disappear in Original and return in Composite; guide toggle verified. |
| Fullscreen | Existing browser fullscreen action retained; not certified across browsers or physical mobile devices. Focus canvas is the tested alternative. |
| Undo / Redo | Duplicate/removal and hide restoration asserted; earlier resize and MCP apply undo verified. |
| Play / Pause; previous/next frame; time | Buttons exercised; 24fps stepping is a fixed UI increment, not source-fps detection. Scrub/keyframe helpers have unit coverage; every animated combination is not browser-certified. |
| Animate; key markers / remove key | Existing real 2D keyframe behavior retained and covered in model tests; no new comprehensive animation browser pass. |
| Save now, reload, editor return | Tested through edited alternate take, reload, render, return, original restoration and immediate mobile switches. |
| Asset categories; search; favorites; starter image cards | Categories inspected; generated lamp added and materialized into local project media. Earlier lamp→armchair drag swap and persistence passed. Search/favorites code reviewed; not exhaustively browser-tested in this follow-up. |
| Upload scene / image, Characters, Environments | Existing upload/source/actor layer paths retained; earlier image upload and source handoff passed. Saved-bank content depends on the user's library. Actor images are 2D layers. Video background replacement needs a subject matte. |
| Object move, resize handle, Smaller/Larger, numeric position/width | Prior desktop/mobile pointer resize passed; current numeric 75/60/12% and reviewed quick edit to 9.6% persisted. Preview zoom does not mutate placement. |
| Duplicate, Hide, Remove | Browser assertions verified layer counts and undo/redo. |
| Turn, opacity, shadow, flip, behind actor, reset; layer ordering/lock | Real model controls with existing model coverage; not all combinations re-exercised in browser. Shadow is a 2D approximation; behind actor needs a matte to demonstrate occlusion. |
| Lighting tray, strength, spread, remove | Key light added on mobile; strength/spread edited and light removed. Other light kinds use the same model. They are flat overlays, not physical relighting. |
| Spotlight / Power / Power auto; 3D model attachment | Explicitly Blender-only settings. Spotlight toggled, but Blender rendering/model import not certified here. These do not change the 2D composite physically. |
| Look presets/sliders, atmosphere, actor shadows | Existing 2D filters and approximations retained; not all sliders browser-certified in this pass. |
| Area selection, material references and assignment, removal | Earlier static video-area polygon, material upload and free render passed. Source-change and deleted-target regression coverage exists. Manual masks are fixed-frame masks, not temporal tracking. |
| Quick command preview / Apply / Cancel | Preview and Apply tested on alternate take; output width persisted. Explicit local commands, not an LLM chat. |
| Check MCP proposals | Prior actual local MCP read/propose/review/apply/undo passed. Claude Code reported Connected after approved setup. Hosted Grey proposals / ChatGPT hosted connection are not certified. |
| Prepare: subject selection, describe, cut-out | UI exists; paid segmentation/cut-out not run without an enforceable approved limit. No claim of successful provider generation. |
| Looks/saved sets: Save, Use here, Use on all, Delete | Existing saved-set implementation and unit coverage retained. Not all cross-shot application paths browser-certified in this pass. |
| Render draft, Keep as take | Real local FFmpeg export passed twice with generated assets; latest alternate-take export kept as Take 3 while both originals remain. |
| Not this one; bring in Blender render/export set | Controls retained; not separately exercised in this pass. Blender requires local support. |
| Relight / Make it real / generate object or material | Provider-dependent, priced actions. Not submitted; no paid-generation certification. |
| Prepare/Edit/Render/Advanced Blockout | Basic mode navigation exercised. Blockout is separate from the 2D compositor, not a solved 3D scene. No full 3D/camera tracking claim. |

## End-to-end take evidence

Project `fab15291-493d-42bb-b7e9-9b539509a98c`, shot `a5c7f688-0b90-4aee-8c26-073e14e5c85e`:

- Take 1: original room clip with 2-second leader trimmed away, existing warmth edit, no props.
- Take 2: mirrored room clip, trim 0. Select in editor → Grey Room loaded `/api/local/grey-alternate-take.mp4`, time 0.
- Add lamp, position 75%/60%, width 12%, quick command smaller → 9.6%; Save now → reload retained 9.6%.
- Free draft rendered at 1920×1080; visually inspected extracted frame contains mirrored room and lamp. Keep as Take 3. Takes 1 and 2 remain.
- Return to Take 1 → Grey Room loaded `/api/local/clip-handoff-test.mp4`, time exactly 2, zero props.
- Mobile rapid Take 1 ↔ Take 2 navigation initially reproduced stale saved input; after awaited-save fix both directions immediately opened correct source/trim/layers without reload.

Artifacts under `../output/playwright/`: `grey-fit-before.png`, `grey-fit-after.png`, `grey-focus-laptop.png`, `grey-fit-mobile.png`, `grey-focus-mobile-final.png`, `grey-selected-take-render.png`, `grey-original-take-preserved.png`, `grey-second-shot-handoff.png`.

Video: `../output/grey-media/haggs-renders/Grey-Room-Two-distinct-room-takes-2026-10-30-08-19.mp4`. Silent fixture; sound sync is not certified by this export.

## Release gates

Integrate the precise commit with the coordinated release, resolve overlap in editor/project-tabs/takes/global CSS, run combined build/CI and signed-in production smoke checks. Do not independently deploy. Provider-backed features remain unverified without access and an enforceable approved budget. Physical touch devices, all source aspect ratios, Blender output and exhaustive animation combinations remain unverified. No assertion of perfection is justified.

Follow-up verification (2026-10-30): Blender ZIP export and a simple source-only 288×162 CPU still render now pass on Blender 5.2. Original video trim and returning audio trim were corrected and exercised with disposable fixtures. Full Blender movie/3D-model/animation parity remains unverified. Hosted Blender buttons are disabled with a local-app explanation. Provider workflow builders and hosted media staging pass automated tests; paid model output and a signed-in hosted round trip are still unverified.
