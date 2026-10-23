import assert from "node:assert/strict";
import test from "node:test";
import { TOKEN_COOKIE, ownerOf, signInRequired, verifyUser } from "./auth";

test("a request with no token, or no Supabase configured, is nobody", async () => {
  assert.equal(await verifyUser(new Request("https://x.test/")), null);
  assert.equal(await verifyUser(new Request("https://x.test/", { headers: { authorization: "Bearer abc" } })), null, "no project configured here");
  assert.equal(await verifyUser(new Request("https://x.test/", { headers: { cookie: `${TOKEN_COOKIE}=abc; a=b` } })), null);
});

test("files are kept in the person's own folder, or the shared guest folder", () => {
  assert.equal(ownerOf({ id: "123", email: "a@b.c" }), "u-123");
  assert.equal(ownerOf(null), "guest");
});

test("signing in is only demanded when switched on", () => {
  const was = process.env.HAGGS_REQUIRE_SIGNIN;
  delete process.env.HAGGS_REQUIRE_SIGNIN;
  assert.equal(signInRequired(), false);
  process.env.HAGGS_REQUIRE_SIGNIN = "1";
  assert.equal(signInRequired(), true);
  if (was === undefined) delete process.env.HAGGS_REQUIRE_SIGNIN; else process.env.HAGGS_REQUIRE_SIGNIN = was;
});
