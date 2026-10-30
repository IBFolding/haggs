import assert from "node:assert/strict";
import { test } from "node:test";
import { AD_HANDOFF_KEY, prepareAdHandoff } from "./ad-handoff";

test("Video receives the finished ad as a reference and animation instructions, without generation", async () => {
  let stored = "";
  const route = await prepareAdHandoff("/fixture.png", "Video", "original still prompt", {
    shrink: async (url, max) => { assert.equal(url, "/fixture.png"); assert.equal(max, 1536); return "data:image/jpeg;base64,fixture"; },
    save: (key, value) => { assert.equal(key, AD_HANDOFF_KEY); stored = value; },
  });
  assert.equal(route, "/video");
  const gift = JSON.parse(stored);
  assert.equal(gift.to, "Video");
  assert.equal(gift.url, "data:image/jpeg;base64,fixture");
  assert.match(gift.prompt, /Preserve the product, composition and lettering/);
});

test("Edit receives the result and its original campaign prompt", async () => {
  let stored = "";
  assert.equal(await prepareAdHandoff("/ad.png", "Edit", "Campaign headline", {
    shrink: async (url) => url, save: (_, value) => { stored = value; },
  }), "/edit");
  assert.deepEqual(JSON.parse(stored), { url: "/ad.png", to: "Edit", prompt: "Campaign headline" });
});

test("blocked storage cannot silently navigate and lose the ad", async () => {
  await assert.rejects(prepareAdHandoff("/ad.png", "Video", "", {
    shrink: async (url) => url, save: () => { throw new Error("Storage unavailable"); },
  }), /Storage unavailable/);
});
