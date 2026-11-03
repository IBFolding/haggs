/**
 * Free, open-source video tools that run on your own machine. Each one credits its creator, links their GitHub and
 * states the licence. Nothing here is bundled or redistributed: HAGGS only runs the program you installed.
 */

export type VideoToolId = "ffmpeg-export" | "scene-detect" | "auto-editor";

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
    command: "auto-editor",
    install: ["uv venv --python 3.11 video-tools-env", "uv pip install --python video-tools-env/bin/python auto-editor", "export HAGGS_VIDEO_TOOLS_BIN=\"$PWD/video-tools-env/bin\""],
    needs: "Python 3.10+ and ffmpeg. The first run downloads Auto-Editor's own program from its GitHub releases. CPU only; no model files.",
    tested: "macOS 26 on Apple silicon, auto-editor 29.3.1. Not tested on Windows or Linux.",
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
