import assert from "node:assert/strict";
import { test } from "node:test";

import { FEATURED } from "./featured";
import { KIT_SOURCE } from "./kit";
import { readSpec, type MatchSpec, type RunnerSpec } from "./spec";
import { findMove, initMatch, swapTiles } from "./templates/match";
import { initRunner, jumpReach, metres, stepRunner } from "./templates/runner";

const DT = 1 / 60;

test("every featured game reads back unchanged, with its own id and title", () => {
  for (const f of FEATURED) assert.deepEqual(readSpec(f.spec), f.spec, f.id);
  assert.equal(new Set(FEATURED.map((f) => f.id)).size, FEATURED.length);
  assert.equal(new Set(FEATURED.map((f) => f.spec.title)).size, FEATURED.length);
  assert.ok(FEATURED.every((f) => /^[a-z-]+$/.test(f.id)));
});

/** Jumps each hazard so the top of the arc sits over its middle; returns the state after `seconds`. */
function runBot(spec: RunnerSpec, seconds: number) {
  const s = initRunner(spec, 4);
  const reach = jumpReach(spec);
  for (let i = 0; i < seconds / DT && s.status === "playing"; i++) {
    const lead = (reach.across - s.player.w) / 2;
    const next = s.hazards.find((h) => h.x + h.w / 2 > s.player.x + s.player.w / 2);
    const jump = Boolean(next && next.x + next.w / 2 - (s.player.x + s.player.w / 2) < lead && s.player.grounded && !s.held);
    stepRunner(spec, s, { action: jump }, DT);
  }
  return s;
}

test("featured runners can be played through without losing", () => {
  for (const f of FEATURED) {
    if (f.spec.template !== "runner") continue;
    const s = runBot(f.spec, 120);
    assert.notEqual(s.status, "lost", f.id);
    if (f.spec.rules.goal === "distance") {
      assert.equal(s.status, "won", f.id);
      assert.ok(metres(s) >= f.spec.rules.target);
    }
  }
});

test("featured match games can be won by playing the first move found", () => {
  for (const f of FEATURED) {
    if (f.spec.template !== "match") continue;
    const spec = f.spec as MatchSpec;
    const wins = [1, 2, 3, 4, 5].filter((seed) => {
      const s = initMatch(spec, seed);
      while (s.status === "playing") swapTiles(spec, s, ...findMove(s.grid)!);
      return s.status === "won";
    });
    // Not every deal is won by a bot that never plans ahead, but most should be.
    assert.ok(wins.length >= 3, `${f.id} won ${wins.length} of 5`);
  }
});

test("featured code games carry an emoji for every asset, and their scripts parse", () => {
  const written = FEATURED.filter((f) => f.spec.template === "code");
  assert.ok(written.length >= 3);
  for (const f of written) {
    const spec = f.spec;
    if (spec.template !== "code") continue;
    assert.ok(spec.art.assets.every((a) => a.emoji), f.id);
    assert.doesNotThrow(() => new Function("HAGGS", "THREE", spec.code), f.id);
    for (const id of spec.code.matchAll(/HAGGS\.(?:draw|texture|img)\("([a-z0-9_-]+)"/g)) assert.ok(spec.art.assets.some((a) => a.id === id[1]), `${f.id} draws ${id[1]}, which is in its manifest`);
  }
  assert.doesNotThrow(() => new Function(KIT_SOURCE));
});

test("every featured cover points at a picture that is in public/", async () => {
  const { existsSync } = await import("node:fs");
  for (const f of FEATURED) if (f.cover) assert.ok(existsSync(`public${f.cover}`), f.cover);
  assert.ok(FEATURED.every((f) => f.cover), "every featured game has a cover");
});
