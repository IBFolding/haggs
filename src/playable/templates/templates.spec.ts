import assert from "node:assert/strict";
import { test } from "node:test";

import { defaultSpec, readSpec, type CollectorSpec, type MatchSpec, type RunnerSpec } from "../spec";
import { initCollector, stepCollector } from "./collector";
import { hudOf, initGame, stepGame } from "./index";
import { deal, findMove, findRuns, initMatch, points, swapTiles, tapCell, type Grid } from "./match";
import { GROUND, PX_PER_M, initRunner, jumpReach, metres, stepRunner } from "./runner";

const DT = 1 / 60;

const runner = (rules: Partial<RunnerSpec["rules"]> = {}) => readSpec({ ...defaultSpec("runner"), rules: { ...(defaultSpec("runner") as RunnerSpec).rules, ...rules } }) as RunnerSpec;
const collector = (rules: Partial<CollectorSpec["rules"]> = {}) => readSpec({ ...defaultSpec("collector"), rules: { ...(defaultSpec("collector") as CollectorSpec).rules, ...rules } }) as CollectorSpec;
const match = (rules: Partial<MatchSpec["rules"]> = {}) => readSpec({ ...defaultSpec("match"), rules: { ...(defaultSpec("match") as MatchSpec).rules, ...rules } }) as MatchSpec;

// ─── runner ─────────────────────────────────────────────────────────────

test("runner: a jump is an edge, and the runner lands back on the ground", () => {
  const spec = runner();
  const s = initRunner(spec, 1);
  stepRunner(spec, s, { action: true }, DT);
  assert.ok(s.player.vy < 0, "jumped");
  for (let i = 0; i < 120; i++) stepRunner(spec, s, { action: true }, DT);
  assert.equal(s.player.grounded, true);
  assert.equal(s.player.y, GROUND - s.player.h);
  const before = s.player.vy;
  stepRunner(spec, s, { action: true }, DT);
  assert.equal(s.player.vy, before, "holding doesn't bounce");
});

test("runner: standing still into hazards loses every life", () => {
  const spec = runner({ lives: 2 });
  const s = initRunner(spec, 7);
  for (let i = 0; i < 60 * 60 && s.status === "playing"; i++) stepRunner(spec, s, {}, DT);
  assert.equal(s.status, "lost");
  assert.equal(s.lives, 0);
});

test("runner: jumping each hazard in time reaches the distance goal", () => {
  for (const rules of [{}, { speed: 700, spawnEvery: 0.7 }, { speed: 150, jump: 480, gravity: 3200 }, { speed: 150, jump: 480, gravity: 900 }, { speed: 700, jump: 1150, gravity: 900 }] as Partial<RunnerSpec["rules"]>[]) {
    const spec = runner({ ...rules, target: 60, lives: 1 });
    const s = initRunner(spec, 3);
    const reach = jumpReach(spec);
    for (let i = 0; i < 60 * 120 && s.status === "playing"; i++) {
      // Leave the ground so the top of the arc sits over the hazard's middle.
      const lead = (reach.across - s.player.w) / 2;
      const next = s.hazards.find((h) => h.x + h.w / 2 > s.player.x + s.player.w / 2);
      const jump = Boolean(next && next.x + next.w / 2 - (s.player.x + s.player.w / 2) < lead && s.player.grounded && !s.held);
      stepRunner(spec, s, { action: jump }, DT);
    }
    assert.equal(s.status, "won", `cleared with ${JSON.stringify(rules)}`);
    assert.ok(metres(s) >= 60);
  }
});

test("runner: hazards are never taller than the jump clears", () => {
  const spec = runner({ jump: 480, gravity: 3200 });
  const s = initRunner(spec, 11);
  for (let i = 0; i < 60 * 30; i++) {
    s.safe = 99;
    stepRunner(spec, s, {}, DT);
    for (const h of s.hazards) assert.ok(h.h <= jumpReach(spec).height * 0.7 + 1e-9);
  }
});

