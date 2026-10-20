import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { parseScreenplay } from "../sheets/screenplay";
import { buildSheets, fixCell } from "../sheets/sheets";
import { applyFill, fillRequest } from "./fill";

const sample = readFileSync(new URL("../sheets/fixtures/sheets-sample.md", import.meta.url), "utf8");
const sheets = () => buildSheets([parseScreenplay(sample)], { title: "Lantern" });

test("the fill request carries how each lead and place first appears, leads first", () => {
  const r = fillRequest(sheets());
  assert.match(r.user, /MAYA \(3 lines/);
  assert.match(r.user, /MAYA \(19\) waits on the dock/);
  assert.match(r.user, /RIVER LANDING/);
  assert.ok(r.user.indexOf("MAYA") < r.user.indexOf("OTTO"), "the character with more lines comes first");
  assert.match(r.system, /identity lock/);
});

test("filling only writes empty fields, so nothing a person wrote is replaced", () => {
  const mine = fixCell(sheets(), "characters", "MAYA", "lock", "my own lock");
  const { sheets: filled, changed } = applyFill(mine, {
    characters: [
      { name: "Maya", look: "19, curly hair", wardrobe: "green raincoat", voice: "quick", lock: "AI lock" },
      { name: "Nobody", look: "x", wardrobe: "", voice: "", lock: "" },
    ],
    locations: [{ name: "River Landing", look: "wooden dock", light: "grey dawn", lock: "dock in fog" }],
  });
  const maya = filled.characters.find((c) => c.id === "MAYA")!;
  assert.equal(maya.lock, "my own lock");
  assert.equal(maya.look, "19, curly hair");
  assert.equal(filled.locations.find((l) => l.id === "RIVER LANDING")?.lock, "dock in fog");
  assert.ok(!filled.characters.some((c) => c.id === "NOBODY"), "fill never invents a character");
  assert.equal(changed, 6);
});
