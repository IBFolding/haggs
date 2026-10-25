import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";

import { makeSheet } from "./sprites";

const dir = mkdtempSync(join(tmpdir(), "sprites-"));
after(() => rmSync(dir, { recursive: true, force: true }));

test("a real clip becomes one sheet of the right size", async () => {
  execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "testsrc2=s=320x180:r=30:d=4", "-c:v", "libx264", "-pix_fmt", "yuv420p", join(dir, "c.mp4")]);
  const r = await makeSheet(join(dir, "c.mp4"), join(dir, "sheet.png"), { frames: 8, columns: 4, size: 128 });
  assert.deepEqual({ columns: r.columns, rows: r.rows, size: r.size, frames: r.frames }, { columns: 4, rows: 2, size: 128, frames: 8 });
  const dims = execFileSync("ffprobe", ["-v", "error", "-show_entries", "stream=width,height", "-of", "csv=p=0", join(dir, "sheet.png")]).toString().trim();
  assert.equal(dims, "512,256");
});

test("something that isn't a video gives a plain error", async () => {
  await assert.rejects(makeSheet(join(dir, "nope.mp4"), join(dir, "x.png"), { frames: 8, columns: 4, size: 128 }), /couldn't|length/i);
});
