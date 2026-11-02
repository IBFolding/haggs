# Spatial guide and AI proposal integration

This follow-up extends the first increment without enabling any new paid provider route.

## Connected locally

- `greyFrameSvg` accepts the existing GreyScene as an optional input. Legacy calls without spatial content retain the old renderer. Spatial scenes render material colour studies, depth-ordered geometric prop stand-ins and the shared mannequin motion. No asset URL, user SVG or model-produced code is embedded or fetched by the control renderer.
- The browser's first-frame input and displayed generation guide use that same renderer. First-frame generation always uses time zero, regardless of where the preview playhead was left. The existing video action carries the scene into FFmpeg control-video rendering and includes scene direction, prop names, material choices and lighting in prompt context. Prop keyframe times are compressed alongside longer camera paths.
- Generated takes retain the scene. A first-frame candidate carries a fingerprint of the generation inputs; changing those inputs invalidates it. If inputs change while the first frame is being generated, its output remains a take but cannot approve a video for the changed scene. The explicit first-frame confirmation is still required.

## AI handoff that works without credentials

Open **Plan the scene with AI**, describe the scene, choose **Prepare AI request**, and copy the request into an AI chat. Attach images in that chat if image analysis is wanted: the request contains reference names, not private image URLs, and does not claim image understanding. Paste the JSON reply, select **Review proposal**, inspect it, then choose **Apply reviewed proposal**.

Application is additive. Matching existing names keep their original placement; footage, masks, references, prop locks and animation stay intact. The default keeps the existing camera and light. A separate checkbox explicitly opts into replacing the camera path with the proposed still camera/key light. Capacity errors refuse the proposal rather than removing existing people.

The transport adapter (`createSceneProposalProvider`) prepares a bounded request and JSON Schema for an injected provider; mocked provider tests verify this seam. The subsequent automatic transport now reuses the existing authenticated Claude writer path behind a default-off pricing/rollout gate; see AUTOMATIC-AI.md. Its provider calls are tested with mocked fetch, not live generation. Manual handoff remains available, and no automatic request applies scene changes. Real provider fidelity and budgeted validation remain pending.

## Limits

The control guide uses geometry and colour, not textured image/GLB rendering. Existing image props are represented by planes; procedural boxes remain boxes. Material choices provide guide colours and prompt descriptions, not measured PBR reconstruction. Full lighting/compositing remains available in the existing scene editor. The existing model graph retains its prompt-length limit and GPU-cost estimate. Paid model adherence to the new guide is unverified.

## Verification

Focused logic tests cover request/reply validation, mocked provider transport, explicit additive application, preservation, capacity refusal, guide changes and approval fingerprints. A real local FFmpeg test encodes a spatial control MP4 and decodes it, confirming size and material colour, without a provider call. Full suite and updated browser evidence are recorded in QA.md.

## Prop materials and the existing cut editor

Props now have an optional palette material (concrete, plaster, wood or metal). Original leaves legacy props unchanged; clearing a material removes the override. The spatial viewport uses the palette colour/roughness, while the SVG/MP4 guide uses its colour and the shot prompt names the material. This is a colour/material study, not a texture or a change to the source footage compositor. Invalid saved material values are discarded, locked props reject material changes, and existing URLs, keys and source media remain intact. Material changes invalidate first-frame approval through the existing guide fingerprint.

AI proposal JSON may optionally specify a material per added prop. Manual review displays it before application. Existing matching props keep their materials; old proposals without that field remain accepted. Bounded automatic-provider context includes material names, never media URLs. No live provider call has been made.

The cut editor's Reshoot → Block out in grey now receives the same saved scene as the dedicated Grey Room. It exposes the same manual/AI review controls, saves scene edits to the same shot, and uses the existing scene-preserving take helper for first frames and videos. Cut-strip thumbnails and Play in grey include each shot's shared room and props. Existing legacy frames without a spatial scene retain their renderer.

## Direct placement and shared camera movement

The local palette supports dragging **Add box** onto the viewport floor, and dragging a named material onto the floor, wall or an unlocked prop. It accepts only the bounded internal palette payload; URLs/files and arbitrary JSON are not imported. Placement uses the existing prop coordinates and clamps to the room, with a 100-prop capacity limit. The Add box button and inspector selects remain available. On touch, tap a material button then a room surface or prop; Cancel material placement exits without changing the scene.

