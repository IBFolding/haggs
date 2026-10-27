# Reproduce the kettle demo

This is a real Comfy API-format workflow, not an already rendered video. It animates one existing non-person, unbranded repository sample: `public/samples/ad-kettle.jpg` (distributed with this MIT repository). No external personal images are needed.

## Install Haggs

Use Node 22 and ffmpeg. From the repository root run `npm ci`, `npm run typecheck`, `npm test`, then create a local media directory: `mkdir -p .haggs/media`. Start with `HAGGS_LOCAL_MEDIA="$PWD/.haggs/media" npm run dev`. Open http://localhost:3111. No Supabase or Stripe setup is needed for local editing. Add your own existing Comfy key using Provider keys; never commit credentials. Claude is optional for this demo.

## Replay through Haggs

1. Open Workflows, import `veo-lite-kettle.api.json` as a workflow file.
2. Supply `public/samples/ad-kettle.jpg` for the image input. Inspect the graph and prompt.
3. Confirm Veo 3.1 Lite, four seconds, 720p, sound off. On 26 October 2026 Comfy lists 6.33 credits/second: 25.32 Comfy credits (about $0.12 at the app's approximate conversion). Credits in Haggs and Comfy are different units. Check the current estimate before explicitly running; importing does not generate anything.
4. Run once only when authorized to spend your own credits. If submission status is uncertain, check the existing job rather than resubmitting.
5. Save the result, open it in the editor, trim/add a caption, then Render MP4 locally. Reopen the saved project and play the result.

The JSON can also be used with ComfyUI's API workflow loader. Upload the image first and substitute its returned filename in `LoadImage`; image filenames are account/server-specific. Required nodes: LoadImage, Veo3VideoGenerationNode, SaveVideo. This uses a paid partner model, not open weights. Verify the current node catalog before execution. Seed42 is a repeatability aid, not a guarantee of identical provider output.

Source pricing: https://docs.comfy.org/tutorials/partner-nodes/pricing

## Local versus hosted

The built-in MP4 render and `/api/local` media serving require `npm run dev` plus ffmpeg. A deployed Haggs site can edit and export supported project formats but does not expose the local ffmpeg renderer. Hosted uploads require the documented file-store configuration. Do not claim local rendering worked in production.

## Optional local ComfyUI

Import an open-weights workflow file and connect an existing local ComfyUI under Provider keys. Haggs reads that server's node catalog; all required nodes and weights must already be installed. Cloud template browsing requires a Comfy key. This Veo demo uses a partner API and cannot run free on your GPU.

## Submission

Keep the demo under two minutes. Show the app in action and explain its Comfy workflow, browser project storage and local ffmpeg finishing. Public repo, workflow files, license, setup instructions and a tagged demo social post are required by https://comfy.org/open-source-higgsfield/. This package does not publish or submit anything.
