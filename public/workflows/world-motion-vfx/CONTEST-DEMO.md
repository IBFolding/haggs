# Recommended LTX VFX demonstration

Show an effect being directed and revised, not only a finished clip.

1. Load a five-second source clip and show the original.
2. Add a burst event at a chosen time and position in the ComfyUI placement node.
3. Play the moving mask; move one path keyframe and show the revised placement.
4. Run the single-effect LTX inpainting graph and review the actual output.
5. Show a second trail/beam event being added with its own prompt and inpainting pass.
6. Show protected foreground and the final outside-mask compositor, explaining that it preserves the prepared source before encoding.
7. Reuse the existing take to change blending/masks without another generation call; acknowledge when a moved effect requires rerendering.

LTX is the core video model creating effect appearance in this workflow. The custom work is the event timeline, placement controls, tracked-region/protected-foreground handling and independent effect passes. Generic inpainting, masks and compositing are existing techniques; uniqueness across the ecosystem has not been established.

The playable room and Motion-to-Movie bridge are separate demonstrations. Do not label proxy graphics or synthetic joint fixtures as model output. Do not claim real-time neural rendering until an actual Eden GPU session has been run and measured.

Contest details: https://comfy.org/open-source-higgsfield
