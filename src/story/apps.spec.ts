import assert from "node:assert/strict";
import { test } from "node:test";

import { appFile, createAppStore, readAppFile } from "./apps";
import { memoryKv } from "./kv";

const workflow = JSON.stringify({ "1": { class_type: "LoadImage", inputs: { image: "a.png" } } });

test("an app is saved with its workflow and cover, listed newest first, and renamed in place", async () => {
  const apps = createAppStore(memoryKv());
  const a = await apps.save({ name: "Product to ad", description: "Drop a product, get an ad", workflow });
  const b = await apps.save({ name: "Put me in it", description: "", workflow, cover: { url: "/api/local/r.mp4", kind: "video" } });
  assert.deepEqual((await apps.list()).map((x) => x.name), ["Put me in it", "Product to ad"]);
  await apps.save({ ...a, name: "Product ad" });
  assert.equal((await apps.load(a.id))!.name, "Product ad");
  assert.equal((await apps.list()).length, 2);
  await apps.remove(b.id);
  assert.deepEqual((await apps.list()).map((x) => x.id), [a.id]);
});

test("an app file carries the workflow, its steps and an embedded cover, and reads back as a new app", async () => {
  const text = appFile({ id: "x", name: "Put me in it", description: "Swap", workflow, recipe: { name: "Put me in it", steps: [{ kind: "picture-in" }] }, cover: { url: "data:image/webp;base64,AAAA", kind: "image" }, createdAt: 1, updatedAt: 2 });
  const back = readAppFile(text);
  assert.equal(back.name, "Put me in it");
  assert.equal(back.workflow, workflow);
  assert.equal(back.recipe!.steps[0]!.kind, "picture-in");
  assert.equal(back.cover!.url, "data:image/webp;base64,AAAA");
  assert.equal("id" in back, false, "an imported app gets a new id when saved");
});

test("a file that isn't an app, or carries a cover from somewhere else, is refused or cleaned", () => {
  assert.throws(() => readAppFile("nope"), /isn't a haggs app/);
  assert.throws(() => readAppFile(JSON.stringify({ format: "haggs.app/1", name: "x" })), /workflow/);
  const odd = readAppFile(JSON.stringify({ format: "haggs.app/1", name: "x", workflow, cover: { url: "javascript:alert(1)", kind: "image" } }));
  assert.equal(odd.cover, undefined);
});
