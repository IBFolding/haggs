# What haggs is missing against Higgsfield

Surveyed on 2026-10-25 from Higgsfield's own tool surface (59 video models, dozens of image models, 8 audio models,
the app marketplace, preset galleries, Ads Studio, Shorts Studio, 3D, publishing) against haggs's source.
"Have" means it is in haggs today. Effort: S under a day, M a few days, L a week or more.
Cost: "free" runs locally on ffmpeg, "credits" calls a Comfy partner node.

## Already covered (no action)

Characters, places and accessories as reusable Elements (the bank). Series and Shorts-style formats. Recreate an edit
(like Ad Multiplier Recreate). Found footage. Comic strip. Swap a person, copy an expression, recast, restyle, lip-sync.
Relight, upscale (photo and video), remove an object, paint something in, widen a photo (outpaint), cut out or replace a
video background. UGC and product-in-hand ads, product ad grids, fashion try-on and flat-lay. Region fix (re-roll a boxed
part of a frame). Editor with captions, FCPXML export, versions, cutdowns. Grey room (3D set, Blender export). Gallery with
cost totals. Workflow library and community apps. Academy.

## Missing, in the order I would build them

| # | Feature | Higgsfield has | haggs today | How to build it | Effort | Cost |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Music and sound effects inside the editor | Seed Audio, ElevenLabs SFX, Sonilo music, Mirelo SFX | Imports a finished track only | Comfy partner nodes: ElevenLabs sound generation, Sonilo music. Add a Sound tab: describe it, preview, drop on the timeline | M | credits |
| 2 | Video effects pack: VHS, CRT, glitch, thermal, night vision, retro pop, plus typewriter, word-stack and comment-cut text | Match Cut + Tracelab app (27 actions) | Plain titles only | ffmpeg filters, no model needed. One-click effects on a clip or the whole cut | S to M | free |
| 3 | Export for X, TikTok, Reels, Shorts | TikTok connect, publish, trending music | Export to MP4 and FCPXML | Presets for size, bitrate and -14 LUFS loudness. A vertical re-frame that follows the faces (what I built by hand for Waylight) | M | free |
| 4 | Brand kit, product library, ad formats | Marketing Studio, Ads Studio, DTC Ads (brand kit from a website, products, posters, marketplace listings, batch of up to 20) | Product apps, but no brand kit or batch | Brand kit (logo, palette, fonts, tone) scraped from a URL. A Product kind in the bank. Ad formats and a batch run. An Ad Multiplier: recreate an ad for another audience or language | L | credits |
| 5 | The model line-up | Kling 3 Omni (7 references), Veo 3.1 and Lite, Seedance 2 and 2.5, Nano Banana 2 and Pro, Qwen Image 3, GPT Image, Ideogram, Recraft, Seedream, Grok | 6 on Comfy (MiniMax H3, FLUX 3 image and video, LTX 2.5 Pro and Fast) | The fal to Comfy move already planned, plus the extras. Each is a catalog entry and a workflow | M, then S each | credits |
| 6 | Sizzle doctor (Higgsfield's Virality Predictor) | Predicts hook strength, retention, engagement | Nothing | Analyse a cut locally: shot pace, hook in the first 2 seconds, motion, loudness, text. Suggest fixes. It is the analysis I did on Waylight | S to M | free |
| 7 | Auto model picker and prompt enhancer | `image_auto`, `recommend`, automatic prompt direction | You pick the model | Rules-based "recommend a model", and an "Improve my prompt" button using the Claude key | S | free or pennies |
| 8 | Preset galleries | Viral Hub, Genjutsu styles ("redraw my video as knitted yarn"), Soul styles, What If | Looks panel and style sheets | A curated gallery of one-click looks and effects, each a stored prompt plus workflow | M | credits |
| 9 | Cinema camera rig for stills | Camera body, lens, focal length and aperture pickers; genre control for video | Camera moves in prompts | Pickers that write the right words into the prompt | S | free |
| 10 | Draw to video | Sketch on a frame, it animates | Region canvas exists | Reuse the region canvas: draw on a frame, send to image to video | M | credits |
| 11 | Sprite sheet maker | AutoSprite: character to game-ready sheet | Nothing | Video of the character, frames, remove background, pack into a sheet with ffmpeg | S | free |
| 12 | Image to 3D and a rig animation library | Meshy 3D, 678 rig animations, scene builder | Grey room builds sets only | Comfy Meshy partner node for models. Animations would need a library | M to L | credits |
| 13 | Layers (split an image into editable layers) | Image Decompose | Nothing | A Comfy layered-image template | M | credits |
| 14 | Logos, icons and vector output | Ideogram Vector, Recraft vector and utility | Nothing | Comfy Recraft node, after item 5 | S | credits |
| 15 | Voice cloning, dubbing, voice change | create_voice, dubbing, voice_change, TTS engines | ElevenLabs preset voices for lip-sync | ElevenLabs nodes on Comfy. I have not confirmed which clone and dub nodes exist | M | credits |
| 16 | Video polish: HDR, FPS boost, deflicker | Topaz Hyperion, FPS Boost, Deflicker | Upscale only | Comfy Topaz and Hitpaw partner nodes | S to M | credits |
| 17 | Gallery folders, search and bulk download | Folders and asset moves | Scopes (All, Images, Video, Kept) | Folders, tags, a search box, download all | S | free |
| 18 | Share and review links | Publish a project, community feed | Community shelf for apps only | A read-only link to a cut with comment markers | M | free |
| 19 | Explainer format | Explainer presets | Nine Series formats, no explainer | One more Series format | S | credits |
| 20 | Publish straight to TikTok, YouTube, Instagram | TikTok publish and music | Nothing | Needs each platform's API approval; weeks. Skip for the contest and rely on item 3 | L | free |

## Not worth copying

Website builder and deploy (Higgsfield's `create_website`): unrelated to a film studio. Higgsfield-only models (Soul,
Cinema Studio 3.0 and 4.0): they cannot run on Comfy, so the equivalent is a better prompt and look, not the model.

## What I would do before the contest ends (Oct 30)

Items 1, 2, 3 and 6 show the most to a judge in a short demo, cost nothing to run or very little, and each is a
couple of days at most. Item 5 is already in progress. Items 4, 12 and 20 are larger than the time left.
