import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

import { ffmpegBin, ffprobeBin } from "./ffmpeg";
import { localFile, localUrl } from "./local-media";
import { titleBrief, titleHtml } from "../tools/title-card";
import {
  alphaArgs, autoEditArgs, clickMixArgs, COLOR_METHODS, cutsEvery, demucsArgs, isStemMode, exportArgs, EXPORT_PRESETS, frameArgs, framesToVideoArgs,
  isColorMethod, isDetectMode, isExportPreset, isRemoveModel, parseScenes, sceneArgs, videoTool, VIDEO_TOOLS,
  type FrameJob, type Shot, type VideoToolId,
} from "../tools/video-tools";

const run = promisify(execFile);

/** A program you installed: HAGGS_VIDEO_TOOLS_BIN first, then the PATH. */
export function toolPath(command: string, env: NodeJS.ProcessEnv = process.env): string | null {
  const dir = env.HAGGS_VIDEO_TOOLS_BIN;
  if (dir && existsSync(join(dir, command))) return join(dir, command);
  for (const part of (env.PATH ?? "").split(":")) if (part && existsSync(join(part, command))) return join(part, command);
  return null;
}

/** The small Python programs HAGGS ships in tools/video-tools. They only call the libraries you installed. */
const script = (name: string) => join(process.cwd(), "tools", "video-tools", name);

async function present(command: string, module?: string): Promise<boolean> {
  const exe = toolPath(command);
  if (!exe) return false;
  if (!module) return true;
  return run(exe, ["-c", `import ${module}`], { timeout: 60_000 }).then(() => true, () => false);
}

export async function availability(): Promise<Record<VideoToolId, boolean>> {
  const entries = await Promise.all(VIDEO_TOOLS.map(async (t) => [t.id, await present(t.id === "ffmpeg-export" ? "ffmpeg" : t.command, t.module)] as const));
  return Object.fromEntries(entries) as Record<VideoToolId, boolean>;
}

const seconds = async (file: string) => {
  const { stdout } = await run(ffprobeBin(), ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]);
  return Number(stdout.trim());
};
const hasStream = async (file: string, kind: "a" | "v") => (await run(ffprobeBin(), ["-v", "error", "-select_streams", kind, "-show_entries", "stream=index", "-of", "csv=p=0", file])).stdout.trim().length > 0;
const fpsOf = async (file: string, cap: number) => {
  const { stdout } = await run(ffprobeBin(), ["-v", "error", "-select_streams", "v", "-show_entries", "stream=r_frame_rate", "-of", "csv=p=0", file]);
  const [n, d] = stdout.trim().split("/").map(Number);
  const fps = n && d ? n / d : 24;
  return Math.max(1, Math.min(cap, Math.round(fps)));
};

export type ToolResult =
  | { ok: true; tool: VideoToolId; url?: string; extra?: string; name?: string; before?: number; after?: number; shots?: Shot[]; stills?: string[]; bpm?: number; beats?: number[]; cuts?: number[]; frames?: number; frameUrls?: string[]; stems?: { name: string; url: string }[] }
  | { ok: false; reason: string };

const num = (v: unknown, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);

