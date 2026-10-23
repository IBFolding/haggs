# Recording the demo

These scripts made the demo video. They are reference, not part of the app.

1. `npm i -D puppeteer-core` and start `npm run dev`.
2. Put the voice-over lines (`docs/demo/script.md`) in `vo/` as `home.mp3`, `workflows.mp3`, … (spoken with the Voice
   tools in haggs, ElevenLabs v3 on Comfy).
3. `node scripts/demo/record.mjs` drives Chrome headless at 1280×720 (1.5× for a crisp 1080p), recording each scene to
   its own `seg2-*.webm` and writing `segs-v2.json`. It expects a project to restore from `.haggs/bridge/projects/`.
4. `python3 scripts/demo/assemble.py` joins the scenes, adds captions, lays the voice-over and the music, and
   masters to −16 LUFS.

The paths at the top of each file point at the machine they were written on; change them to yours.
