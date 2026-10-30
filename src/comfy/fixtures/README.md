Workflow templates from [Comfy-Org/workflow_templates](https://github.com/Comfy-Org/workflow_templates) (MIT, © Comfy Org), and the slice of Comfy Cloud's node catalog they use, for the converter's tests.

Camera conditioning: trajectory-vace.api.json is derived from the official video_wan_vace_14B_v2v template (Comfy Org, MIT). Prompt replaced with a generic scene. trajectory-vace.catalog.json is the matching catalog slice cached on 26 October 2026; it is test evidence, not a live availability claim. Source: https://github.com/Comfy-Org/workflow_templates/blob/main/templates/video_wan_vace_14B_v2v.json

Open Weights choices: image_z_image_turbo.json and text_to_video_wan.json were downloaded unmodified from https://cloud.comfy.org/templates/ on 30 October 2026 (Comfy Org templates, MIT). These are actual graphs; the regression tests deliberately use an incomplete recorded catalog and establish fail-closed behavior, not installed models or successful generation.
