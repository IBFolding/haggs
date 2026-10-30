# Haggs Contest Lab — ComfyUI only

Seven experimental effects, each with an open-weight LTX workflow, an official MiniMax H3 Max Comfy partner workflow, and a reuse-existing-video workflow. Includes the custom nodes that actually perform the effects. No Fal integration, external editor, API wrapper, or separate application is required to use these workflows.

## Install

1. Update ComfyUI to a version containing its current VIDEO interface and, for H3, the official `MinimaxHailuo03FirstLastFrameNode` node. Old installations may not recognize these nodes or embedded LTX subgraphs.
For LTX, also install the official [ComfyUI-LTXVideo nodes](https://github.com/Lightricks/ComfyUI-LTXVideo) through ComfyUI Manager if your template reports missing LTX nodes.

2. Copy `custom_nodes/ComfyUI-HaggsContestLab` into your ComfyUI `custom_nodes` folder. Restart ComfyUI. This pack uses NumPy and PyTorch already provided by ComfyUI; it does not install model weights.
3. Copy the enclosed `input/haggs` folder into your ComfyUI `input` folder. These are tiny synthetic fixtures, not AI-generated footage or someone else's performance.
4. Start with `workflows/reuse-existing-video/03-portal-paint.json`. Drag the JSON onto ComfyUI and Queue. This exercises the compositor without any model generation or paid service. All seven reuse workflows use the same bundled source, song and generated-layer stand-in.
5. Choose one of the LTX or H3 workflows when you are ready to generate a real effect layer. Replace the two video loaders, music loader, and reference images with your own inputs.

## Which files do what?

- `workflows/LTX-open-weights/`: seven generation-to-compositor graphs based on the official LTX-2.5 first/last-frame template. Embedded subgraphs are included. Obtain the exact model files named inside the graph; model licenses apply separately. These graphs contain no paid partner nodes or closed-source API calls. Model memory requirements depend on your GPU and configuration.
- `workflows/MiniMax-H3-Comfy/`: seven graphs using the official MiniMax H3 Max partner node in ComfyUI. Use the account/credits required by your Comfy installation. These are paid API workflows and are not Open Weights Only entries. `enable_paid_generation` is OFF initially. Review Comfy's current price and selected settings before turning it on. No optional prompt-rewrite/upscale API stages are included.
- `workflows/reuse-existing-video/`: seven compositors with no generation nodes. Load an existing LTX/H3 take and iterate on effects without requesting another generated take.
- `workflows/08-SAM2-tracked-mask-helper.json`: optional real SAM2 tracking graph. Requires Kijai's ComfyUI-segment-anything-2. Copy its nodes into an effect graph, select your source video, edit the positive point in first-frame pixel coordinates, and connect its mask to `subject_mask`. Set the generation FPS to match the source. This helper may download SAM2 weights when queued; select device/precision for your machine.
- `previews/`: seven short synthetic effect previews, rendered using supplied synthetic foreground masks. These illustrate the compositor, not LTX or H3 model quality. The default reuse graphs use geometric mask placeholders until you connect a real mask.

## Effects and honest boundaries

| Workflow | Implemented effect | What you supply / what it does not do |
|---|---|---|
| World Orchestra | Low/mid/high audio-band energy reveals a generated layer in different regions. RGB `band_map` assigns low=red, mid=green, high=blue. | Default regions are horizontal thirds. Frequency bands are not isolated instruments. To use actual drums/bass/vocals, supply separated stems through a suitable additional graph; this pack does not separate stems. |
| Impossible Duet | Delayed generated texture/silhouette composited beside the source, with adjustable delay and translation. | Real subject tracking requires a mask. No independent choreography, shadow reconstruction or physically correct lighting. |
| Portal Paint | Generated video inside a region mask, beat-pulsed rim, optional protected foreground. | Default region is an ellipse. Draw a mask in ComfyUI's Mask Editor or connect another MASK source. Foreground occlusion requires subject_mask. |
| Reality Scrubber | Mix source and generated videos using an editable time/mix curve. | A two-take crossfade, not geometric morphing. `0:0,0.5:1,1:0` means source → generated → source across normalized shot time. |
| Foley Orchestra | Alternating action snippets from source/generated banks, marked impact aligned to beats. | Set `source_impact_seconds` to the action event in both banks; use matching event timing. No automatic impact detection or newly composed percussion audio. |
| Future Echo | Four delayed, translated silhouettes with fading generated textures and color-channel variants. | No independently animated alternate characters. Real silhouettes require a mask. |
| Motion Becomes Matter | Motion/subject centroid paints a fading trail revealing generated imagery. | 2D compositing, not fluid simulation or 3D terrain. Camera movement can confuse frame-difference motion. A tracked mask follows its centroid, not individual hands/joints. |

## Controls in ComfyUI

- `source_video`: original footage that should remain recognizable.
- `generated_video`: LTX/H3-generated effect layer, or an existing take in reuse mode. Its duration and FPS define the output. Source video is resampled by timestamps; a shorter source holds its final frame.
- `music`: waveform preserved as the final soundtrack, trimmed/padded to the shot duration. No audio normalization or replacement is applied by the custom compositor. MP4 saving may encode it to a lossy codec.
- `bpm` and `beat_offset_seconds`: regular beat-grid controls; they do not infer tempo automatically.
- `beat_times_seconds`: optional comma-separated exact timestamps, e.g. `0.12,0.64,1.17`. Overrides the regular beat grid.
- `subject_mask`: white means protected performer / foreground; for echoes and duet it also defines the silhouette. Missing masks deliberately fall back to geometric preview shapes for silhouette effects. No automatic segmentation is hidden here.
- `region_mask`: white means portal opening. A static mask repeats through the shot; a batch can animate it. LoadImage's MASK output uses alpha/mask-editor semantics; a grayscale RGB drawing alone is not automatically its MASK. Use ImageToMask if you want to convert a grayscale image channel.
- `band_map`: RGB image with spatial assignments to low, mid, high audio bands. Draw it, load it, and connect IMAGE. A static image repeats.
- `amount`, `delay_seconds`, `spread_fraction`: strength, lag, and horizontal translation. Delay/spread are used by duet/echo; other nodes ignore them.
- `reality_schedule`: used only by Reality Scrubber.
- `source_impact_seconds`: used only by Foley Orchestra.

Mask batches are indexed by output frame and hold their last frame if shorter. For moving subjects, match mask FPS and shot start to the generated take. The effect nodes use CPU NumPy compositing and hold full frame batches in memory. Start with five seconds at 768×512; divide music videos into shots. They reject more than 1200 frames or resolutions above 1080p, but even inputs below those limits can exhaust RAM. Nearest-neighbor source resampling is a prototype choice; resize source footage in ComfyUI first for final quality.

## Improving H3 output without pretending to change its model

The H3 Shot Contract keeps scene, continuity, camera and action separately editable, then supplies one concise prompt to the official H3 node. The workflow uses a fixed seed for easier comparisons; seeds do not guarantee identical output or identity consistency.

The seven effects are deterministic finishing operations after generation, so their masks, rhythm and mixes can be changed without asking H3 to obey exact frame timing. Save a take, then use the reuse workflow to avoid another API request.

Take Diagnostics writes a JSON file in `ComfyUI/output/haggs-reports`. It measures frame changes, near-static pairs, large changes and clipped channel values. It does not judge identity, lip-sync, anatomy, storytelling, or visual appeal. Intentional cuts, black scenes and holds can trigger diagnostic flags. Reports do not automatically retry or choose a winner.

## Validation and readiness

Pure NumPy compositor tests pass for all seven effects, foreground protection, beat indexing, impact alignment, silence handling, frequency-band isolation, scheduling, frame resampling and diagnostics. JSON connection checks and Python syntax checks are included in VALIDATION.json.

Not yet verified: loading these graphs in a real ComfyUI instance, the live VIDEO wrapper, SAM2 execution, LTX GPU rendering, H3 service execution, or end-to-end Haggs integration. Synthetic previews do not establish those results. This is an experimental file pack, not a claim of a contest-ready deployed application.

No generation jobs were submitted while building this pack. Model weights and paid credits are not included. The sample media can be replaced entirely from inside ComfyUI.
