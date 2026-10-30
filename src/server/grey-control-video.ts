import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { GreyFrame } from "../story/grey";
import { CONTROL_FPS, controlSeconds, fitToClip, frameTimes, greyFrameSvg } from "../story/grey-control";
import { ffmpegBin } from "./ffmpeg";

/** The blockout drawn frame by frame and encoded as an mp4: the control video a video model follows. */
export async function renderControlVideo(input: GreyFrame, size: { w: number; h: number }): Promise<{ bytes: Uint8Array; seconds: number }> {
  const sharp = (await import("sharp")).default;
  const seconds = controlSeconds(input);
  const grey = fitToClip(input);
  const dir = await mkdtemp(join(tmpdir(), "haggs-control-"));
  const out = join(dir, "control.mp4");
  try {
    const ff = spawn(ffmpegBin(), ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(CONTROL_FPS), "-i", "-", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "16", out], { stdio: ["pipe", "ignore", "pipe"] });
    let problem = "";
    ff.stderr.on("data", (d: Buffer) => { problem += d.toString(); });
    const closed = new Promise<number>((resolve, reject) => { ff.once("error", () => reject(new Error("ffmpeg could not start."))); ff.once("close", (code) => resolve(code ?? 1)); });
    for (const t of frameTimes(seconds, CONTROL_FPS)) {
      const png = await sharp(Buffer.from(greyFrameSvg(grey, t, size))).png().toBuffer();
      if (!ff.stdin.write(png)) await new Promise((r) => ff.stdin.once("drain", r));
    }
    ff.stdin.end();
    if ((await closed) !== 0) throw new Error(`The control video couldn't be made. ${problem.slice(0, 160)}`.trim());
    return { bytes: new Uint8Array(await readFile(out)), seconds };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
