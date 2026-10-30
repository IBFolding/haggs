HAGGS OPEN-WEIGHT LTX WORKFLOWS

Drag each JSON into current ComfyUI. These are UI workflows, not API prompt JSON.
Install current ComfyUI plus https://github.com/Lightricks/ComfyUI-LTXVideo and the weights named inside each graph. Load your own media before queueing.

Repair This Cut
Load the last frame of clip A and first frame of clip B into the two image loaders. Generate the bridge, then assemble it between the original clips in Haggs. This workflow does not extract frames or assemble source clips automatically.

Give This Shot Handles
Load the final frame of your source clip. Describe the continuing action in the positive prompt. Generate an ending extension, then trim its shared first frame and append in Haggs. This is image-anchored extension, not motion-context continuation. Beginning handles are not implemented.

Continuity Brief
Load a character/scene reference image. In the positive prompt describe persistent wardrobe, props, lighting and the next action. This uses the upstream Ingredients reference workflow; identity is not guaranteed. Additional Ingredients LoRA weights are required as specified by the model loader.

Action on This Beat — Music Video
Load your original song in LoadAudio. Set audio start and duration for one short section. Supply a reference image if desired. Describe the action and musical energy in the positive prompt. Generate sections separately and assemble against the original song in Haggs. Audio conditioning is real; automatic beat detection, exact action timing and full-song assembly are not implemented.

Validation: JSON parsed and embedded subgraph references checked. No GPU generation or Haggs import/execution test performed. Models and source media are not bundled. No paid partner generation nodes were added.
Upstream links: SOURCES.json. Upstream licenses are included; model licenses apply separately.

HAGGS INTEGRATION NOTES (2026-10-30)
These copies were modified for Haggs. Optional GemmaAPITextEncode branches
were removed and their output switches wired to local CLIP conditioning.
The two Repair This Cut frame loaders now have distinct input labels.
Haggs exposes an explicit positive prompt and duration controls (and audio
start for Action on This Beat), and returns the SaveVideo output.
Prompt enhancement still uses the open local Gemma model named in the graph.
A configured local ComfyUI is checked first, including when a cloud key exists.
Missing nodes/weights block running; no similarly named model is substituted
when opening a bundled app, and there is no automatic cloud fallback.
No weights or media are bundled. Respect the included upstream license texts
and each downloaded model's license. These are not all MIT-licensed assets.
No live generation has been verified. The supplied upstream README's validation
statement describes the original bundle, not a successful Haggs render.
