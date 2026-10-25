import assert from "node:assert/strict";
import { test } from "node:test";

import { cleanFolder, folderNames, inFolder } from "./gallery-folders";
import { createRunStore, type NewRun } from "./runs";
import { memoryKv } from "./kv";

const made = (prompt: string): NewRun => ({ modelId: "m", modelName: "M", prompt, settings: {}, url: `/${prompt}.png`, kind: "image", usd: 0.07 });

test("moving a run into a folder keeps it there and counts as a change that syncs", async () => {
  const runs = createRunStore(memoryKv());
  const r = await runs.record(made("a"));
  await runs.setFolder(r.id, "Kiln ads");
  const [after] = await runs.list();
  assert.equal(after!.folder, "Kiln ads");
  assert.ok((after!.rev ?? 0) >= (r.rev ?? 0));
  await runs.setFolder(r.id, null);
  assert.equal((await runs.list())[0]!.folder, undefined);
});

test("folder names are the distinct ones in use, sorted, without blanks", () => {
  assert.deepEqual(folderNames([{ folder: "B" }, { folder: "a" }, {}, { folder: "B" }, { folder: " " }] as never), ["a", "B"]);
});

test("a folder filter shows All, Unfiled, or one folder", () => {
  const runs = [{ folder: "X" }, {}, { folder: "Y" }] as never[];
  assert.equal(runs.filter((r) => inFolder(r, "All")).length, 3);
  assert.equal(runs.filter((r) => inFolder(r, "Unfiled")).length, 1);
  assert.equal(runs.filter((r) => inFolder(r, "X")).length, 1);
});

test("a folder name is trimmed and kept short; nothing typed means no folder", () => {
  assert.equal(cleanFolder("  Kiln  ads "), "Kiln ads");
  assert.equal(cleanFolder("x".repeat(80))?.length, 40);
  assert.equal(cleanFolder("   "), null);
});
