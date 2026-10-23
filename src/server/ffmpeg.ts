import { createRequire } from "node:module";

import { hosted } from "./blob";

const require_ = createRequire(import.meta.url);

/**
 * Which ffmpeg to run. On a developer's machine it is the one on the PATH;
 * hosted, there is none, so the build ships its own (ffmpeg-static and
 * ffprobe-static).
 */
export function ffmpegBin(): string {
  if (!hosted()) return "ffmpeg";
  try {
    return (require_("ffmpeg-static") as string | null) ?? "ffmpeg";
  } catch {
    return "ffmpeg";
  }
}

export function ffprobeBin(): string {
  if (!hosted()) return "ffprobe";
  try {
    return (require_("ffprobe-static") as { path: string }).path;
  } catch {
    return "ffprobe";
  }
}
