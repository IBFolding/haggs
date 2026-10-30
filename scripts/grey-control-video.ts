/**
 * Draws a shot's grey blockout as a video, for a video model to follow.
 *   npx tsx scripts/grey-control-video.ts out.mp4 [seconds] [Push in|Pull back|Orbit|Crane up] [width] [height]
 */
import { spawn } from "node:child_process";
import { createRequire } from "node:module";

import { defaultGrey } from "../src/story/grey";
import { presetKeys, type Preset } from "../src/story/grey-camera";
import { frameTimes, greyFrameSvg } from "../src/story/grey-control";

const sharp = createRequire(import.meta.url)("sharp") as typeof import("sharp");
const [out = "/tmp/grey-control.mp4", secs = "3.84", preset = "Push in", w = "1280", h = "704"] = process.argv.slice(2);
const fps = 25;
const size = { w: Number(w), h: Number(h) };
const base = defaultGrey(["Subject"]);
// A short clip: start well back so the move ends in a sensible frame rather than on the preset's six-second endpoint.
const start = { ...base.cam, distance: 10 };
const keys = presetKeys(preset as Preset, start);
const last = keys.at(-1)!;
const scale = Number(secs) / last.t;
const grey = { ...base, cam: start, camKeys: keys.map((k) => ({ ...k, t: +(k.t * scale).toFixed(3) })) };

async function main() {
  const ff = spawn("ffmpeg", ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(fps), "-i", "-", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "16", out], { stdio: ["pipe", "inherit", "inherit"] });
  const done = new Promise<number>((res) => ff.on("close", (code) => res(code ?? 1)));
  const times = frameTimes(Number(secs), fps);
  for (const t of times) {
    const png = await sharp(Buffer.from(greyFrameSvg(grey, t, size))).png().toBuffer();
    if (!ff.stdin.write(png)) await new Promise((r) => ff.stdin.once("drain", r));
  }
  ff.stdin.end();
  const code = await done;
  console.log(code === 0 ? `wrote ${out} (${times.length} frames)` : `ffmpeg failed (${code})`);
}
void main();
