/**
 * Free, open-source video tools that run on your own machine. Each one credits its creator, links their GitHub and
 * states the licence. Nothing here is bundled or redistributed: HAGGS only runs the program you installed.
 */

export type VideoToolId = "ffmpeg-export" | "scene-detect" | "auto-editor" | "beat-cuts" | "color-match" | "remove-bg" | "split-stems" | "animated-titles";

export type VideoTool = {
  id: VideoToolId;
  name: string;
  /** One line, in plain words. */
  does: string;
  creator: string;
  github: string;
  licence: string;
  licenceUrl: string;
  /** What runs: HAGGS' own ffmpeg call, or a program you install. */
  how: "ffmpeg" | "local-tool";
  /** The command that provides it, looked up in HAGGS_VIDEO_TOOLS_BIN and then the PATH. */
  command: string;
  /** For tools that are a Python library run by a small script in tools/video-tools: the module that must import. */
  module?: string;
  /** What you add first. */
  input: "video" | "video-or-audio" | "none";
  install: string[];
  needs: string;
  /** Where it has actually been run. Anything not listed here is untested. */
  tested: string;
};

export const VIDEO_TOOLS: VideoTool[] = [
  {
    id: "ffmpeg-export",
    name: "FFmpeg export",
    does: "Export a clip as a web MP4, a vertical 9:16 version, a small share file or an editing-friendly ProRes.",
    creator: "The FFmpeg developers",
    github: "https://github.com/FFmpeg/FFmpeg",
    licence: "LGPL 2.1+ (GPL 2+ with some options)",
    licenceUrl: "https://github.com/FFmpeg/FFmpeg/blob/master/LICENSE.md",
    how: "ffmpeg",
    input: "video",
    command: "ffmpeg",
    install: ["brew install ffmpeg"],
    needs: "ffmpeg on the PATH. CPU only; no model files.",
    tested: "macOS 26 on Apple silicon, FFmpeg 8.0.1, H.264 and ProRes presets. Not tested on Windows or Linux.",
  },
  {
    id: "scene-detect",
    name: "Find every shot",
    does: "Finds every cut in a finished video and lists each shot with its start, end and a still.",
    creator: "Brandon Castellano (Breakthrough)",
    github: "https://github.com/Breakthrough/PySceneDetect",
    licence: "BSD 3-Clause",
    licenceUrl: "https://github.com/Breakthrough/PySceneDetect/blob/main/LICENSE",
    how: "local-tool",
    input: "video",
    command: "scenedetect",
    install: ["uv venv --python 3.11 video-tools-env", "uv pip install --python video-tools-env/bin/python scenedetect opencv-python-headless", "export HAGGS_VIDEO_TOOLS_BIN=\"$PWD/video-tools-env/bin\""],
    needs: "Python 3.10+, PySceneDetect with OpenCV, and ffmpeg. CPU only; no model files.",
    tested: "macOS 26 on Apple silicon, PySceneDetect 0.7.2, Python 3.11. Not tested on Windows or Linux.",
  },
  {
    id: "auto-editor",
    name: "Cut dead air",
    does: "Cuts the quiet stretches out of a video, with a margin so words are not clipped.",
    creator: "WyattBlue",
    github: "https://github.com/WyattBlue/auto-editor",
    licence: "The Unlicense (public domain)",
    licenceUrl: "https://github.com/WyattBlue/auto-editor/blob/master/LICENSE",
    how: "local-tool",
    input: "video",
    command: "auto-editor",
    install: ["uv venv --python 3.11 video-tools-env", "uv pip install --python video-tools-env/bin/python auto-editor", "export HAGGS_VIDEO_TOOLS_BIN=\"$PWD/video-tools-env/bin\""],
    needs: "Python 3.10+ and ffmpeg. The first run downloads Auto-Editor's own program from its GitHub releases. CPU only; no model files.",
    tested: "macOS 26 on Apple silicon, auto-editor 29.3.1. Not tested on Windows or Linux.",
  },
  {
    id: "beat-cuts",
    name: "Cut on the beat",
    does: "Finds the tempo and every beat of a song or a video's soundtrack, lists cut points every 1, 2, 4 or 8 beats, and gives you a copy with a click on each beat so you can hear that they land.",
    creator: "The librosa development team",
    github: "https://github.com/librosa/librosa",
    licence: "ISC",
    licenceUrl: "https://github.com/librosa/librosa/blob/main/LICENSE.md",
    how: "local-tool",
    input: "video-or-audio",
    command: "python",
    module: "librosa",
    install: ["uv venv --python 3.11 video-tools-env", "uv pip install --python video-tools-env/bin/python librosa soundfile", "export HAGGS_VIDEO_TOOLS_BIN=\"$PWD/video-tools-env/bin\""],
    needs: "Python 3.10+, librosa and soundfile, and ffmpeg. CPU only; no model files. Beat tracking suits music with a steady pulse; speech or free tempo gives unreliable beats.",
    tested: "macOS 26 on Apple silicon, librosa 0.11.0, Python 3.11. Not tested on Windows or Linux.",
  },
  {
    id: "color-match",
    name: "Match colour to a reference",
    does: "Grades every frame of a clip toward the colours of one reference picture, so shots from different sources sit together.",
    creator: "Christopher Hahne",
    github: "https://github.com/hahnec/color-matcher",
    licence: "GPL-3.0",
    licenceUrl: "https://github.com/hahnec/color-matcher/blob/master/LICENSE",
    how: "local-tool",
    input: "video",
    command: "python",
    module: "color_matcher",
    install: ["uv venv --python 3.11 video-tools-env", "uv pip install --python video-tools-env/bin/python color-matcher", "export HAGGS_VIDEO_TOOLS_BIN=\"$PWD/video-tools-env/bin\""],
    needs: "Python 3.10+, color-matcher, and ffmpeg. CPU only; no model files. It matches each frame on its own, so shots with changing content can shimmer slightly. Output is limited to the first 10 seconds at up to 24 fps and 1280 px wide.",
    tested: "macOS 26 on Apple silicon, color-matcher 0.6.0, Python 3.11. Not tested on Windows or Linux.",
  },
  {
    id: "remove-bg",
    name: "Remove the background",
    does: "Cuts the subject out of every frame and gives you a clip with a transparent background.",
    creator: "Daniel Gatis",
    github: "https://github.com/danielgatis/rembg",
    licence: "MIT (model weights have their own terms)",
    licenceUrl: "https://github.com/danielgatis/rembg/blob/main/LICENSE.txt",
    how: "local-tool",
    input: "video",
    command: "rembg",
    install: ["uv venv --python 3.11 video-tools-env", "uv pip install --python video-tools-env/bin/python \"rembg[cpu,cli]\"", "export HAGGS_VIDEO_TOOLS_BIN=\"$PWD/video-tools-env/bin\"", "export U2NET_HOME=\"$PWD/video-tools-env/models\"   # where rembg keeps its models"],
    needs: "Python 3.10+, rembg with onnxruntime, and ffmpeg. The first run makes rembg download the chosen model from its own GitHub releases (u2net is about 176 MB); HAGGS does not ship or host it, and the model's licence is set by its authors, so read rembg's README before using results commercially. CPU is slow: about half a second a frame here. Output is limited to the first 8 seconds at up to 24 fps and 960 px wide.",
    tested: "macOS 26 on Apple silicon (CPU), rembg 2.0.86 with u2net, Python 3.11. Not tested on Windows, Linux or a GPU.",
  },
  {
    id: "split-stems",
    name: "Split the music and voice",
    does: "Splits a song or a video's soundtrack into separate vocals and backing, or into vocals, drums, bass and everything else.",
    creator: "Alexandre Défossez",
    github: "https://github.com/adefossez/demucs",
    licence: "MIT",
    licenceUrl: "https://github.com/adefossez/demucs/blob/main/LICENSE",
    how: "local-tool",
    input: "video-or-audio",
    command: "demucs",
    install: ["uv venv --python 3.11 video-tools-env", "uv pip install --python video-tools-env/bin/python demucs", "export HAGGS_VIDEO_TOOLS_BIN=\"$PWD/video-tools-env/bin\"", "export TORCH_HOME=\"$PWD/video-tools-env/models/torch\"   # where Demucs keeps its model"],
    needs: "Python 3.10+, Demucs with PyTorch (a few GB of packages), and ffmpeg. The first run makes Demucs download its htdemucs model (about 80 MB); HAGGS does not host or ship it. CPU works: about three times faster than real time here. Output is limited to the first 2 minutes. Credit: this is the maintained fork of the original Meta Research project (facebookresearch/demucs, archived).",
    tested: "macOS 26 on Apple silicon (CPU), Demucs 4.1.0, htdemucs, Python 3.11. Not tested on Windows, Linux or a GPU.",
  },
  {
    id: "animated-titles",
    name: "Animated titles",
    does: "Type a title and get a rendered animated title card (or a transparent overlay to lay over a clip), made from HTML by HyperFrames.",
    creator: "HeyGen",
    github: "https://github.com/heygen-com/hyperframes",
    licence: "Apache-2.0",
    licenceUrl: "https://github.com/heygen-com/hyperframes/blob/main/LICENSE",
    how: "local-tool",
    input: "none",
    command: "npx",
    install: ["# Node.js 22+ and ffmpeg", "npx --yes hyperframes@0.9.6 --help   # fetches HyperFrames from npm on first use"],
    needs: "Node.js 22+, ffmpeg, and network access: the first run fetches HyperFrames from npm and a headless Chrome, and each render loads GSAP from the jsDelivr CDN. HAGGS writes the title's HTML itself and runs HyperFrames 0.9.6 on it; nothing of HyperFrames is bundled. CPU or GPU; no model files. Note that HyperFrames collects usage telemetry unless you run `npx hyperframes telemetry disable`.",
    tested: "macOS 26 on Apple silicon, Node 24, HyperFrames 0.9.6 (MP4). Not tested on Windows or Linux.",
  },
];

