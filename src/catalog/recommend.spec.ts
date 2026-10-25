import assert from "node:assert/strict";
import { test } from "node:test";

import { recommend, type Candidate } from "./recommend";

const pics: Candidate[] = [
  { id: "bfl/flux-3-image", name: "FLUX 3", inputImages: 10 },
  { id: "google/nano-banana-2", name: "Nano Banana 2", inputImages: 14 },
  { id: "fal-ai/flux/schnell", name: "FLUX schnell", inputImages: 0 },
];
const clips: Candidate[] = [
  { id: "minimax/minimax-h3", name: "MiniMax H3", inputImages: 1 },
  { id: "google/veo-3-1", name: "Veo 3.1", inputImages: 1 },
  { id: "kling/kling-v3", name: "Kling 3", inputImages: 1 },
  { id: "ltx/ltx-2-5-fast", name: "LTX 2.5 Fast", inputImages: 1 },
  { id: "byteplus/seedance-2-5", name: "Seedance 2.5", inputImages: 1 },
];
const edits: Candidate[] = [{ id: "bfl/flux-kontext-pro", name: "FLUX Kontext", inputImages: 1 }, { id: "google/nano-banana-2", name: "Nano Banana 2", inputImages: 14 }];

test("a picture with words on it goes to FLUX 3", () => {
  assert.equal(recommend("A poster with the headline OPEN LATE in bold type", "Create", pics, 0)?.id, "bfl/flux-3-image");
});

test("a quick draft goes to the fast, cheap model", () => {
  assert.equal(recommend("quick rough sketch of a dragon idea", "Create", pics, 0)?.id, "fal-ai/flux/schnell");
});

test("anything else gets a good all-rounder, with a reason", () => {
  const r = recommend("a fox in a snowy forest", "Create", pics, 0);
  assert.ok(r && r.why.length > 10);
});

test("a clip where someone speaks goes to a model that makes the sound", () => {
  assert.equal(recommend("she turns and says: we leave at dawn", "Video", clips, 0)?.id, "google/veo-3-1");
});

test("animating a held picture goes to Kling", () => {
  assert.equal(recommend("bring this to life, slow push in", "Video", clips, 1)?.id, "kling/kling-v3");
});

test("a fast draft clip goes to the fast one; big action goes to Seedance", () => {
  assert.equal(recommend("quick draft of a cat jumping", "Video", clips, 0)?.id, "ltx/ltx-2-5-fast");
  assert.equal(recommend("a chase through a market, handheld, explosion", "Video", clips, 0)?.id, "byteplus/seedance-2-5");
});

test("editing always goes to Kontext", () => {
  assert.equal(recommend("make the sky purple", "Edit", edits, 1)?.id, "bfl/flux-kontext-pro");
});

test("it never recommends a model that isn't offered, and says nothing for an empty prompt", () => {
  assert.equal(recommend("she says hello", "Video", clips.filter((c) => !c.id.includes("veo")), 0)?.id !== "google/veo-3-1", true);
  assert.equal(recommend("   ", "Create", pics, 0), null);
  assert.equal(recommend("a poster with text", "Create", [], 0), null);
});
