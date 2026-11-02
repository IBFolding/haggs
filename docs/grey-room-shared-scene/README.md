# Shared Grey Room increment

A separately verified local candidate now exists on `review/grey-room-main-5307944` in the sibling `grey-room-reconciliation` checkout. See RECONCILIATION.md. The source enhancement branch remains unchanged. The observations below describe its earlier work.

Branch: `feat/grey-room-shared-scene`, isolated external-drive shared clone, based on `grey-room-on-main` (`386f60e`). Original checkout is untouched.

Remote main inspected on 2026-11-02: `83766161d9f3841cd916b82ac1f1299698b5037a`. Local main was `8481ae4`, origin/main `8724030`. Remote main adds robots/sitemap and workflow catalog outage handling; reconcile that work and the active custom-workflow task before integrating. No push, merge or deployment performed.

## Scope

The Blockout workspace gains a large lazy-loaded Three.js viewport. It reads the existing shot GreyFrame and GreyScene, not a separate project. Figures, walking motion, camera playback, scene lights and prop layers share existing data. A plan view supports pointer/touch placement; explicit selection and move buttons provide a keyboard alternative. Existing prop locks and keyframes remain honored. Floor and wall material colour/roughness choices and scene direction save on GreyScene and survive normalization. Existing source, masks, references, take records, compositor, editor, and approvals are retained.

The SVG generation guide now carries spatial props and material colour studies into both first-frame inputs and control videos. See INTEGRATION.md for the connected pipeline and remaining limits. Existing footage prop images appear as planes, with a placeholder if loading fails. Existing model attachments remain intact but this increment does not load arbitrary GLB/FBX files. No claim of full photorealistic material/asset generation is made.

`src/story/grey-space.ts` defines a bounded Zod proposal contract and cancellable adapter hook. It accepts description, references, current frame and scene and returns a validated, reviewable proposal. A manual AI request/reply flow now validates and previews proposals before an explicit additive apply action. The authenticated automatic transport is now implemented behind a default-off rollout/pricing gate; see AUTOMATIC-AI.md. No live call has been made. Enabling it still needs reviewed pricing and budget-approved verification. Generation input changes invalidate stale first-frame candidates.

## Reconciliation

Changes are limited to Grey Room modules, scene normalization, scoped CSS, dependencies and tests. No workflow catalog, credentials, billing or Kinetic files are changed. Coordinate package lock and shared `globals.css` with the custom-workflow task. Existing four Claude Grey Room commits are prerequisites; do not merge the `grey-room-one-workspace` branch.

## Licenses

Three.js 0.187.0: MIT, copyright Three.js authors; verified upstream https://github.com/mrdoob/three.js/blob/dev/LICENSE and installed `node_modules/three/LICENSE`. License must ship with distribution. Type declarations are MIT (`@types/three`). This increment uses original procedural stand-in geometry and an original SVG box image, with no downloaded model or material assets. Existing user-supplied references retain their own rights requirements. No pose editor code was copied.

## Paid verification

Real Comfy first-frame/video tests are pending explicit budget approval. The inherited `GREY_SHOT_USD` estimate remains unverified against real billing. No credential changes or paid calls were made.


Reconciliation checkpoint (local refs re-read 2026-11-02): original `main` remains `8481ae4`, Claude's `grey-room-on-main` remains `386f60e`, and original `origin/main` is `8724030`. The isolated enhancement branch already contains Claude's four prerequisite commits. These are local-ref observations, not a new remote fetch. Re-read current remote and active-task changes before integration; retain the shared CSS/package-lock review noted above. No merge, ref movement or edits were made in the original repository. The `grey-room-one-workspace` checkout remains excluded.