test("runner: the score goal counts pickups", () => {
  const spec = runner({ goal: "score", target: 5 });
  const s = initRunner(spec, 5);
  s.pickups.push(...Array.from({ length: 5 }, (_, i) => ({ x: s.player.x + i, y: s.player.y, w: 28, h: 28, taken: false })));
  stepRunner(spec, s, {}, DT);
  assert.equal(s.score, 5);
  assert.equal(s.status, "won");
});

test("runner: the same seed plays the same game", () => {
  const spec = runner();
  const a = initRunner(spec, 42);
  const b = initRunner(spec, 42);
  for (let i = 0; i < 600; i++) {
    stepRunner(spec, a, { action: i % 50 === 0 }, DT);
    stepRunner(spec, b, { action: i % 50 === 0 }, DT);
  }
  assert.deepEqual(a, b);
  assert.equal(PX_PER_M, 40);
});

// ─── collector ──────────────────────────────────────────────────────────

test("collector: walking onto each pickup wins before the clock", () => {
  const spec = collector({ hazards: 0, target: 6 });
  const s = initCollector(spec, 9);
  for (let i = 0; i < 60 * 60 && s.status === "playing"; i++) stepCollector(spec, s, { point: s.pickups[0]! }, DT);
  assert.equal(s.status, "won");
  assert.equal(s.score, 6);
});

test("collector: running out of time loses", () => {
  const spec = collector({ hazards: 0, seconds: 15 });
  const s = initCollector(spec, 2);
  for (let i = 0; i < 60 * 16 && s.status === "playing"; i++) stepCollector(spec, s, {}, DT);
  assert.equal(s.status, "lost");
  assert.deepEqual(hudOf(spec, s), [`0 / ${spec.rules.target}`, "0s", "♥♥♥"]);
});

test("collector: a hazard costs a life, then a moment of safety", () => {
  const spec = collector({ hazards: 1, lives: 2 });
  const s = initCollector(spec, 4);
  s.safe = 0;
  s.hazards[0] = { x: s.player.x, y: s.player.y, r: 18, vx: 0, vy: 0 };
  stepCollector(spec, s, {}, DT);
  assert.equal(s.lives, 1);
  stepCollector(spec, s, {}, DT);
  assert.equal(s.lives, 1, "safe right after a hit");
  s.safe = 0;
  stepCollector(spec, s, {}, DT);
  assert.equal(s.status, "lost");
});

test("collector: hazards bounce and stay inside the arena; the player too", () => {
  const spec = collector({ hazards: 8, hazardSpeed: 360 });
  const s = initCollector(spec, 8);
  for (let i = 0; i < 60 * 10; i++) {
    s.safe = 99;
    stepCollector(spec, s, { left: true, up: true }, DT);
    for (const h of s.hazards) assert.ok(h.x >= h.r && h.x <= 800 - h.r && h.y >= h.r && h.y <= 450 - h.r);
  }
  assert.equal(s.player.x, s.player.r);
  assert.equal(s.player.y, s.player.r);
});

// ─── match ──────────────────────────────────────────────────────────────

test("match: runs are found across and down, and only runs of three", () => {
  const grid: Grid = [
    [0, 0, 0, 1],
    [1, 2, 1, 1],
    [1, 2, 0, 2],
    [2, 2, 0, 1],
  ];
  const cells = findRuns(grid).map(([r, c]) => `${r},${c}`).sort();
  assert.deepEqual(cells, ["0,0", "0,1", "0,2", "1,1", "2,1", "3,1"]);
  assert.deepEqual(findRuns([[0, 1, 0], [1, 0, 1], [0, 1, 0]]), []);
});

