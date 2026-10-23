import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { allow, caller, resetLimits } from "./limit";

beforeEach(resetLimits);

test("a person gets their allowance per window, then waits for the next window", () => {
  for (let i = 0; i < 3; i += 1) assert.equal(allow("a", 3, 1000, 100), true);
  assert.equal(allow("a", 3, 1000, 200), false);
  assert.equal(allow("a", 3, 1000, 1200), true, "a new window starts");
});

test("people are counted separately", () => {
  assert.equal(allow("a", 1, 1000, 0), true);
  assert.equal(allow("b", 1, 1000, 0), true);
  assert.equal(allow("a", 1, 1000, 1), false);
});

test("the caller is the signed-in person, else the address a proxy reports", () => {
  assert.equal(caller(new Request("https://x.test"), "u1"), "u:u1");
  assert.equal(caller(new Request("https://x.test", { headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" } })), "ip:1.2.3.4");
  assert.equal(caller(new Request("https://x.test")), "ip:unknown");
});
