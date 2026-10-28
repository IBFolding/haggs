import assert from "node:assert/strict";
import { test } from "node:test";

import { autoFolder, groupRuns } from "./gallery-groups";

const run = (id: string, at: number, extra: Partial<{ folder: string; kind: "image" | "video" | "audio"; modelName: string }> = {}) => ({ id, at, kind: "image" as const, modelName: "FLUX 3", ...extra });

test("by folder, Unfiled comes first and the rest by their newest run", () => {
  const groups = groupRuns([run("a", 1, { folder: "Ads" }), run("b", 5), run("c", 9, { folder: "Night Shift" }), run("d", 3, { folder: "Ads" })], "Folder");
  assert.deepEqual(groups.map((g) => [g.name, g.runs.map((r) => r.id)]), [["Unfiled", ["b"]], ["Night Shift", ["c"]], ["Ads", ["a", "d"]]]);
});

test("by kind and by model", () => {
  const rs = [run("a", 1, { kind: "video", modelName: "Kling 3" }), run("b", 2), run("c", 3, { kind: "audio", modelName: "  " })];
  assert.deepEqual(groupRuns(rs, "Kind").map((g) => g.name), ["Sounds", "Images", "Video"]);
  assert.deepEqual(groupRuns(rs, "Model").map((g) => g.name), ["Unknown model", "FLUX 3", "Kling 3"]);
});

test("none is one section, and nothing is no sections", () => {
  assert.equal(groupRuns([run("a", 1), run("b", 2)], "None").length, 1);
  assert.deepEqual(groupRuns([], "Folder"), []);
});

test("auto-organise names a folder by what a run is and what made it", () => {
  assert.equal(autoFolder({ kind: "video", modelName: "Kling 3" }), "Video · Kling 3");
  assert.equal(autoFolder({ kind: "audio", modelName: "" }), "Sounds · Unknown model");
});
