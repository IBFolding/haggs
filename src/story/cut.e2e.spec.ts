import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { buildCut, ffmpegScript } from "./cut";
import { createProject, newShot } from "./model";

/**
 * Runs the exported script through a real ffmpeg on real media and checks the
 * file against what the cut promised. String assertions on a shell script prove
 * it looks right; only running it proves it joins clips of different sizes,
 * orientations and audio layouts into one file of the right length.
 */

const hasFfmpeg = spawnSync("ffmpeg", ["-version"]).status === 0;

const ff = (...args: string[]) => execFileSync("ffmpeg", ["-loglevel", "error", "-y", ...args]);
const probe = (file: string, ...args: string[]) =>
  execFileSync("ffprobe", ["-v", "error", ...args, file]).toString().trim();

test("the exported file matches the cut it was built from", { skip: !hasFfmpeg, timeout: 120_000 }, () => {
  const dir = mkdtempSync(join(tmpdir(), "haggs-cut-"));
  try {
    ff("-f", "lavfi", "-i", "color=c=0x2a3a52:s=640x360", "-frames:v", "1", join(dir, "still.png"));
    ff("-f", "lavfi", "-i", "testsrc=s=1280x720:r=24", "-f", "lavfi", "-i", "sine=f=440",
       "-t", "3", "-c:v", "libx264", "-c:a", "aac", "-pix_fmt", "yuv420p", join(dir, "sound.mp4"));
    // Portrait and silent: the two ways a clip can disagree with the rest.
    ff("-f", "lavfi", "-i", "testsrc2=s=720x1280:r=30", "-t", "3",
       "-c:v", "libx264", "-pix_fmt", "yuv420p", join(dir, "silent.mp4"));

    const make = (file: string, kind: "image" | "video", seconds: number) => ({
      ...newShot(), heading: file, seconds,
      render: { url: `file://${join(dir, file)}`, kind, usd: 0, promptHash: "h", at: 1 },
    });
    const project = {
      ...createProject("E2E Cut"),
      shots: [make("still.png", "image", 2), make("sound.mp4", "video", 3), make("silent.mp4", "video", 3)],
    };
    const cut = buildCut(project);
    assert.equal(cut.total, 8);

    writeFileSync(join(dir, "export.sh"), ffmpegScript(cut, project.name), { mode: 0o755 });
    execFileSync("bash", ["export.sh"], { cwd: dir, stdio: "pipe" });

    const out = join(dir, "E2E-Cut.mp4");
    assert.ok(Math.abs(Number(probe(out, "-show_entries", "format=duration", "-of", "csv=p=0")) - cut.total) < 0.1,
      "runtime matches the cut");
    assert.equal(probe(out, "-select_streams", "v", "-show_entries", "stream=width,height", "-of", "csv=p=0"), "1920,1080");
    assert.match(probe(out, "-select_streams", "a", "-show_entries", "stream=codec_name", "-of", "csv=p=0"), /aac/);

    // The silent portrait clip must stay silent — normalising must not invent
    // sound — and the clip with sound must keep it.
    const level = (start: number, length: number) =>
      spawnSync("ffmpeg", ["-v", "info", "-ss", String(start), "-t", String(length), "-i", out,
        "-af", "volumedetect", "-vn", "-f", "null", "-"]).stderr.toString().match(/mean_volume: (-?[\d.]+)/)?.[1];
    assert.ok(Number(level(2.2, 2.6)) > -40, "the clip with sound kept its sound");
    assert.ok(Number(level(5.2, 2.6)) < -80, "the silent clip stayed silent");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
