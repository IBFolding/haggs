import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";

import { runVideoTool, toolPath } from "../server/video-tools";
import { autoEditArgs, exportArgs, parseScenes, sceneArgs, VIDEO_TOOLS } from "./video-tools";

const dir = mkdtempSync(join(tmpdir(), "video-tools-"));
after(() => rmSync(dir, { recursive: true, force: true }));

test("every tool credits a creator, links their GitHub and states a licence", () => {
  for (const t of VIDEO_TOOLS) {
    assert.ok(t.creator && t.licence && t.tested);
    assert.match(t.github, /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+$/);
    assert.ok(t.licenceUrl.startsWith(t.github));
  }
});

test("tool settings are clamped to safe values", () => {
  assert.ok(autoEditArgs("a", "b", -999, 99).includes("audio:threshold=-60dB"));
  assert.ok(autoEditArgs("a", "b", NaN, NaN).includes("0.1sec"));
  assert.ok(sceneArgs("a", "d", "content", 9999).includes("60"));
});

test("scene CSV is read into shots", () => {
  const csv = "Scene Number,Start Frame,Start Timecode,Start Time (seconds),End Frame,End Timecode,End Time (seconds),Length (frames),Length (timecode),Length (seconds)\n1,1,00:00:00.000,0.000,148,00:00:04.933,4.933,148,00:00:04.933,4.933\n2,149,00:00:04.933,4.933,253,00:00:08.433,8.433,105,00:00:03.500,3.500\n";
  assert.deepEqual(parseScenes(csv), [{ number: 1, start: 0, end: 4.933, length: 4.933 }, { number: 2, start: 4.933, end: 8.433, length: 3.5 }]);
});

test("a clip outside the media folder is refused", async () => {
  const r = await runVideoTool({ tool: "ffmpeg-export", preset: "web", url: "/api/local/../../etc/passwd" }, dir, "development");
  assert.equal(r.ok, false);
});

test("a real clip exports to the vertical preset at 1080x1920", { skip: !toolPath("ffmpeg") }, async () => {
  mkdirSync(join(dir, "in"));
  execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "testsrc2=s=640x360:r=30:d=2", "-f", "lavfi", "-i", "sine=d=2", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-shortest", join(dir, "in", "c.mp4")]);
  const r = await runVideoTool({ tool: "ffmpeg-export", preset: "vertical", url: "/api/local/in/c.mp4" }, dir, "development");
  assert.ok(r.ok, JSON.stringify(r));
  if (!r.ok || !r.url) return;
  const path = join(dir, ...decodeURIComponent(r.url.slice("/api/local/".length)).split("/"));
  assert.ok(existsSync(path));
  const size = execFileSync("ffprobe", ["-v", "error", "-select_streams", "v", "-show_entries", "stream=width,height", "-of", "csv=p=0", path]).toString().trim();
  assert.equal(size, "1080,1920");
  writeFileSync(join(dir, "ok"), "1");
});

test("export args differ by preset", () => {
  assert.notDeepEqual(exportArgs("i", "o", "web"), exportArgs("i", "o", "small"));
  assert.ok(exportArgs("i", "o.mov", "prores").includes("prores_ks"));
});

const VENV = process.env.HAGGS_VIDEO_TOOLS_BIN;

test("PySceneDetect finds the one cut in a red-then-blue clip", { skip: !toolPath("scenedetect") }, async () => {
  mkdirSync(join(dir, "sd"), { recursive: true });
  execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "color=red:s=320x180:r=30:d=2", "-f", "lavfi", "-i", "color=blue:s=320x180:r=30:d=2", "-filter_complex", "[0][1]concat=n=2:v=1:a=0", "-pix_fmt", "yuv420p", join(dir, "sd", "c.mp4")]);
  const r = await runVideoTool({ tool: "scene-detect", mode: "content", url: "/api/local/sd/c.mp4" }, dir, "development");
  assert.ok(r.ok, JSON.stringify(r));
  if (r.ok) { assert.equal(r.shots?.length, 2); assert.equal(r.stills?.length, 2); }
});

test("Auto-Editor shortens a clip that is half silence", { skip: !toolPath("auto-editor") || !VENV }, async () => {
  mkdirSync(join(dir, "ae"), { recursive: true });
  execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "testsrc2=s=320x180:r=30:d=6", "-f", "lavfi", "-i", "sine=f=440:d=3", "-f", "lavfi", "-i", "anullsrc=d=3", "-filter_complex", "[1][2]concat=n=2:v=0:a=1[a]", "-map", "0:v", "-map", "[a]", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", join(dir, "ae", "c.mp4")]);
  const r = await runVideoTool({ tool: "auto-editor", threshold: -35, margin: 0.1, url: "/api/local/ae/c.mp4" }, dir, "development");
  assert.ok(r.ok, JSON.stringify(r));
  if (r.ok) assert.ok((r.after ?? 99) < (r.before ?? 0) - 1.5, `${r.before} -> ${r.after}`);
});
