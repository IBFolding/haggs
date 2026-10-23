import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

/** Comfy's video tools refuse sources wider than 2160px, so a 2.5K take has to be scaled down before it is sent. */
const LIMIT = 2160;

/** The ffmpeg arguments that shrink a video to fit (without the input and output), or null when it already fits. */
export function fitArgs(width: number, height: number): string[] | null {
  if (Math.max(width, height) <= LIMIT) return null;
  return ["-vf", width >= height ? "scale=1920:-2" : "scale=-2:1920", "-c:v", "libx264", "-crf", "16", "-preset", "fast", "-c:a", "copy"];
}

/** A video file's bytes, scaled down first when it is too big for Comfy's tools. */
export async function fittedVideo(path: string): Promise<Uint8Array> {
  try {
    const { stdout } = await run("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=s=x:p=0", path]);
    const [w, h] = stdout.trim().split("x").map(Number);
    const args = fitArgs(w ?? 0, h ?? 0);
    if (!args) return new Uint8Array(await readFile(path));
    const dir = await mkdtemp(join(tmpdir(), "haggs-fit-"));
    try {
      const out = join(dir, "fit.mp4");
      await run("ffmpeg", ["-loglevel", "error", "-y", "-i", path, ...args, out], { maxBuffer: 8 * 1024 * 1024 });
      return new Uint8Array(await readFile(out));
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  } catch {
    // No ffmpeg here: send it as it is and let Comfy say if it's too big.
    return new Uint8Array(await readFile(path));
  }
}
