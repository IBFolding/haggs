import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { airLayout, airTile } from "./grey-air";

const frame = { w: 1080, h: 1920 };

describe("air", () => {
  it("draws the same tile every time for the same seed, and more of it for a bigger amount", () => {
    assert.equal(airTile("rain", frame, 0.5, 7), airTile("rain", frame, 0.5, 7));
    assert.notEqual(airTile("rain", frame, 0.5, 7), airTile("rain", frame, 0.5, 8));
    const count = (svg: string) => (svg.match(/<line /g) ?? []).length;
    assert.ok(count(airTile("rain", frame, 1, 1)) > count(airTile("rain", frame, 0.2, 1)) * 3);
  });

  it("repeats what crosses the edge, so a tile joins itself and nothing jumps as it scrolls", () => {
    const svg = airTile("snow", { w: 400, h: 400 }, 1, 3);
    const circles = [...svg.matchAll(/<circle cx="([\d.]+)" cy="([\d.]+)" r="([\d.]+)"/g)].map((m) => ({ y: Number(m[2]), r: Number(m[3]) }));
    assert.ok(circles.some((c) => c.y < 0 || c.y > 400), "a flake near the bottom is drawn again above the top");
  });

  it("each kind scrolls the way it moves in the world: rain and snow fall, embers rise, fog and beams drift", () => {
    assert.equal(airLayout("rain", frame).axis, "down");
    assert.equal(airLayout("snow", frame).axis, "down");
    assert.equal(airLayout("embers", frame).axis, "up");
    assert.equal(airLayout("fog", frame).axis, "across");
    assert.equal(airLayout("beams", frame).axis, "across");
    assert.ok(airLayout("rain", frame).speed > airLayout("snow", frame).speed * 5, "rain is much faster than snow");
  });
});
