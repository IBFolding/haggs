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
    assert.equal(entries.length, 1);
    assert.equal(entries[0]!.thumb, "https://cloud.comfy.org/templates/one-1.webp");
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