Arrange from above now includes a green draggable camera marker and an aim line. The view fits the room, camera and saved path, and its landscape height is capped at 60% of the viewport to keep controls reachable. Dragging uses the same angle/distance convention and existing `setCam` path as the original camera controls: a still shot updates its still camera; a keyed/recording shot writes the current playhead key while retaining other keys. Lens and height are preserved. Selecting Camera in the object list enables the existing directional buttons for keyboard/touch adjustment. The original camera path editor, playback, presets and drawing controls remain available.

## Viewport timeline and repeated props

Camera preview, pause, time scrubbing, previous/next key navigation and Save camera key are now beside the large viewport. They use the original Grey Room time/playback state and key functions, with no second timeline or store. Gold dots in the overhead path seek to saved keys. Starting a viewport manipulation pauses playback so the scene is edited at a stable playhead; saving a new key retains the remaining path.

Duplicate selected prop creates a new scene-layer ID and keeps its source URL, material, model reference and animation. It copies nested animation/model records independently, makes the copy visible and unlocked, and offsets the entire horizontal animation by half a metre only when it fits inside the room. Full-width animations retain their positions. The original layer and source file are untouched; the 100-prop capacity limit applies. This is layer duplication, not a media upload or a paid action.

Direct camera dragging/nudging now chooses the angle equivalent nearest the current playhead. Crossing from 359° toward 1° writes 361° for a keyed path, avoiding an accidental full-turn interpolation. Existing unwrapped orbit paths (for example 400°) remain unwrapped; still-camera normalization remains unchanged.

## Visual AI review and selective application

AI review now shows the current and proposed blockouts together, using the same local SVG guide renderer as the shot pipeline. A separate review scrubber previews both at the same time without moving or saving the real shot playhead. The comparison respects portrait/landscape framing. It renders local geometry only and never loads source/reference images or calls a model.

Users can include or exclude proposed people, props and room materials, and preview the existing optional camera/light replacement. Capacity problems appear before application; excluding additions can resolve them without removing existing layers. The button applies the exact candidate held by the preview. Existing matching names and assets retain their original data.

Any saved scene/frame change after review disables application until **Review against current scene** is chosen. This refreshes the local candidate without another model call. Quote consent remains separate. Applying a proposal still leads to fine-tuning and explicit first-frame approval; these previews are not generated film frames.

## New shots from a setup

**Shots and setup** lists every shot on the current board, including unrendered drafts. Creating a draft inserts it immediately after the current shot and copies its people, camera/path, model settings, room, props, lighting and reference assets into independent data. The user can name it and describe new action. Other boards and the original shot/takes are retained.

The new shot has no render, take history or approval. Original footage and actor matte stay on the source shot. Surface material definitions are retained, but footage-bound masks/selections are removed from the copy. The original media files and masks are never changed or deleted. A source-free shot opens directly in Blockout and follows the existing first-frame approval flow.

Creation and the new shot switcher flush saves and confirm a direct IndexedDB write before proceeding. This is necessary because the existing general workspace store can silently fall back to memory; the general fallback remains available for editing, but the new navigation actions require durable storage. A failed write keeps the draft in the current session, displays Retry save, and disables opening it until saving succeeds. Retrying writes the same draft ID rather than creating another copy. User editing is temporarily inert during those operations. Browser QA simulates a local IndexedDB failure; no paid generation is needed to create or test a draft.

## Combined setup undo and redo

The dedicated Grey Room history now stores the frame (people, camera/path and key light) together with the compositing/spatial scene. The existing Undo/Redo buttons and keyboard shortcuts restore both, so undoing an AI application removes its additions and room/camera changes as one operation. Earlier pending slider edits are committed separately before an explicit AI application. Continuous manual edits settle into one history step after 500 ms; undo also captures an edit still waiting to settle.

History restores only setup fields onto the latest shot. It does not roll back newer renders, takes, approval flags or other shot metadata. Legacy shots with no stored frame can return to that state. Equivalent data with reordered object keys or absent optional values does not create empty undo steps. Existing first-frame fingerprints invalidate stale approval candidates when setup data changes. The cut editor continues to use its existing project history.


## Prop motion in the shared viewport

Selecting a prop now exposes Save prop key, Remove prop key and previous/next prop-key navigation beside the existing shared timeline. Save a starting key, scrub forward, then move, rotate or resize the prop: its keyed channels animate through the existing compositor data, spatial guide and control video. Saving another key captures all visible transform/opacity channels. Preview is available for prop motion even with a still camera.

Locks prevent adding/removing keys. Other props, media, materials and camera paths remain intact. Removing the last key bakes the currently visible pose into the static prop, preventing a jump back to older base coordinates. Existing longer compositor animations are retained; these viewport controls only author within the six-second blockout timeline. No new project schema or provider call is introduced.


