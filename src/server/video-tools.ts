import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

import { ffprobeBin } from "./ffmpeg";
import { localFile, localUrl } from "./local-media";
import {
  autoEditArgs, exportArgs, EXPORT_PRESETS, isDetectMode, isExportPreset, parseScenes, sceneArgs, videoTool,
  type Shot, type VideoToolId,
} from "../tools/video-tools";

const run = promisify(execFile);

/** A program you installed: HAGGS_VIDEO_TOOLS_BIN first, then the PATH. */
export function toolPath(command: string, env: NodeJS.ProcessEnv = process.env): string | null {
  const dir = env.HAGGS_VIDEO_TOOLS_BIN;
  if (dir && existsSync(join(dir, command))) return join(dir, command);
  for (const part of (env.PATH ?? "").split(":")) if (part && existsSync(join(part, command))) return join(part, command);
  return null;
}

export function availability(): Record<VideoToolId, boolean> {
  return { "ffmpeg-export": !!toolPath("ffmpeg"), "scene-detect": !!toolPath("scenedetect"), "auto-editor": !!toolPath("auto-editor") };
}

const seconds = async (file: string) => {
  const { stdout } = await run(ffprobeBin(), ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]);
  return Number(stdout.trim());
};

export type ToolResult =
  | { ok: true; tool: VideoToolId; url?: string; name?: string; before?: number; after?: number; shots?: Shot[]; stills?: string[] }
  | { ok: false; reason: string };

/** Runs one tool on a clip that is already in the local media folder. Output goes to haggs-tools/ in the same folder. */
export async function runVideoTool(body: Record<string, unknown>, root: string | undefined, env = process.env.NODE_ENV): Promise<ToolResult> {
  const tool = typeof body.tool === "string" ? videoTool(body.tool) : undefined;
  if (!tool) return { ok: false, reason: "Unknown tool." };
  if (!root) return { ok: false, reason: "Set HAGGS_LOCAL_MEDIA so the result has somewhere to be kept." };
  const url = typeof body.url === "string" ? body.url : "";
  const file = url.startsWith("/api/local/") ? localFile(root, url.slice("/api/local/".length).split("/").map(decodeURIComponent), env) : null;
  if (!file || !file.type.startsWith("video/")) return { ok: false, reason: "Add a video clip first." };
  const exe = toolPath(tool.command);
  if (!exe) return { ok: false, reason: `${tool.name} needs ${tool.command} installed on this machine. Setup steps are on this page.` };

  const stamp = `${new Date().toISOString().slice(0, 10)}-${crypto.randomUUID().slice(0, 8)}`;
  const dir = join(root, "haggs-tools", `${tool.id}-${stamp}`);
  await mkdir(dir, { recursive: true });
  const opts = { maxBuffer: 16 * 1024 * 1024, timeout: 30 * 60_000, env: { ...process.env, PATH: `${process.env.HAGGS_VIDEO_TOOLS_BIN ?? ""}:${process.env.PATH ?? ""}` } };
  const rel = (name: string) => localUrl("haggs-tools", `${tool.id}-${stamp}`, name);
  try {
    if (tool.id === "ffmpeg-export") {
      if (!isExportPreset(body.preset)) return { ok: false, reason: "Choose an export." };
      const out = `export.${EXPORT_PRESETS[body.preset].ext}`;
      await run(exe, exportArgs(file.path, join(dir, out), body.preset), opts);
      return { ok: true, tool: tool.id, url: rel(out), before: await seconds(file.path), after: await seconds(join(dir, out)) };
    }
    if (tool.id === "scene-detect") {
      const mode = isDetectMode(body.mode) ? body.mode : "content";
      await run(exe, sceneArgs(file.path, dir, mode, Number(body.sensitivity)), opts);
      const shots = parseScenes(await readFile(join(dir, "scenes.csv"), "utf8"));
      const stills = (await readdir(dir)).filter((n) => /^shot-\d+-01\.jpg$/.test(n)).sort().map(rel);
      return { ok: true, tool: tool.id, shots, stills, before: await seconds(file.path) };
    }
    const out = "edited.mp4";
    await run(exe, autoEditArgs(file.path, join(dir, out), Number(body.threshold), Number(body.margin)), opts);
    return { ok: true, tool: tool.id, url: rel(out), before: await seconds(file.path), after: await seconds(join(dir, out)) };
  } catch (caught) {
    const text = caught instanceof Error ? caught.message : "";
    return { ok: false, reason: `${tool.name} couldn't finish. ${text.split("\n").slice(0, 3).join(" ").slice(0, 300)}`.trim() };
  }
}
