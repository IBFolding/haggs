# Verification — 2026-11-02

## Reconciliation candidate

The combined candidate on GitHub main `5307944` passed 1,303 tests, a production build including TypeScript, 26 production Grey Room browser checks and five main-workflow checks. See RECONCILIATION.md for exact refs, evidence, cleanup and release holds.

## Enhancement branch checks before reconciliation

- **1,285 tests passed, zero failed, zero skipped**, using `TMPDIR="$PWD/runtime-tmp" node --import tsx --test --test-concurrency=2 'src/**/*.spec.ts'` (39.8 seconds). Full output: `output/walk-export-full-tests.log`.
- TypeScript passed after final source changes: `node node_modules/typescript/bin/tsc --noEmit` (`output/walk-export-typecheck.log`).
- `git diff --check` passed.
- **Twenty-six real Chromium browser checks passed, zero page errors**, including desktop pointer placement, shared persistence, camera paths, 390×844 mobile layout/touch placement, 9:16 framing, the manual AI request/review/explicit-apply flow, and the default-disabled authenticated quote action. See `browser-results.json` and screenshots, including `proposal-review.png`, `mobile-inspector.png` and `cut-shared-scene.png`.
- A real local FFmpeg test encodes the spatial scene into an MP4, decodes its first frame and checks dimensions/material colour. No model call is made. Source: `src/server/grey-spatial-control.spec.ts`; output: `output/control-video-test.log`.
- New tests verify malformed AI replies, mocked provider transport, additive application, capacity refusal, existing-data preservation, geometric guide safety, animation, first-frame fingerprints, and preservation of edits made while generation is pending.

The production build passed on the first increment (`5a006d3`). It was not repeated for this follow-up to avoid additional heavy builds under the reported Mac resource pressure. The follow-up route compiled and ran in the local dev server, and final TypeScript/full-suite checks passed. The dev server was stopped after QA. No other session was interrupted.

Twenty-two focused edit-safety, spatial and proposal tests passed (`output/history-focused.log`). Ten real local Postgres assertions passed, including twelve concurrent anonymous-role claims with exactly one winner, denied direct table access, wrong-secret refusal, expiry, and consumed-quote persistence after restart. See `database-results.json` and MULTIWORKER.md.

The material follow-up verifies optional AI materials, preservation of existing matching props, safe palette validation, locked props, material clearing, guide/prompt propagation and first-frame invalidation. Browser QA also verifies the existing cut editor renders the shared scene in thumbnails and sequence playback, and saves room edits without changing source media. The first cut-editor harness attempt lacked a rendered shot; a local still fixture corrected that test setup. No generation was run.

The direct-placement follow-up adds native drag/drop checks for material and box placement, overhead camera dragging and keyboard/touch nudges that preserve other path keys, and tap-to-apply materials on mobile. Pure tests reject malformed/URL-bearing payloads, enforce prop capacity and locks, preserve assets and bound camera positions. The first preview attempt started before the server was ready. Camera QA then exposed fixed-navigation overlap; the landscape viewport is capped at 60vh and the harness centers it before dragging. Final browser results contain no page errors.

The viewport-timeline follow-up verifies playback and key navigation use the original time state, saving a new key preserves existing endpoints, and mobile prop duplication leaves originals/assets intact. Logic tests verify independent animation/model copies, capacity and room limits, and continuous camera angles across zero while retaining multi-turn orbits.

The visual-review follow-up verifies portrait comparison images, selective additions, retained/replaced camera paths, preview scrubbing without saved changes, and an explicit re-review requirement after scene edits. Pure tests cover capacity refusal before applying, opt-out preservation and geometry that embeds no private media URLs. The final browser run passed all nineteen checks with no page errors.

The setup-shot follow-up verifies source/take/approval preservation, independent copied data, removal of footage-bound masks from the draft, insertion order and board isolation. Browser QA simulates a failed IndexedDB write, retries the same draft ID, reopens it in Blockout and edits it without changing the source shot. This exposed the existing store’s silent memory fallback; the new creation/navigation paths now require a direct durable write. An earlier harness attempt also needed a project-hydration wait. The final complete run passed all twenty checks. See `new-setup-shot.png`.

The combined-history follow-up verifies that camera undo/redo restores complete paths, and AI undo/redo restores figures and the scene together. Pure tests verify that newer takes/render results/approval metadata survive setup restoration, legacy absent frames can be restored, and equivalent setup data does not create empty undo steps. The final complete browser run passed all twenty-two checks.

The prop-motion follow-up adds Save/Remove prop key and key navigation to the shared viewport. Twenty focused spatial/guide tests passed (`output/prop-motion-tests.log`); they cover interpolation after reopen, lock enforcement, invalid times, preservation of other layers and holding the visible pose after removing the final key. The complete browser run passed twenty-three checks with no page errors, including mobile creation/navigation/removal of prop motion. An initial test incorrectly required object identity after the existing immutable scene merge; it was corrected to assert preserved values. Preview was stopped afterward.

