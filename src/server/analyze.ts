import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { ffmpegBin, ffprobeBin } from "./ffmpeg";
import type { Metrics } from "../story/doctor";

const run = promisify(execFile);
const BIG = 64 * 1024 * 1024;

/** A frame that differs from the last this much, and more than its neighbours, is a hard cut. Dark, similar shots cut at 0.15. */
const CUT = 0.12;
/** Two peaks closer than this are one cut (the 10-per-second resample can split a cut over two frames). */
const SAME_CUT = 0.25;
/** Frames this different from the last, in a row and adding up past CUT, are a dissolve. */
const DRIFT = 0.025;
/** Turns the average frame difference into the 0-to-30-ish scale the doctor reads. */
const MOTION_SCALE = 600;
const WINDOW = 4;
const RATE = 10;

type Scores = { t: number; score: number }[];

/** The difference between each frame and the one before it, from a small, slow copy of the film. */
async function frameScores(path: string): Promise<Scores> {
  // metadata=print:file=- writes its lines to stdout.
  const { stdout } = await run(ffmpegBin(), ["-hide_banner", "-nostats", "-i", path, "-an", "-vf", `fps=${RATE},scale=160:-2,select='gte(scene,0)',metadata=print:file=-`, "-f", "null", "-"], { maxBuffer: BIG });
  return parseScores(stdout);
}

export function parseScores(text: string): Scores {
  const out: Scores = [];
  let t = 0;
  for (const line of text.split("\n")) {
    const time = /pts_time:([\d.]+)/.exec(line);
    if (time) t = Number(time[1]);
    const score = /lavfi\.scene_score=([\d.]+)/.exec(line);
    if (score) out.push({ t, score: Number(score[1]) });
  }
  return out;
}

/** Splits the per-frame differences into hard cuts, dissolves, and movement per window. */
export function shape(scores: Scores): Pick<Metrics, "hardCuts" | "dissolves" | "motion"> {
  const hardCuts: number[] = [];
  const dissolves: number[] = [];
  let run_: Scores = [];
  const closeRun = () => {
    if (run_.length >= 5 && run_.reduce((a, s) => a + s.score, 0) >= 0.3) dissolves.push(run_[Math.floor(run_.length / 2)]!.t);
    run_ = [];
  };
  const calm: Scores = [];
  for (let i = 0; i < scores.length; i++) {
    const s = scores[i]!;
    if (s.score >= CUT) {
      closeRun();
      const peak = s.score >= (scores[i - 1]?.score ?? 0) && s.score > (scores[i + 1]?.score ?? 0);
      const last = hardCuts[hardCuts.length - 1];
      if (peak && (last === undefined || s.t - last > SAME_CUT)) hardCuts.push(s.t);
      continue;
    }
    if (s.score >= DRIFT) run_.push(s); else closeRun();
    calm.push(s);
  }
  closeRun();
  const motion: number[] = [];
  const end = scores.at(-1)?.t ?? 0;
  for (let from = 0; from < end; from += WINDOW) {
    const inside = calm.filter((s) => s.t >= from && s.t < from + WINDOW);
    motion.push(inside.length ? (inside.reduce((a, s) => a + s.score, 0) / inside.length) * MOTION_SCALE : 0);
  }
  return { hardCuts, dissolves, motion };
}

async function probe(path: string) {
  const { stdout } = await run(ffprobeBin(), ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", path]);
  const info = JSON.parse(stdout) as { format?: { duration?: string }; streams?: { codec_type: string; width?: number; height?: number; r_frame_rate?: string; duration?: string }[] };
  const v = info.streams?.find((s) => s.codec_type === "video");
  const [n, d] = (v?.r_frame_rate ?? "30/1").split("/").map(Number);
  return {
    seconds: Number(info.format?.duration ?? v?.duration ?? 0),
    width: v?.width ?? 0,
    height: v?.height ?? 0,
    fps: d && n ? Math.round((n / d) * 10) / 10 : 30,
    hasAudio: Boolean(info.streams?.some((s) => s.codec_type === "audio")),
  };
}

async function sound(path: string): Promise<Metrics["loudness"]> {
  const num = (re: RegExp, text: string) => { const m = re.exec(text); return m ? Number(m[1]) : null; };
  try {
    const { stderr } = await run(ffmpegBin(), ["-hide_banner", "-nostats", "-i", path, "-vn", "-af", "ebur128=peak=true", "-f", "null", "-"], { maxBuffer: BIG });
    const summary = stderr.slice(stderr.lastIndexOf("Summary:"));
    const open = await run(ffmpegBin(), ["-hide_banner", "-nostats", "-t", "1.5", "-i", path, "-vn", "-af", "volumedetect", "-f", "null", "-"], { maxBuffer: BIG });
    return {
      integrated: num(/I:\s+(-?[\d.]+)\s+LUFS/, summary),
      range: num(/LRA:\s+(-?[\d.]+)\s+LU/, summary),
      peak: num(/Peak:\s+(-?[\d.]+)\s+dBFS/, summary),
      openingDb: num(/mean_volume:\s+(-?[\d.]+)\s+dB/, open.stderr),
    };
  } catch {
    return null;
  }
}

/** Measures a video file the way the sizzle doctor reads it. */
export async function analyze(path: string): Promise<Metrics> {
  const info = await probe(path);
  const [scores, loudness] = await Promise.all([frameScores(path), info.hasAudio ? sound(path) : Promise.resolve(null)]);
  return { ...info, ...shape(scores), loudness };
}