export const videoTool = (id: string): VideoTool | undefined => VIDEO_TOOLS.find((t) => t.id === id);

export const EXPORT_PRESETS = {
  web: { label: "Web MP4, 1080p", ext: "mp4" },
  vertical: { label: "Vertical 9:16, 1080×1920 (fills the frame)", ext: "mp4" },
  small: { label: "Small share file, 720p", ext: "mp4" },
  prores: { label: "ProRes 422 for editing (large)", ext: "mov" },
} as const;
export type ExportPreset = keyof typeof EXPORT_PRESETS;
export const isExportPreset = (v: unknown): v is ExportPreset => typeof v === "string" && v in EXPORT_PRESETS;

const clamp = (n: number, lo: number, hi: number, fallback: number) => (Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fallback);

/** ffmpeg arguments for one export preset. */
export function exportArgs(input: string, output: string, preset: ExportPreset): string[] {
  const head = ["-y", "-hide_banner", "-loglevel", "error", "-i", input];
  switch (preset) {
    case "web":
      return [...head, "-vf", "scale=-2:'min(1080,ih)':flags=lanczos,format=yuv420p", "-c:v", "libx264", "-crf", "20", "-preset", "medium", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", output];
    case "vertical":
      return [...head, "-vf", "scale=1080:1920:force_original_aspect_ratio=increase:flags=lanczos,crop=1080:1920,setsar=1,format=yuv420p", "-c:v", "libx264", "-crf", "20", "-preset", "medium", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", output];
    case "small":
      return [...head, "-vf", "scale=-2:'min(720,ih)':flags=lanczos,format=yuv420p", "-c:v", "libx264", "-crf", "26", "-preset", "medium", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", output];
    case "prores":
      return [...head, "-c:v", "prores_ks", "-profile:v", "2", "-pix_fmt", "yuv422p10le", "-c:a", "pcm_s16le", output];
  }
}

export type DetectMode = "content" | "adaptive" | "threshold";
export const isDetectMode = (v: unknown): v is DetectMode => v === "content" || v === "adaptive" || v === "threshold";

/** PySceneDetect arguments: the cut list as a CSV and one still per shot. */
export function sceneArgs(input: string, dir: string, mode: DetectMode, sensitivity: number): string[] {
  const detector = mode === "content" ? ["detect-content", "-t", String(clamp(sensitivity, 5, 60, 27))] : mode === "adaptive" ? ["detect-adaptive", "-t", String(clamp(sensitivity, 1, 10, 3))] : ["detect-threshold", "-t", String(clamp(sensitivity, 0, 255, 12))];
  return ["-i", input, "-o", dir, ...detector, "list-scenes", "-q", "-s", "-f", "scenes", "save-images", "-n", "1", "-f", "shot-$SCENE_NUMBER-$IMAGE_NUMBER"];
}

export type Shot = { number: number; start: number; end: number; length: number };

/** Reads PySceneDetect's scene CSV (cut-list row skipped with -s). */
export function parseScenes(csv: string): Shot[] {
  const rows = csv.split(/\r?\n/).filter((l) => l.trim());
  const shots: Shot[] = [];
  for (const row of rows.slice(1)) {
    const c = row.split(",");
    const [number, start, end, length] = [Number(c[0]), Number(c[3]), Number(c[6]), Number(c[9])];
    if ([number, start, end, length].every(Number.isFinite)) shots.push({ number, start, end, length });
  }
  return shots;
}

/** Auto-Editor arguments: keep what is louder than the threshold, plus a margin either side. */
export function autoEditArgs(input: string, output: string, thresholdDb: number, marginSeconds: number): string[] {
  const db = clamp(thresholdDb, -60, -10, -35);
  const margin = clamp(marginSeconds, 0, 1, 0.1);
  return [input, "--edit", `audio:threshold=${db}dB`, "--margin", `${margin}sec`, "--progress", "none", "--no-open", "-o", output];
}

export type FrameJob = { seconds: number; fps: number; width: number };

/** Frames of the first seconds of a clip, capped so a long clip can't run for hours. */
export function frameArgs(input: string, dir: string, job: FrameJob): string[] {
  return ["-y", "-hide_banner", "-loglevel", "error", "-t", String(job.seconds), "-i", input, "-vf", `fps=${job.fps},scale='min(${job.width},iw)':-2`, `${dir}/%06d.png`];
}

/** Frames back into an MP4 with the original soundtrack. */
export function framesToVideoArgs(dir: string, input: string, output: string, job: FrameJob, audio: boolean): string[] {
  return ["-y", "-hide_banner", "-loglevel", "error", "-framerate", String(job.fps), "-i", `${dir}/%06d.png`, "-t", String(job.seconds), "-i", input, "-map", "0:v", ...(audio ? ["-map", "1:a", "-c:a", "aac"] : []), "-c:v", "libx264", "-crf", "18", "-pix_fmt", "yuv420p", "-shortest", "-movflags", "+faststart", output];
}

/** Transparent frames into a WebM with alpha (plays in browsers) or ProRes 4444 (for editors). */
export function alphaArgs(dir: string, output: string, fps: number): string[] {
  const head = ["-y", "-hide_banner", "-loglevel", "error", "-framerate", String(fps), "-i", `${dir}/%06d.png`];
  return output.endsWith(".mov") ? [...head, "-c:v", "prores_ks", "-profile:v", "4", "-pix_fmt", "yuva444p10le", output] : [...head, "-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p", "-b:v", "0", "-crf", "30", output];
}

export const COLOR_METHODS = { mkl: "Natural (MKL)", reinhard: "Reinhard", mvgd: "Gaussian (MVGD)", hm: "Histogram" } as const;
export type ColorMethod = keyof typeof COLOR_METHODS;
export const isColorMethod = (v: unknown): v is ColorMethod => typeof v === "string" && v in COLOR_METHODS;

export const CUT_EVERY = [1, 2, 4, 8] as const;

/** Cut points: every Nth beat, starting from the first. */
export function cutsEvery(beats: number[], every: number): number[] {
  const n = CUT_EVERY.includes(every as 1) ? every : 4;
  return beats.filter((_, i) => i % n === 0);
}

/** A copy of the clip with the click track mixed over its own sound (or alone if it has none). */
export function clickMixArgs(input: string, clicks: string, output: string, audio: boolean, video: boolean): string[] {
  const head = ["-y", "-hide_banner", "-loglevel", "error", "-i", input, "-i", clicks];
  if (!video) return [...head, "-filter_complex", "[0:a][1:a]amix=inputs=2:duration=first:normalize=0[a]", "-map", "[a]", "-c:a", "aac", output];
  if (!audio) return [...head, "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-shortest", output];
  return [...head, "-filter_complex", "[0:a][1:a]amix=inputs=2:duration=first:normalize=0[a]", "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", output];
}

export const REMOVE_MODELS = ["u2net", "u2netp", "isnet-general-use", "silueta"] as const;
export const isRemoveModel = (v: unknown): v is (typeof REMOVE_MODELS)[number] => REMOVE_MODELS.includes(v as "u2net");

export const STEM_MODES = { two: "Vocals and backing", four: "Vocals, drums, bass and other" } as const;
export type StemMode = keyof typeof STEM_MODES;
export const isStemMode = (v: unknown): v is StemMode => v === "two" || v === "four";

/** Demucs arguments; stems land in out/htdemucs/<track name>/. */
export function demucsArgs(input: string, out: string, mode: StemMode): string[] {
  return ["-n", "htdemucs", ...(mode === "two" ? ["--two-stems=vocals"] : []), "-o", out, input];
}