/** Runs one tool on a clip that is already in the local media folder. Output goes to haggs-tools/ in the same folder. */
export async function runVideoTool(body: Record<string, unknown>, root: string | undefined, env = process.env.NODE_ENV): Promise<ToolResult> {
  const tool = typeof body.tool === "string" ? videoTool(body.tool) : undefined;
  if (!tool) return { ok: false, reason: "Unknown tool." };
  if (!root) return { ok: false, reason: "Set HAGGS_LOCAL_MEDIA so the result has somewhere to be kept." };
  const open = (u: unknown) => (typeof u === "string" && u.startsWith("/api/local/") ? localFile(root, u.slice("/api/local/".length).split("/").map(decodeURIComponent), env) : null);
  const file = tool.input === "none" ? null : open(body.url);
  const kindOk = tool.input === "none" || file && (file.type.startsWith("video/") || (tool.input === "video-or-audio" && file.type.startsWith("audio/")));
  if (!kindOk) return { ok: false, reason: tool.input === "video-or-audio" ? "Add a video or a song first." : "Add a video clip first." };
  if (!(await present(tool.id === "ffmpeg-export" ? "ffmpeg" : tool.command, tool.module))) return { ok: false, reason: `${tool.name} needs ${tool.module ? `the ${tool.module} Python library` : tool.command} installed on this machine. Setup steps are on this page.` };
  const exe = toolPath(tool.id === "ffmpeg-export" ? "ffmpeg" : tool.command)!;
  const input = file as NonNullable<typeof file>;
  const ffmpeg = ffmpegBin();

  const stamp = `${new Date().toISOString().slice(0, 10)}-${crypto.randomUUID().slice(0, 8)}`;
  const dir = join(root, "haggs-tools", `${tool.id}-${stamp}`);
  await mkdir(dir, { recursive: true });
  const opts = { maxBuffer: 16 * 1024 * 1024, timeout: 30 * 60_000, env: { ...process.env, PATH: `${process.env.HAGGS_VIDEO_TOOLS_BIN ?? ""}:${process.env.PATH ?? ""}` } };
  const rel = (name: string) => localUrl("haggs-tools", `${tool.id}-${stamp}`, name);
  const work = join(dir, "work");
  try {
    if (tool.id === "ffmpeg-export") {
      if (!isExportPreset(body.preset)) return { ok: false, reason: "Choose an export." };
      const out = `export.${EXPORT_PRESETS[body.preset].ext}`;
      await run(exe, exportArgs(input.path, join(dir, out), body.preset), opts);
      return { ok: true, tool: tool.id, url: rel(out), before: await seconds(input.path), after: await seconds(join(dir, out)) };
    }
    if (tool.id === "scene-detect") {
      const mode = isDetectMode(body.mode) ? body.mode : "content";
      await run(exe, sceneArgs(input.path, dir, mode, Number(body.sensitivity)), opts);
      const shots = parseScenes(await readFile(join(dir, "scenes.csv"), "utf8"));
      const stills = (await readdir(dir)).filter((n) => /^shot-\d+-01\.jpg$/.test(n)).sort().map(rel);
      return { ok: true, tool: tool.id, shots, stills, before: await seconds(input.path) };
    }
    if (tool.id === "auto-editor") {
      const out = "edited.mp4";
      await run(exe, autoEditArgs(input.path, join(dir, out), Number(body.threshold), Number(body.margin)), opts);
      return { ok: true, tool: tool.id, url: rel(out), before: await seconds(input.path), after: await seconds(join(dir, out)) };
    }
    if (tool.id === "beat-cuts") {
      const video = input.type.startsWith("video/");
      const audio = !video || (await hasStream(input.path, "a"));
      if (!audio) return { ok: false, reason: "That clip has no sound to find beats in." };
      await run(ffmpeg, ["-y", "-hide_banner", "-loglevel", "error", "-i", input.path, "-vn", "-ac", "1", "-ar", "22050", join(dir, "audio.wav")], opts);
      await run(exe, [script("beats.py"), join(dir, "audio.wav"), dir], opts);
      const found = JSON.parse(await readFile(join(dir, "beats.json"), "utf8")) as { bpm: number; beats: number[]; duration: number };
      if (!found.beats.length) return { ok: false, reason: "No clear beat was found in that sound." };
      const out = video ? "beat-check.mp4" : "beat-check.m4a";
      await run(ffmpeg, clickMixArgs(input.path, join(dir, "clicks.wav"), join(dir, out), audio && video, video), opts);
      await rm(join(dir, "audio.wav"), { force: true });
      return { ok: true, tool: tool.id, url: rel(out), bpm: found.bpm, beats: found.beats, cuts: cutsEvery(found.beats, num(body.every, 4)), before: found.duration };
    }
    if (tool.id === "animated-titles") {
      const brief = titleBrief(body);
      const project = join(dir, "project");
      const hf = ["--yes", "hyperframes@0.9.6"];
      await run(exe, [...hf, "init", "project", "--example", "blank", "--resolution", brief.shape, "--non-interactive", "--skip-skills", "--skip-transcribe"], { ...opts, cwd: dir });
      await writeFile(join(project, "index.html"), titleHtml(brief));
      const out = `title.${brief.format}`;
      await run(exe, [...hf, "render", "--format", brief.format, "--quality", "looks", "-o", join(dir, out)], { ...opts, cwd: project });
      await rm(project, { recursive: true, force: true });
      return { ok: true, tool: tool.id, url: rel(out), after: brief.seconds, extra: brief.format };
    }
    if (tool.id === "split-stems") {
      const mode = isStemMode(body.stems) ? body.stems : "two";
      await run(ffmpeg, ["-y", "-hide_banner", "-loglevel", "error", "-t", "120", "-i", input.path, "-vn", "-ac", "2", "-ar", "44100", join(dir, "track.wav")], opts);
      await run(exe, demucsArgs(join(dir, "track.wav"), join(dir, "demucs"), mode), opts);
      const made = join(dir, "demucs", "htdemucs", "track");
      const stems = (await readdir(made)).filter((n) => n.endsWith(".wav")).sort();
      if (!stems.length) return { ok: false, reason: "No stems were made." };
      for (const n of stems) await rename(join(made, n), join(dir, n));
      await rm(join(dir, "demucs"), { recursive: true, force: true });
      await rm(join(dir, "track.wav"), { force: true });
      return { ok: true, tool: tool.id, stems: stems.map((n) => ({ name: n.replace(".wav", "").replace("no_vocals", "backing"), url: rel(n) })) };
    }
    // The frame-by-frame tools: first seconds of the clip, as pictures, through the tool, back to video.
    const cap = tool.id === "remove-bg" ? { seconds: 8, fps: 24, width: 960 } : { seconds: 10, fps: 24, width: 1280 };
    const job: FrameJob = { seconds: Math.min(cap.seconds, num(body.seconds, cap.seconds)), fps: await fpsOf(input.path, cap.fps), width: cap.width };
    const inDir = join(work, "in"), outDir = join(work, "out");
    await mkdir(inDir, { recursive: true });
    await mkdir(outDir, { recursive: true });
    await run(ffmpeg, frameArgs(input.path, inDir, job), opts);
    const frames = (await readdir(inDir)).filter((n) => n.endsWith(".png")).length;
    if (!frames) return { ok: false, reason: "No frames could be read from that clip." };
    if (tool.id === "color-match") {
      const ref = open(body.reference);
      if (!ref || !ref.type.startsWith("image/")) return { ok: false, reason: "Add a reference picture first." };
      const method = isColorMethod(body.method) ? body.method : "mkl";
      await run(exe, [script("match_color.py"), ref.path, inDir, outDir, method], opts);
      await run(ffmpeg, framesToVideoArgs(outDir, input.path, join(dir, "matched.mp4"), job, await hasStream(input.path, "a")), opts);
      await rm(work, { recursive: true, force: true });
      return { ok: true, tool: tool.id, url: rel("matched.mp4"), before: Math.min(await seconds(input.path), job.seconds), after: frames / job.fps, frames, extra: COLOR_METHODS[method] };
    }
    const model = isRemoveModel(body.model) ? body.model : "u2net";
    await run(exe, ["p", "-m", model, inDir, outDir], opts);
    await run(ffmpeg, alphaArgs(outDir, join(dir, "cutout.webm"), job.fps), opts);
    await run(ffmpeg, alphaArgs(outDir, join(dir, "cutout.mov"), job.fps), opts);
    await run(ffmpeg, ["-y", "-hide_banner", "-loglevel", "error", "-i", join(outDir, `${String(Math.ceil(frames / 2)).padStart(6, "0")}.png`), join(dir, "still.png")], opts);
    await rm(work, { recursive: true, force: true });
    return { ok: true, tool: tool.id, url: rel("cutout.webm"), extra: rel("cutout.mov"), stills: [rel("still.png")], frames, after: frames / job.fps };
  } catch (caught) {
    const text = caught instanceof Error ? caught.message : "";
    return { ok: false, reason: `${tool.name} couldn't finish. ${text.split("\n").slice(0, 3).join(" ").slice(0, 300)}`.trim() };
  }
}
