# Demo video: script and voice-over

About 100 seconds, screen-recorded from the running app, voice-over by
ElevenLabs v3 (voice "Will") generated through Comfy, the soundtrack under it.
Scenes and the lines spoken over them:

1. **Landing** — "Making a film shouldn't mean juggling ten tabs. This is haggs: an open-source film studio that runs on Comfy."
2. **Ready-made apps** — "Start with a ready-made app. Swap a person into a video, relight a photo, try on an outfit, make a product ad. Twenty-six of them, one click each, with the price on the button before you press it."
3. **Canvas** — "Or build your own on an open canvas. Chain steps, stack any Comfy workflow, swap in an open-weights model, and turn the whole thing into an app."
4. **Series** — "Make a series. Pick a format, a face and a look, and watch the pictures appear right on the page. Faceless channels even get a narrator."
5. **Editor** — "Then cut it in the editor. Separate tracks for voice, effects and music. Reshoot any shot from a new angle. Fix one frame. Restyle a shot as anime. And undo anything."
6. **Academy** — "New to AI video? The Academy teaches it in seven short lessons, and you make your first video in lesson one."
7. **Your own GPU, then MCP** — "Bring your own GPU and open-weights workflows run free. Connect Claude over M C P, and it lays out your boards, series and canvases for you."
8. **Close** — "haggs. Every shot. Every price. In the open."

## Regenerating it

The recording is scripted with `puppeteer-core` against `npm run dev` (1280×720
at 1.5× for a crisp 1080p). Each scene is recorded on its own, held for at least
the length of its line, then joined with captions, the voice-over and the music
in ffmpeg. The scripts are in `scripts/demo/`.
