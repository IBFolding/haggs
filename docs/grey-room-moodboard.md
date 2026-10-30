# Grey Room mood board

References are collected separately from scene layers. Assign a close-up material to an existing or new surface; an outline is required before it changes the room. Assign a transparent object image to a new or existing object layer; swaps preserve positioning and keys. Removing a card preserves assigned edits. Original comparison, undo, existing tools and new-take rendering remain available.

Still photos support Comfy image segmentation graphs and prepared transparent PNG surface cut-outs. The prepared outline must contain the original selected surface with transparency outside it, not a black-and-white mask. Image sources and outlines loop throughout draft video renders. The draft review displays the original still as an image.

## Verification
- Full unit suite: 986 passing tests.
- TypeScript check passed.
- Real FFmpeg fixture: selected floor becomes red; unselected wall stays neutral.
- Browser: material assignment, object add/swap, card removal preserving assigned object, original comparison, desktop and narrow layout.
- Webpack production build passed. Default Turbopack could not resolve the existing external node_modules symlink in this local environment.
- Live Comfy segmentation, hosted upload/render, and live project reload were not exercised in this task. No paid Comfy job was submitted. The development-only /grey-preview-local route uses a prepared example outline, not live AI detection.

## Generated assets
Built-in Image Generation was used. Project assets are in public/grey-room as WebP; original PNGs remain in the task-2/generated_images directory.
- room-inspiration.webp: architectural editorial photograph, warm ivory room, cream sofa, oak floor, natural daylight, no text or UI.
- smoked-oak.webp: straight-on square smoked oak material sample, even light, no perspective or objects.
- travertine.webp: straight-on square ivory honed travertine sample, natural pores and mineral strata, no objects.
- floor-cutout.webp: transparent extraction of visible wooden floor from the generated room, preserving original canvas and excluding furniture/rug. This illustrative cut-out is not proof of Comfy segmentation quality.

Generation prompt constraints: photorealistic architectural material library quality; no logos, people or text; preserve floor alignment and original lighting for the cut-out. The assets are examples, not users' project media.

## Scene tools and photo areas
- Starting-photo upload keeps reference cards and placed layers, clearing outlines tied to the previous image.
- Draw a polygon on a still photo with pointer clicks or arrow keys and Enter. Saving creates the transparent original-image cut-out without a generation job.
- Door, window, sofa upholstery and table targets join the board. Material finish tiles a reference; Replacement image fits it into a manually outlined area. This is a flat composite, not perspective reconstruction or generative inpainting.
- Furniture and actor shelves reuse the accessory and character banks. Couch/table/lamp/chair prompt starters require an explicit generation click. Actor layers support positioning, scale and depth; use a transparent single-pose image rather than a character sheet.
- Lighting links to the existing lights, grading and atmosphere controls.

Follow-up verification: 990 tests passed; TypeScript passed; the real FFmpeg check in scripts/check-grey-area-render.ts confirms replacement pixels inside the selection and unchanged pixels outside it. Browser checks exercised polygon creation and local upload, replacement assignment, couch prompt starter, actor entry and lighting navigation. No paid generation was submitted.

## Visual tray
The editor Grey Room and local preview use the same SetPanel, ReferenceBoard and Compositor. Reference thumbnails apply with one click after choosing a target once. Saved furniture and actor cards drag onto the canvas; dropping on a prop swaps its image while preserving placement and animation. Selected objects have duplicate/hide/remove actions on the canvas, and manually outlined surfaces expose a swap target there. Existing cut-out, light, animation and export stages retain the same scene model.

Verification: 992 tests pass and TypeScript passes. Browser verified click-to-add, click-to-swap, duplication, drag-to-place at the drop position and drag-to-swap without movement. Touch/keyboard users can click thumbnails and use the existing position controls. This change does not add AI reconstruction.
