import assert from "node:assert/strict";
import test from "node:test";
import { pickUrl, readPick, safeReturn, withReturn } from "./handoff";

test("only paths on this site can be returned to", () => {
  assert.equal(safeReturn("/recreate"), "/recreate");
  assert.equal(safeReturn("/board/abc/cut?b=main"), "/board/abc/cut?b=main");
  for (const bad of ["https://evil.test/x", "//evil.test", "javascript:alert(1)", "/\\evil.test", "", null, undefined, "recreate", "/a\nb"]) assert.equal(safeReturn(bad as string), null, String(bad));
});

test("a builder link remembers where you were and what to call it", () => {
  const href = withReturn("/characters", "/series?format=pov", "your series");
  const u = new URL(href, "http://x");
  assert.equal(u.pathname, "/characters");
  assert.equal(u.searchParams.get("return"), "/series?format=pov");
  assert.equal(u.searchParams.get("label"), "your series");
  assert.equal(withReturn("/characters", "https://evil.test", "x"), "/characters");
});

test("the way back carries what you made, and the page reads it", () => {
  const url = pickUrl("/series?format=pov", "character", "ellis-52");
  assert.equal(url, "/series?format=pov&pick=character%3Aellis-52");
  assert.deepEqual(readPick(url.slice(url.indexOf("?"))), { kind: "character", id: "ellis-52" });
  assert.throws(() => pickUrl("https://evil.test", "place", "x"), /nowhere/);
});

test("a pick that isn't one is ignored", () => {
  assert.equal(readPick("?pick=character:../../x"), null);
  assert.equal(readPick("?pick=weapon:1"), null);
  assert.equal(readPick(""), null);
});

test("an accessory can be picked too", () => {
  assert.deepEqual(readPick("?pick=accessory:abc-1"), { kind: "accessory", id: "abc-1" });
  assert.equal(pickUrl("/comic", "accessory", "abc-1"), "/comic?pick=accessory%3Aabc-1");
});
