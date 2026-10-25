import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { ffmpegBin, ffprobeBin } from "./ffmpeg";
import { spriteArgs, spritePlan, type SpritePlan } from "../story/sprites";

const run = promisify(execFile);

/** Cuts a clip into a sprite sheet PNG and says how it is laid out. */
export async function makeSheet(input: string, output: string, want: { frames: number; columns: number; size: number }): Promise<SpritePlan & { seconds: number }> {
  let seconds = 0;
  try {
    const { stdout } = await run(ffprobeBin(), ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", input]);
    seconds = Number(stdout.trim());
  } catch {
    throw new Error("That clip couldn't be read.");
  }
  const plan = spritePlan({ seconds, ...want });
  try {
    await run(ffmpegBin(), spriteArgs(input, output, plan), { maxBuffer: 16 * 1024 * 1024 });
  } catch {
    throw new Error("The sheet couldn't be made from that clip.");
  }
  return { ...plan, seconds };
}
