# Grey Room coordinated release handoff

Status: local implementation and regression checks complete; **merge and deployment held by the user**. No remote publication is part of this handoff.

## Integration unit

- Local branch: `grey-room-unified-release-hold`.
- Parent commit: `78e3a62522dfaee06aa4c2d95e61542277b161b5` (PR #59 source commit).
- Production equivalent of the parent: squash commit `4964b6ca29bae930a4d63bf99f8fdce3a31400c8` from PR #59.
- The commit containing this document is the complete follow-up integration unit. Record its full SHA with `git log -1 --format=%H grey-room-unified-release-hold`.
- Integrate only that follow-up commit onto the coordinated release branch containing PR #59 or its equivalent. Do not reapply the PR #59 parent; it was already squash-merged.

## Included changes

- Lighting and atmosphere in Edit scene; simultaneous prop and light manipulation on the same compositor.
- Persistent scene inventory for placed images, hidden props, surfaces and lights, with selection opening their controls.
- Removal of the empty mood board's living-room illustration; development sample explicitly labelled as an example.
- Shot-specific source initialization and keyed page identity; saved original retained for comparison and export.
- Deleted-surface target guard: preserve scene and ask for a new target instead of crashing or creating a UUID-named surface.

## Dependencies and collision points

Requires the existing Grey Room scene model and PR #59 tray helpers. No new package, schema migration, environment variable, provider credential or paid job is required.

Living-comic and Recreate work must retain their own editor handoff and selected-shot media. This change reads `shot.render` and `shot.greyScene` and does not modify the editor, take creation helpers, provider adapters or their workflows. No files in those tasks were edited. Their branch state and readiness have not been independently verified here.

Potential overlap to review during integration: `src/app/globals.css`, the Grey Room page/studio, compositor, SetPanel and ReferenceBoard, plus `src/story/grey-tray.ts`. Preserve any concurrent changes there; integrate in the release owner's branch rather than resetting or copying whole directories. The CSS addition is confined to `.gs-scene-items`.

MCP integration remains owned by the other task; this work neither changes nor certifies it.

## Evidence

- Full local suite: 999 tests passed, 0 failed (`/tmp/grey-stale-tests.log`).
- TypeScript passed (`/tmp/grey-stale-tsc.log`).
- `git diff --check` passed.
- Regression reproduced the deleted-surface TypeError before the fix and passed afterward.
- Local browser: add image and light, move light, switch controls through scene inventory, hide/show image, compare original and return, delete selected Wall then choose another reference, explicitly select Wall and successfully recover. No paid generation.
- Read-only production inspection confirmed the user's robot-and-lighthouse media is the displayed scene; this is evidence of the existing production source handoff, not deployment of these changes.

## Remaining release checks and limitations

- Run a coordinated production build and CI after integrating all tasks; no fresh production build was run for this local follow-up.
- Run signed-in end-to-end checks with two distinct cuts for handoff, save/reopen and before/after on the combined candidate. Source isolation and persistence are regression-tested at the model level; local UI tests use the development sample.
- Check the combined editor handoff with living-comic and Recreate changes before release. No merge/deployment may occur until the user's hold is lifted or their stated coordination condition is met.
- Paid detection, AI relighting and final generation remain untested without an enforceable approved spending limit. Flat image layers and preview lights do not establish 3D replacement or physical lighting.
- The supplied Library screenshots yielded descriptions through read, not inspectable image bytes; the live browser canvas was visually inspected instead.

Excluded local artifacts: `.next-webpack/`, generated `AGENTS.md`, test logs and local media. Existing user media and unrelated task repositories were preserved.

## Trimmed clip round-trip follow-up

The follow-up commit after `935b5be7cd36e9a067e2af17041d279d399f3758` fixes an actual editor handoff issue: the source file was correct but `shot.trimIn` was ignored. The saved Grey Room source now retains that offset, preview and original comparison seek to it, and draft FFmpeg picture/audio inputs seek to the same point. Keeping a newly rendered take resets the shot's trim to zero because the exported media already contains the selected segment.

Local browser round trip passed on isolated project `638bb328-8c44-4840-b615-9548287a82a0`, board `main`, shot `78e90808-65a6-46f6-b9a9-3bb6bb6895ff`: import test clip, trim first two seconds in editor, open Grey Room (source currentTime 2 at playhead 0), upload transparent test lamp, add light, render free draft, keep as Take 2, return to cut and play, reopen Grey Room, compare original at source time 2. Both lamp and light persisted; original take remains listed. Output 1920×1080, 3.96 seconds (test source frame boundary), no playback errors. No paid AI jobs. Test video: `../output/grey-media/haggs-renders/Grey-Room-Trim-this-test-clip-at-2-seconds-2026-10-30-05-09.mp4`; screenshot: `../output/grey-room-returned-take.jpg`.

Full suite passed 1001 tests; final focused source/render suite passed 14 tests after the last source change; final TypeScript check passed. A real FFmpeg pixel check confirmed the trimmed render skips the red leader. Keep this follow-up together with the unified workspace commit. Still no merge or deployment.

This verifies the local flat-composite round trip. Paid moving-subject detection, physical relighting, Blender trim handling, combined release integration, and switching back to an older take's independent trim state are not certified by this test. Existing editor overlays, reframing and effects are not baked into the Grey Room input by this change.

## Object resizing follow-up (local release hold)

Added visible Smaller / Larger controls with a percentage readout, keyboard-operable corner handles, larger touch targets and touch-scroll prevention while manipulating objects. Corner dragging now scales from the initial pointer radius, avoiding jumps for tall or rotated images. Object actions sit below the canvas so the toolbar cannot intercept the resize handle. Locked objects remain protected.

Browser evidence on the local clip test: Smaller 25% → 20%, Undo → 25%, reload retained 20%; phone-width Smaller 20% → 16% and Undo → 20%; keyboard handle 20% → 18%. After moving controls below the image, desktop and 390px viewport pointer drags both shrank a visible lamp from 9% → 5%, with one Undo restoring 9%. Temporary visibility was restored; existing references, duplicate props and positions were preserved. Phone-width browser simulation is not a physical touchscreen-device test.

Screenshots: `../output/grey-room-resize-desktop.jpg`, `../output/grey-room-resize-mobile.jpg`. Focused resize/scene tests: 23 passed. Full suite: 1002 passed, zero failures. Typecheck and git diff --check passed after final layout change. No paid generation, merge or deployment. These changes build on trim-start commit `666b7122ed7c2d4377476de2b0eb6acad77885fc`; combined-release integration must include both earlier hold commits and this follow-up. Integrated candidate and production have not been certified with this resizing patch.

## Concept workspace follow-up — 2026-10-30

This section supersedes earlier statements about absent Grey MCP tools or unavailable reference image bytes. The source image was downloaded and visually inspected. See `design-qa.md` for the actual desktop/mobile comparison and evidence.

The current follow-up builds on `2a1580a`, `666b712` and `935b5be` on `grey-room-unified-release-hold`. Include all dependencies. User merge/deployment hold is unchanged. No push or production verification is claimed.

Added cohesive studio workspace, searchable asset categories, four generated transparent starter props, contextual numeric transforms, source import, scene tracks, quick commands, save feedback, static video-area selection at the trimmed frame, and local MCP scene read/propose tools with strict validation and stale-scene protection. Built-in props are uploaded to project media before placing, so exported renders resolve them. Original assets and advanced generation controls remain accessible.

Collision points now include global CSS, Grey Room studio/components, `scripts/mcp.ts` (one registration import/call), `src/server/bridge.ts` (Grey proposal kind), and new `scripts/grey-mcp.ts`/`src/story/grey-actions.ts`. Coordinate hosted MCP schema/permissions separately: Grey proposal tool intentionally rejects hosted mode. No credential or access changes were made. Existing dependencies suffice; Tabler outline SVGs include the MIT license.

Browser verification used an isolated Playwright profile and imported test project `9d511776-2581-440a-8bb0-573761c6434d`. Generated lamp placement/resizing, mobile Smaller, armchair drag-swap preserving transforms, reload persistence, direct resize handle, local free rendering, Keep as a take and return to editor passed. Output 1920×1080 H264, 3.96 seconds; Take 1 remains alongside Take 2. Earlier isolated QA additionally tested static video-area material edits and local MCP proposal review/apply/undo. No paid AI generation.

Remaining: combined release integration/build and signed-in production checks, actual ChatGPT/Claude MCP client connection, hosted Grey proposal support, paid AI workflow testing with an approved enforceable budget. No true 3D, camera tracking, temporal masks or physical relighting. Desktop/mobile viewport testing is not a physical touchscreen-device certification. Do not describe the full supplied concept as complete.

Final verification: 1,010 tests passed, zero failed (`/tmp/grey-final-suite.log`); TypeScript passed (`/tmp/grey-final-typecheck.log`); `git diff --check` passed. Local screenshots and videos remain outside the commit; documentation identifies their paths. Commit the scoped implementation and assets only, excluding generated build caches and local browser artifacts.

## Canvas fit and per-take handoff follow-up

Based on `9108e87a955eb82a975799ce174d5d387379e3cf`. See `grey-room-control-audit.md` for the full control inventory, browser evidence and unverified capabilities. This follow-up adds Fit/zoom/Focus canvas, collapses layers initially, and prevents editor take cards from collapsing. It isolates editable Grey scenes and trim per take, awaits saving before opening Grey Room, and routes the header link to the selected editor shot rather than always the first shot.

Integration conflicts to review explicitly: `src/story/takes.ts`, `src/story/model.ts`, `src/app/project-tabs.tsx`, `src/app/board/[id]/cut/editor.tsx`, Grey studio/timeline, and global CSS. The new optional Take fields are backward compatible JSON; historical per-take trims that were never stored cannot be recovered. Generic new takes start a fresh Grey scene; Grey Room output passes its editable scene explicitly. No schema migration, key change or paid job.

Browser: laptop 1280×720, mobile 390×844. Two distinct existing takes → select alternate → add/resize lamp → save/reload → free render → Keep as Take 3 → original Take 1 restores its own source at 2 seconds with zero props. Rapid mobile switches initially reproduced a save race; awaited save fixed both directions. A separate two-shot fixture confirmed the selected SECOND shot link and source. Scene dimensions improve from 482×271 to approximately 649×365 by default, 969×545 in Focus. Mobile 200% zoom stays inside the 390px document.

Final suite: 1,012 passed, 0 failed (`/tmp/grey-handoff-final-tests.log`). Typecheck passed (`/tmp/grey-handoff-tsc.log`). `git diff --check` passed. User asked the coordinator to finish and deploy; this task does not independently merge or deploy. Integrate and run coordinated build/CI and production checks first. Do not present the control inventory's unverified provider/Blender/animation paths as tested.

### Follow-up: Blender trim and provider boundaries

On `grey-room-unified-release-hold`, following `751d4c2`:
- Exported original movie is now trimmed to the selected source start and normalized to the bundle's 24 fps. Prepared alpha mattes are preserved without a second trim or lossy H.264 conversion. Original assets remain available for other references.
- Blender return seeks source audio at the same trim, while keeping the returned picture at zero. Invalid offsets are rejected; silent sources retain the picture. Added three regression tests.
- Hosted Blender controls explicitly explain their local-app requirement and are disabled; their endpoints are development-only. Hosted draft rendering is a separate supported code path, not this Blender transport.

No-charge verification: local export endpoint returned ZIP 200; unpacked script built successfully in Blender 5.2.0 and rendered one 288×162 CPU frame. Inspected the image: room at the trimmed start, not the red leader. This verifies a simple source-only set, not every model/material/animation or a full Blender movie. Local audio-return endpoint succeeded with silent-first-two-seconds/tone-afterwards fixture; first 0.25 seconds of returned audio RMS was 0.08467, demonstrating the tone starts immediately after trim. Existing 36 provider-workflow/hosted-staging/Blender/take tests passed; three audio regression tests added. No provider jobs submitted.

Still unverified: live provider-generated relight/Make it real quality (requires paid provider execution and approved spending limit); signed-in hosted upload→render→take save/reopen (requires a signed-in disposable production test project on the coordinated deployed revision); full Blender animation, arbitrary imported 3D models and matte frame-rate conversions. Local Claude Code/Codex MCP protocol testing does not certify ChatGPT web or Claude Desktop connectivity. No credentials changed, merge or deployment performed.
