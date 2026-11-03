# Third-party notices

## manga-generator

The bounded lettering placement search in `src/comic/arrange-lettering.ts` is
adapted from [stockedge/manga-generator](https://github.com/stockedge/manga-generator),
`src/dialogue-layout.mjs`. Modified to use Haggs' shared SVG measurements,
horizontal lettering, left-to-right dialogue order, and a non-mutating failure
result. No upstream artwork, models, or generation services are included.

MIT License

Copyright (c) 2026 issei.mori

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:
The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.
THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Free video tools (run locally, not bundled)

The `/tools` apps run programs you install yourself; no code or model files from these projects are included in HAGGS.
Each is credited on its app page with the creator's GitHub and licence.

- [FFmpeg](https://github.com/FFmpeg/FFmpeg) by the FFmpeg developers: LGPL 2.1+ (GPL 2+ with some options).
- [PySceneDetect](https://github.com/Breakthrough/PySceneDetect) by Brandon Castellano (Breakthrough): BSD 3-Clause.
- [Auto-Editor](https://github.com/WyattBlue/auto-editor) by Wyatt Blue: The Unlicense.
- [librosa](https://github.com/librosa/librosa) by the librosa development team: ISC. Run by `tools/video-tools/beats.py`.
- [color-matcher](https://github.com/hahnec/color-matcher) by Christopher Hahne: GPL-3.0. Not bundled; `tools/video-tools/match_color.py` is a separate program that imports the copy you installed.
- [rembg](https://github.com/danielgatis/rembg) by Daniel Gatis: MIT. The segmentation models it downloads (for example u2net) have their own licences set by their authors and are not hosted or shipped by HAGGS.
- [Demucs](https://github.com/adefossez/demucs) by Alexandre Défossez (maintained fork of Meta's archived facebookresearch/demucs): MIT. The htdemucs model it downloads is not hosted or shipped by HAGGS.
- [HyperFrames](https://github.com/heygen-com/hyperframes) by HeyGen: Apache-2.0. HAGGS writes a title's HTML and runs the HyperFrames CLI from npm on it; nothing of HyperFrames is bundled.
