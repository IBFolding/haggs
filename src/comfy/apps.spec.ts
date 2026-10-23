import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { appOf, fill } from "./apps";
import { toApiPrompt, type Catalog, type UiWorkflow } from "./convert";

const dir = join(import.meta.dirname, "fixtures");
const catalog: Catalog = JSON.parse(readFileSync(join(dir, "catalog.json"), "utf8"));
const ui: UiWorkflow = JSON.parse(readFileSync(join(dir, "api_higgsfield_genjutsu_motion_transfer.json"), "utf8"));

test("Genjutsu as an app: a video and two pictures to drop, the prompt to type, the resolution to pick", () => {
  const { prompt } = toApiPrompt(ui, catalog);
  const app = appOf(ui, prompt, catalog, { "rooftop_dancer.mp4": "https://x/rooftop_dancer.mp4" });
  assert.deepEqual(app.fields.map((f) => [f.kind, f.node, f.input]), [
    ["media", "13", "file"], ["media", "14", "image"], ["media", "15", "image"],
    ["text", "9", "model.prompt"],
    ["choice", "9", "model.resolution"],
  ]);
  const video = app.fields[0]!;
  assert.ok(video.kind === "media" && video.media === "video" && video.sample === "https://x/rooftop_dancer.mp4");
  assert.equal(app.output, "10");
  assert.equal(app.produces, "video");
});

test("filling an app changes only what it offers, and refuses values it doesn't", () => {
  const { prompt } = toApiPrompt(ui, catalog);
  const app = appOf(ui, prompt, catalog);
  const filled = fill(prompt, app, { "13/file": "up_dance.mp4", "9/model.prompt": "Put me in it", "9/model.resolution": "480p", "9/model.seed": 1 });
  assert.equal(filled["13"]!.inputs.file, "up_dance.mp4");
  assert.equal(filled["9"]!.inputs["model.prompt"], "Put me in it");
  assert.equal(filled["9"]!.inputs["model.seed"], 42, "the seed isn't a field, so it isn't changed");
  assert.equal(prompt["9"]!.inputs["model.resolution"], "720p", "the original is untouched");
  assert.throws(() => fill(prompt, app, { "9/model.resolution": "8k" }), /can't be/);
  assert.throws(() => fill(prompt, app, { "14/image": "../../etc/passwd" }), /didn't upload/);
});

test("leaving out an input removes its loader and the wire it fed, and the rest still validates", async () => {
  const { leaveOut } = await import("./apps");
  const { validate } = await import("./convert");
  const { prompt } = toApiPrompt(ui, catalog);
  const app = appOf(ui, prompt, catalog);
  const without = leaveOut(prompt, app, ["15/image"]);
  assert.equal(without["15"], undefined);
  assert.equal(without["9"]!.inputs["model.reference_images.image_2"], undefined);
  assert.deepEqual(without["9"]!.inputs["model.reference_images.image_1"], ["14", 0]);
  assert.deepEqual(validate(without, catalog), []);
  assert.deepEqual(validate(leaveOut(prompt, app, ["14/image", "15/image"]), catalog).length > 0, true, "Genjutsu needs at least one reference");
  assert.throws(() => leaveOut(prompt, app, ["9/model.prompt"]), /only a file/);
});

test("the multi-angle app offers the picture and the camera, not the negative prompt", async () => {
  const ma: UiWorkflow = JSON.parse(readFileSync(join(dir, "template_qwen_multiangle.app.json"), "utf8"));
  const { prompt, problems } = toApiPrompt(ma, catalog);
  assert.deepEqual(problems, []);
  const app = appOf(ma, prompt, catalog);
  assert.deepEqual(app.fields.map((f) => `${f.kind}:${f.input}`), ["media:image", "number:horizontal_angle", "number:vertical_angle", "number:zoom"]);
  const filled = fill(prompt, app, { "221/horizontal_angle": 90, "221/vertical_angle": -10, "221/zoom": 8 });
  assert.deepEqual([filled["221"]!.inputs.horizontal_angle, filled["221"]!.inputs.vertical_angle, filled["221"]!.inputs.zoom], [90, -10, 8]);
  assert.throws(() => fill(prompt, app, { "221/vertical_angle": 90 }), /out of range/);
});
