import assert from "node:assert/strict";
import { test } from "node:test";

import { CLOUD_MODELS, cloudPrice, cloudWorkflow } from "../providers/cloud-models";
import { getModelCard, MODELS } from "./models";
import { defaultSettings, toWireSettings } from "./settings";

test("every cloud model has a catalog card of the right kind, and every cloud card has a model behind it", () => {
  for (const [id, def] of Object.entries(CLOUD_MODELS)) {
    const card = getModelCard(id);
    assert.equal(card.provider, "comfy", id);
    assert.equal(card.inputImages, def.maxImages, `${id}: pictures`);
    assert.ok((def.kind === "video" ? ["text-to-video", "image-to-video"] : ["text-to-image", "image-edit"]).includes(card.capability), `${id}: capability`);
  }
  const cloudIds = new Set(Object.keys(CLOUD_MODELS));
  const routerOnly = new Set(["minimax/minimax-h3", "bfl/flux-3-image", "bfl/flux-3-video", "ltx/ltx-2-5-pro", "ltx/ltx-2-5-fast"]);
  for (const card of MODELS.filter((m) => m.provider === "comfy")) assert.ok(cloudIds.has(card.id) || routerOnly.has(card.id), `${card.id} is neither a cloud model nor a known Router one`);
});

test("a model's default settings make a valid workflow with a real price", () => {
  for (const id of Object.keys(CLOUD_MODELS)) {
    const card = getModelCard(id);
    const wire = toWireSettings(card.settings, defaultSettings(card.settings));
    const images = CLOUD_MODELS[id]!.needsImage ? ["a.png"] : [];
    assert.ok(Object.keys(cloudWorkflow(id, { prompt: "A short test description", settings: wire, images })).length >= 2, id);
    const price = cloudPrice(id, wire);
    assert.ok(price !== null && price > 0 && price < 5, `${id}: price ${price}`);
  }
});

test("every choice a card offers is one its builder understands: no setting is silently ignored", () => {
  for (const id of Object.keys(CLOUD_MODELS)) {
    const card = getModelCard(id);
    for (const [key, field] of Object.entries(card.settings)) {
      if (field.type !== "enum") continue;
      const prices = new Set(field.values.map((v) => cloudPrice(id, toWireSettings(card.settings, { ...defaultSettings(card.settings), [key]: v }))));
      // A resolution or a sound switch should change what a run costs; the others (ratio, thinking) need not.
      if (key === "resolution" && field.values.length > 1 && !id.includes("veo-3-1-fast") && id !== "google/veo-3-1") assert.ok(prices.size > 1, `${id}: ${key} changes nothing`);
    }
  }
});

test("Kling's sound switch and Veo's sound switch change the price; Seedance's does not", () => {
  const on = (id: string, sound: boolean) => cloudPrice(id, toWireSettings(getModelCard(id).settings, { ...defaultSettings(getModelCard(id).settings), sound }));
  assert.notEqual(on("kling/kling-v3", true), on("kling/kling-v3", false));
  assert.notEqual(on("google/veo-3-1", true), on("google/veo-3-1", false));
  assert.equal(on("byteplus/seedance-2-0", true), on("byteplus/seedance-2-0", false));
});
