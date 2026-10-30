import assert from "node:assert/strict";
import { test } from "node:test";

import { indexOf } from "./comfy-library";

const index = [{ title: "Character & Fashion", type: "image", templates: [{ name: "one", title: "One", mediaSubtype: "webp" }] }];

test("the workflow list still loads when the disk cannot be written", async () => {
  const real = globalThis.fetch;
  globalThis.fetch = (async () => new Response(JSON.stringify(index), { status: 200 })) as typeof fetch;
  try {
    // A path under a file cannot be created: the same as a read-only host.
    const entries = await indexOf("/dev/null/read-only");
    assert.equal(entries.length, 19);
    assert.equal(entries.filter(e => e.name.startsWith("haggs_ltx_")).length, 4);
    assert.equal(entries.find(e => e.name === "one")!.thumb, "https://cloud.comfy.org/templates/one-1.webp");
  } finally {
    globalThis.fetch = real;
  }
});

test("a second read comes from memory without asking Comfy again", async () => {
  const real = globalThis.fetch;
  let asked = 0;
  globalThis.fetch = (async () => { asked += 1; return new Response(JSON.stringify(index), { status: 200 }); }) as typeof fetch;
  try {
    await indexOf("/dev/null/read-only-2");
    await indexOf("/dev/null/read-only-2");
    assert.equal(asked, 1);
  } finally {
    globalThis.fetch = real;
  }
});


test("bundled LTX entries and graphs remain available when the cloud library is offline", async () => {
  const real = globalThis.fetch;
  globalThis.fetch = (async () => { throw new Error("offline"); }) as typeof fetch;
  try {
    const entries = await indexOf("/dev/null/ltx-offline");
    assert.equal(entries.length, 18);
    const { templateOf } = await import("./comfy-library");
    const ui = await templateOf("/dev/null/ltx-offline", entries[0]!.name);
    assert.ok(ui.nodes.length > 0);
  } finally { globalThis.fetch = real; }
});
