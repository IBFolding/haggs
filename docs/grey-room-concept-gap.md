# Grey Room concept implementation — local release hold

Reference: image(7).png and Pasted text(2).txt shared 2026-10-30. The picture is the visual target; it is not evidence that the depicted 3D tools exist.

## Current capabilities
- Per-shot source with trim offset, original comparison, saved scene document and undo/redo.
- Flat image props/actors, direct placement and scaling, masks/materials, preview lights and keyframes.
- Saved character/location/accessory banks, references, upload, ComfyUI cut-out paths and free FFmpeg draft export returning a take to the editor.
- Separate blockout/Blender export; neither shares a true 3D viewport with the footage compositor.
- Local MCP tools read a Grey Room scene and propose validated changes for review/apply. Hosted Grey proposals and an actual installed ChatGPT/Claude session are not verified.

## First implementation slice
- Three-column workspace: searchable assets, central shot canvas, contextual properties. Responsive stacked layout.
- Clear object numeric transforms and sizing, simple default with existing detailed tools accessible.
- Compact playback plus expandable layer/keyframe view, original comparison, source identity and save feedback.
- Validated scene operations shared by quick-edit suggestions and a local MCP proposal flow. Review/apply with stale-scene protection, one undo step, no jobs or credentials triggered by a proposal.
- Preserve the existing edit/render/return pipeline; verify on real local media with no paid generation.

## Gaps deliberately not simulated
- Full 3D object viewport, camera solve/drawn camera paths, temporal mask correction and physically consistent relighting.
- Natural-language planning from an LLM is via an actually connected MCP client; built-in quick edits support only explicit commands, not arbitrary scene generation.
- Hosted MCP permissions/schema deployment is owned by the coordinated integration. Local tools must not silently write unsupported proposals to hosted storage.
- Paid ComfyUI detection and final generation need an enforceable approved cost limit before testing.

## Release dependencies
Existing branch grey-room-unified-release-hold; base 2a1580a (resize), 666b712 (trim), 935b5be (unified scene). No merge, push or deployment. New MCP registration kept in a separate module to reduce coordinator conflicts.
