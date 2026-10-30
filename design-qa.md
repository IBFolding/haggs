# Grey Room design QA — 2026-10-30

Status: local visual review completed for the implemented 2D workspace. Merge/deployment hold remains. This is not full concept feature parity.

## Reference and captures

Reference: `../output/grey-concept/concept.png` (1672 × 941), supplied UI libfile_809ee07fe6508191b17e77f1eea83918. Handoff: libfile_13443e09d2d881918b81e912fd436200.

- Desktop: `../output/playwright/grey-desktop-final.png`, 1672 × 941. Viewed together with reference in the same image-tool result.
- Mobile: `../output/playwright/grey-mobile-fixed.png`, 390px viewport, full scrollable page. No mobile reference was supplied; checked responsive behavior against desktop hierarchy.
- Render frame: `../output/playwright/grey-final-render.png`, 1920 × 1080.

## Comparison

- Typography: compact sans-serif hierarchy with muted labels and lime active states. It uses Arial rather than an identified source font; support text is smaller than the concept.
- Spacing: dominant canvas, flat integrated asset tray and inspector, compact header and footer. The actual three-track project yields a shorter timeline than the six-track concept. Canvas preserves source aspect ratio.
- Colors: near-black green panels, subtle borders and lime actions follow the source. Removed earlier oversized cards and pill-heavy hierarchy.
- Images: four generated transparent furniture assets are real selectable/renderable layers. The actual trimmed test clip remains the scene; the concept's desert actor is not substituted.
- Copy: labels describe implemented 2D behavior. Prepare and Preview edit replace unsupported automatic AI/camera claims. Advanced capabilities remain accessible rather than represented by dead controls.

## Fixed during comparison

- Duplicate starter cards after adding their images.
- Footer navigation icon inheriting thumbnail dimensions.
- Shot thumbnails showing the red pre-trim leader instead of the chosen cut.
- Mobile body overflow clipping everything below the initial viewport (P1). Recapture verifies complete inspector/timeline and document width 390px, without horizontal overflow.
- Mobile scene inventory image containment.

No remaining blocking visual defect observed in the captured states. Other tabs and complex projects are not exhaustively visually certified. Physical phone/touch testing was not performed.

## Browser evidence

CUA tab control timed out. Explicitly requested Playwright fallback succeeded with a named, isolated profile after sandbox approval; it did not reuse the active Chrome tab. Imported a disposable project through the UI: `9d511776-2581-440a-8bb0-573761c6434d`, shot `a5c7f688-0b90-4aee-8c26-073e14e5c85e`.

Verified starter lamp click/upload, position 25/60, width 12.5%, mobile Smaller -> 10%, drag armchair onto lamp preserving position/width, persistence after reload, new lamp addition, direct handle drag 25% -> 14.183%, and position 18/63. Free draft rendered, loaded without media error, and was kept as Take 2 alongside Take 1 in the existing editor. Extracted video frame visibly includes both generated assets.

Latest video: `../output/grey-media/haggs-renders/Grey-Room-Studio-workspace-test-2026-10-30-07-19.mp4`, H264 1920 × 1080, 3.96 seconds, silent source. No paid AI job ran.

## Limits

2D compositing/static masks only. Preview lights are overlays, not physical relighting. No camera tracking or temporal masks. Local MCP protocol and review/apply tested earlier; no live ChatGPT/Claude connection or hosted Grey proposal deployment verified. These remain release/integration limitations, not hidden capabilities.

## Follow-up: laptop fit and take workflow

Latest evidence in `docs/grey-room-control-audit.md`. At 1280×720, expanded layers consumed enough height to make the scene 482×271. Default-collapsed layers increase it to about 649×365; Focus produces about 969×545. Added Fit/125/150/200% controls with scroll confined to the preview. Updated mobile focus removes empty vertical padding; screenshots `../output/playwright/grey-fit-after.png`, `grey-focus-laptop.png`, `grey-focus-mobile-final.png` were inspected. The viewport does not change render framing. No full concept parity or exhaustive device certification is implied.