## AI-proposed camera movement

The version-one proposal contract now optionally accepts `cameraPath`: two to twelve ordered camera keys spanning zero to six seconds. It validates finite/ranged camera settings, complete endpoints and minimum key spacing; unwrapped angles retain intentional orbit direction. Older proposals without this field retain their still-camera behavior. The manual request and automatic provider schema explain the optional motion contract.

Review shows whether the proposal contains a still camera or a move. With camera selection enabled, the existing comparison scrubber previews the proposed path through the shared frame renderer. Applying it writes the ordinary shot camera keys, so viewport playback, first-frame fingerprints, control video and setup history continue to use the same data. Camera selection defaults off; existing paths remain intact unless explicitly replaced. Local/manual and mocked-provider tests do not verify live model quality.


## Individual figure facing

Each person can now have an optional room-relative facing direction. Select a figure in the shared viewport to turn it with the Facing control or use Face camera, which calculates the direction from that person's location to the camera at the current playhead. Existing figures without a facing value keep their original front-facing geometry and legacy rendering behavior.

The 3D view, SVG guides, control-video frames and prompt descriptions share the direction. Walking figures move along their facing direction; explicitly turned figures no longer receive contradictory instructions to walk toward the camera. AI proposals may include facing for newly added people; existing matching people retain their orientation. Facing survives setup copies and undo through the existing frame data; no migration or paid call is required. The Blender stand-in export now includes explicit facing with a direction cue; walking is now baked from the shared guide geometry as described below.


## Selective saved-set reuse and Blender direction cues

Saved sets now offer **Add props** and **Use room materials** alongside the existing whole-set replacement actions. Add props retains existing layers and skips matching names; added props receive fresh IDs and independent animation/model records. It refuses the whole addition if it would exceed 100 props. Room reuse changes only the shared floor/wall palette. Neither action transfers another shot's footage or masks. These actions use the stored scene rather than a resolved preview frame, preserving existing animation bases. Both actions participate in setup undo.

Blender manifests now carry optional normalized figure facing, and the exported Python adds a dark direction cue to explicitly oriented stand-ins. Legacy cylinders remain unchanged. A build-only test in installed Blender 5.2 verified the full generated script, cue position/material and legacy behavior using synthetic local fixtures. No render was run. Walking animation is now baked from shared guide geometry as described below. Shared room materials and procedural box geometry are now included as described below.


## Shared room and box geometry in Blender

When a Grey Room camera accompanies a spatial scene, Blender export now builds the six-metre floor, 3.5-metre rear wall and directional key light using the shared room settings. Palette colours are converted from sRGB to Blender's linear shader inputs; roughness and metalness use the viewport palette. This is a material study, not texture reconstruction or a promise of identical render appearance.

Procedural box stand-ins become actual cubes in room coordinates. Position, grounded size, rotation and opacity keys use linear interpolation, matching the shared scene. The previous Blender interpolation preference is restored after creating each box. Existing image/model props retain their compositor-oriented export behavior, and exports without a Grey camera retain the old geometry path. Hidden props remain excluded; source footage and actor cut-outs remain unchanged.

A build-only run in Blender 5.2 verified start, midpoint and endpoint transforms, animated opacity, palette shader values, floor/wall/key light creation and a legacy image prop. No render or provider call ran. Walking figures now use baked shared geometry; image/model prop coordinates are still the legacy compositor layout rather than full spatial reconstruction.


## Shared walking animation in Blender

Walking figures now bake `figureSegments` at the export frame rate, using the same time, facing, interpolated camera and camera-stop distance as the spatial viewport and control guide. Blender builds articulated limb/head/face meshes from these samples and keys their centres, lengths and rotations. It does not also create a static cylinder for a walking figure. Static legacy figures remain on their existing path, and the export opens at frame one.

The bake is bounded to 2,880 frames (the existing route's 120 seconds at 24 fps) and 1–60 fps for direct helper calls. It exports geometric stand-ins, not rigged/skinned characters or generated motion. Longer exports create larger JSON and Blender animation data. A real Blender build-only check compared all segment endpoints/centres at first, middle and final samples; no render or paid model ran.

Procedural spatial boxes no longer add their internal SVG thumbnail to the asset bundle. Their geometry/materials need no texture file, and skipping that unused thumbnail avoids the existing local-file-only packager rejecting the export. Image/model assets and actor footage keep the existing gathering rules.