The AI camera-motion follow-up verifies optional path validation, increasing bounded keys, consent before replacing an existing path, backwards compatibility with still-camera proposals, local preview scrubbing, and the quoted automatic gateway with mocked responses. Browser QA passed all twenty-four checks with no page errors, including explicit path application and Undo restoring the prior camera. No live model was called. Eighteen focused tests passed: `output/ai-camera-tests.log`; browser output: `output/ai-camera-browser.log`.

The individual-facing follow-up passed thirty-nine focused tests (`output/facing-tests.log`) for safe normalization, legacy preservation, camera-relative aiming, guide geometry, walking prompts and additive AI orientation. All twenty-five browser checks passed (`output/facing-browser.log`), including mobile facing, Face camera, preservation of scene/camera data, and a newly proposed person facing sideways. The existing person keeps their orientation. Preview stopped after verification.

The selective-reuse/Blender follow-up passed eighteen focused tests (`output/reuse-tests.log`) covering independent prop animation, matching-name preservation, atomic capacity refusal, material-only reuse and export metadata. All twenty-six browser checks passed (`output/reuse-browser.log`), including mobile selective set reuse and two-step Undo. The cut-editor route took 2.8 minutes to compile under load; it completed successfully and the preview was stopped afterward.

Installed Blender 5.2 successfully executed the complete generated export script against synthetic local fixtures. Four build-only assertions verify the figure direction cue, position/material and legacy cylinder preservation. See `blender-results.json` and `output/reuse-blender.log`. The first fixture omitted the actor image required by the existing exporter; adding a synthetic PNG corrected the fixture. No render, model request or network call was made; Blender config/cache and fixtures stayed on the external drive. Later increments add shared room/box geometry and baked walking as described below.

The spatial Blender export increment passed thirty-three focused tests (`output/spatial-export-tests.log`) and six real Blender 5.2 build-only checks (`spatial-blender-results.json`, `output/spatial-export-blender.log`). These verify actual cube/room geometry, key light, shader palette settings, linear animation at the midpoint and endpoints, opacity, and retained legacy image geometry. No renderer or network provider ran. There are no browser component changes in this increment; the prior twenty-six desktop/mobile checks were retained and not repeated. Full suite/typecheck results above cover the updated exporter.

The walking Blender increment passed twenty-one focused tests (`output/walk-export-tests.log`), including exact guide-sample equality with a moving camera/facing, camera-stop behavior, bake bounds and procedural-box asset omission. Five real Blender 5.2 build-only checks verify articulated meshes, segment endpoints/centres at first/middle/final samples, absence of duplicate cylinders, preservation of static stand-ins and opening frame one. See `walking-blender-results.json` and `output/walk-export-blender.log`. No render or network/provider call ran. No browser components changed, so the prior twenty-six desktop/mobile checks were retained without rerunning.

## Browser harness

`scripts/grey-space-ui-check.mjs` follows the repository's Puppeteer-based local checks. Set `PUPPETEER_CORE` to an installed puppeteer-core module and `CHROME_PATH` if Chrome is not at its macOS default. Start the isolated app on 127.0.0.1:3123 first. The harness creates an isolated browser profile and fixture project, intercepts the development bridge, and never presses paid generation buttons. It scrolls controls clear of the existing fixed mobile navigation before clicking. `GREY_SETUP_ONLY=1` reruns only the setup-shot case against an existing fixture and writes `setup-results.json`; the final recorded run uses the complete harness.

## Environment notes

Dependencies were installed with scripts disabled and an external-drive npm cache. The existing external-drive FFmpeg binary was copied into this isolated install for media tests. An existing cut export fixture used unescaped `file://` paths; it now uses `pathToFileURL`, so the real export test also passes on paths containing spaces. No export runtime behavior changed.

The first production build attempt was blocked by sandbox DNS for existing Google Fonts imports. The network-enabled local retry passed on the first increment, including compilation, TypeScript and static generation (`output/build-network.log`). No deployment was attempted.

## Deliberately unverified

Paid Comfy/model runs await explicit budget approval. The authenticated automatic transport is implemented behind a default-off rollout/pricing gate and tested using mocked fetch through the real writer transport. No live provider call has been made. Shared quote storage and atomic claims are implemented and locally database-tested; their additive migration remains unapplied remotely. See MULTIWORKER.md. Spatial guide rendering and local MP4 encoding work, but a live model's fidelity to that guide has not been tested. Textured images and arbitrary GLB models are not rendered into the guide; image props use geometric stand-ins and prompt context. See INTEGRATION.md.
