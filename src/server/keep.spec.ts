import assert from "node:assert/strict";
import test from "node:test";

import { keepInAccount } from "./keep";

const bytes = new Uint8Array([1, 2, 3]);

test("a signed-in person with file sync set up has the result kept in their account at once", async () => {
  const kept: string[] = [];
  const url = await keepInAccount(bytes, "png", { user: async () => ({ id: "u1", email: "a@b.c" }), token: "t", upload: async (_b, ext, id) => (kept.push(`${id}.${ext}`), "https://store.test/x.png") });
  assert.equal(url, "https://store.test/x.png");
  assert.deepEqual(kept, ["u1.png"]);
});

test("nobody signed in, or no file sync, means the caller keeps it locally", async () => {
  const upload = async () => { throw new Error("must not upload"); };
  assert.equal(await keepInAccount(bytes, "png", { user: async () => null, token: "t", upload }), null);
  assert.equal(await keepInAccount(bytes, "png", { user: async () => ({ id: "u1", email: "a@b.c" }), token: undefined, upload }), null);
});

test("an upload that fails is not fatal: the caller keeps it locally and it is copied later", async () => {
  const url = await keepInAccount(bytes, "mp4", { user: async () => ({ id: "u1", email: "a@b.c" }), token: "t", upload: async () => { throw new Error("offline"); } });
  assert.equal(url, null);
});
