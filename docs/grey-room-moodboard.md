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