test("match: a dealt board has no runs and at least one move, for every size", () => {
  for (let kinds = 3; kinds <= 6; kinds++) {
    for (const [rows, cols] of [[5, 5], [9, 8]]) {
      const grid = deal({ seed: kinds * 100 + rows! }, rows!, cols!, kinds);
      assert.equal(findRuns(grid).length, 0);
      assert.ok(findMove(grid));
      assert.ok(grid.flat().every((k) => k >= 0 && k < kinds));
    }
  }
});

test("match: a swap that lines nothing up is undone and costs nothing", () => {
  const spec = match();
  const s = initMatch(spec, 1);
  s.grid = [
    [0, 1, 2, 3, 4, 0, 1],
    [1, 2, 3, 4, 0, 1, 2],
    [2, 3, 4, 0, 1, 2, 3],
    [3, 4, 0, 1, 2, 3, 4],
    [4, 0, 1, 2, 3, 4, 0],
    [0, 1, 2, 3, 4, 0, 1],
    [1, 2, 3, 4, 0, 1, 2],
  ];
  const before = structuredClone(s.grid);
  assert.deepEqual(swapTiles(spec, s, [0, 0], [0, 1]), { ok: false, cleared: 0, chains: 0 });
  assert.deepEqual(s.grid, before);
  assert.equal(s.moves, spec.rules.moves);
  assert.equal(swapTiles(spec, s, [0, 0], [2, 0]).ok, false, "not neighbours");
  assert.equal(swapTiles(spec, s, [0, 0], [-1, 0]).ok, false, "off the board");
});

test("match: a good swap clears, scores, drops, refills and spends a move", () => {
  const spec = match();
  const s = initMatch(spec, 3);
  const move = findMove(s.grid)!;
  const result = swapTiles(spec, s, move[0], move[1]);
  assert.equal(result.ok, true);
  assert.ok(result.cleared >= 3);
  assert.ok(s.score >= points(3, 1));
  assert.equal(s.moves, spec.rules.moves - 1);
  assert.equal(findRuns(s.grid).length, 0, "nothing left lined up");
  assert.ok(s.grid.flat().every((k) => k >= 0 && k < spec.rules.kinds), "every hole refilled");
  assert.ok(findMove(s.grid), "never left stuck");
});

test("match: playing the first move found reaches a win or runs out of moves", () => {
  const easy = match({ target: 100, moves: 30 });
  const s = initMatch(easy, 5);
  while (s.status === "playing") {
    const m = findMove(s.grid)!;
    assert.ok(swapTiles(easy, s, m[0], m[1]).ok);
  }
  assert.equal(s.status, "won");

  const hard = match({ target: 20000, moves: 5 });
  const h = initMatch(hard, 5);
  while (h.status === "playing") {
    const m = findMove(h.grid)!;
    swapTiles(hard, h, m[0], m[1]);
  }
  assert.equal(h.status, "lost");
  assert.equal(h.moves, 0);
});

test("match: taps select, reselect, deselect and swap neighbours", () => {
  const spec = match();
  const s = initMatch(spec, 8);
  assert.equal(tapCell(spec, s, [0, 0]), null);
  assert.deepEqual(s.selected, [0, 0]);
  tapCell(spec, s, [0, 0]);
  assert.equal(s.selected, null);
  tapCell(spec, s, [0, 0]);
  tapCell(spec, s, [3, 3]);
  assert.deepEqual(s.selected, [3, 3], "far tap moves the selection");
  const [a, b] = findMove(s.grid)!;
  s.selected = null;
  tapCell(spec, s, a);
  assert.equal(tapCell(spec, s, b)?.ok, true);
  assert.equal(s.selected, null);
});

// ─── shared ─────────────────────────────────────────────────────────────

test("a game started for one template restarts when the spec's template changes", () => {
  const state = initGame(defaultSpec("runner"), 1);
  const next = stepGame(defaultSpec("match"), state, {}, DT);
  assert.equal(next.template, "match");
  assert.equal(hudOf(defaultSpec("runner"), next).length, 0);
});
