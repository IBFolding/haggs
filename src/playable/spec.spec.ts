import assert from "node:assert/strict";
import { test } from "node:test";

import { MIN_JUMP, RANGES, SpecError, bare, keepMadeArt, TEMPLATES, defaultSpec, readSpec, ruleChips, slotsOf, withArt, type GameSpec, type TemplateSpec } from "./spec";

test("every default spec reads back unchanged", () => {
  for (const t of TEMPLATES) assert.deepEqual(readSpec(defaultSpec(t)), defaultSpec(t));
});

test("a spec without a known template is refused with the reason", () => {
  assert.throws(() => readSpec(null), SpecError);
  assert.throws(() => readSpec({ title: "x" }), /needs a template/);
  assert.throws(() => readSpec({ template: "shooter" }), /runner, collector, match/);
});

test("numbers are clamped into the playable range, and whole numbers stay whole", () => {
  const spec = readSpec({ template: "runner", rules: { speed: 99999, gravity: -5, lives: 2.6, spawnEvery: 0.01, goal: "score", target: 3 } });
  assert.equal(spec.template, "runner");
  if (spec.template !== "runner") return;
  assert.equal(spec.rules.speed, RANGES.runner.speed[1]);
  assert.equal(spec.rules.gravity, RANGES.runner.gravity[0]);
  assert.equal(spec.rules.lives, 3);
  assert.equal(spec.rules.spawnEvery, RANGES.runner.spawnEvery[0]);
  assert.equal(spec.rules.goal, "score");
  assert.equal(spec.rules.target, RANGES.runner.target[0]);
});

test("missing and wrong-typed fields fall back to the template's defaults", () => {
  const base = defaultSpec("collector");
  const spec = readSpec({ template: "collector", title: "   ", palette: { sky: "blue", accent: "#ABCDEF" }, rules: { hazards: "lots", seconds: null }, art: { player: { color: 7, shape: "hexagon" } } });
  assert.equal(spec.title, base.title);
  assert.equal(spec.palette.sky, base.palette.sky);
  assert.equal(spec.palette.accent, "#abcdef");
  if (spec.template !== "collector" || base.template !== "collector") return;
  assert.deepEqual(spec.rules, base.rules);
  assert.equal(spec.art.player.shape, base.art.player.shape);
  assert.equal(spec.art.player.color, base.art.player.color);
});

test("art keeps only https, the app's own media, and picture data URIs", () => {
  const read = (url: string) => {
    const spec = readSpec({ template: "runner", art: { player: { prompt: "p", color: "#ffffff", shape: "circle", url } } });
    return spec.template === "runner" ? spec.art.player.url : undefined;
  };
  assert.equal(read("https://blob.example.com/a.png"), "https://blob.example.com/a.png");
  assert.equal(read("/api/local/haggs-renders/a.png"), "/api/local/haggs-renders/a.png");
  assert.equal(read("data:image/png;base64,AAAA"), "data:image/png;base64,AAAA");
  assert.equal(read("javascript:alert(1)"), undefined);
  assert.equal(read("http://plain.example.com/a.png"), undefined);
  assert.equal(read("data:text/html;base64,AAAA"), undefined);
  assert.equal(read('https://x.com/a.png" onerror="x'), undefined);
});

test("long words are cut to fit the cards", () => {
  const spec = readSpec({ template: "match", title: "x".repeat(500), text: { win: "y".repeat(500) } }) as TemplateSpec;
  assert.equal(spec.title.length, 60);
  assert.equal(spec.text.win.length, 120);
});

test("match tiles follow the number of kinds, borrowing default art when short", () => {
  const spec = readSpec({ template: "match", rules: { kinds: 6 }, art: { tiles: [{ prompt: "a coin", color: "#111111", shape: "circle" }] } });
  if (spec.template !== "match") return assert.fail();
  assert.equal(spec.art.tiles.length, 6);
  assert.equal(spec.art.tiles[0]!.prompt, "a coin");
  assert.equal(new Set(spec.art.tiles.map((t) => t.color)).size, 6, "six kinds, six colours");
  const three = readSpec({ ...spec, rules: { ...spec.rules, kinds: 3 } });
  assert.equal(three.template === "match" && three.art.tiles.length, 3);
});

test("slots list every piece of art, and withArt changes only the one named", () => {
  const runner = defaultSpec("runner");
  assert.deepEqual(slotsOf(runner).map((s) => s.key), ["player", "pickup", "hazard", "background"]);
  const match = defaultSpec("match");
  assert.deepEqual(slotsOf(match).map((s) => s.key), ["background", "tiles.0", "tiles.1", "tiles.2", "tiles.3", "tiles.4"]);

  const art = withArt(runner, "pickup", { url: "https://blob.example.com/p.png" }) as Extract<GameSpec, { template: "runner" }>;
  assert.equal(art.art.pickup.url, "https://blob.example.com/p.png");
  assert.equal(art.art.player.url, undefined);
  assert.equal((runner as typeof art).art.pickup.url, undefined, "the original is untouched");
  const cleared = withArt(art, "pickup", { url: undefined }) as typeof art;
  assert.equal("url" in cleared.art.pickup, false);

  const tile = withArt(match, "tiles.2", { prompt: "a pearl" });
  assert.equal(tile.template === "match" && tile.art.tiles[2]!.prompt, "a pearl");
  assert.deepEqual(withArt(match, "tiles.9", { prompt: "nothing" }), match);
  assert.deepEqual(withArt(runner, "nope", { prompt: "nothing" }), runner);
});

test("rule chips read in words", () => {
  assert.ok(ruleChips(defaultSpec("runner")).includes("Run 300 m"));
  assert.ok(ruleChips(defaultSpec("collector")).includes("Collect 12"));
  assert.ok(ruleChips(defaultSpec("match")).includes("7×7 grid"));
});

test("a runner's jump always clears the minimum, however the numbers combine", () => {
  for (const speed of [150, 400, 700]) for (const gravity of [900, 2000, 3200]) for (const jump of [480, 800, 1150]) {
    const spec = readSpec({ template: "runner", rules: { speed, gravity, jump } });
    if (spec.template !== "runner") return assert.fail();
    const { jump: j, gravity: g } = spec.rules;
    assert.ok((j * j) / (2 * g) >= MIN_JUMP.height - 1e-6, `high enough for ${speed}/${gravity}/${jump}`);
    assert.ok((speed * 2 * j) / g >= MIN_JUMP.across - 1, `far enough for ${speed}/${gravity}/${jump}`);
    assert.ok(j >= RANGES.runner.jump[0] && j <= RANGES.runner.jump[1] && g >= RANGES.runner.gravity[0] && g <= RANGES.runner.gravity[1]);
  }
});

test("bare drops every picture; keepMadeArt puts back the ones whose prompt is unchanged", () => {
  let made = withArt(defaultSpec("match"), "background", { url: "https://blob.example.com/bg.png" });
  made = withArt(made, "tiles.1", { url: "https://blob.example.com/t1.png" });
  const stripped = bare(made);
  assert.equal(JSON.stringify(stripped).includes("blob.example.com"), false);
  const edited = withArt(stripped, "tiles.1", { prompt: "a new tile" });
  const kept = keepMadeArt(made, edited);
  assert.equal(kept.template === "match" && kept.art.background.url, "https://blob.example.com/bg.png");
  assert.equal(kept.template === "match" && kept.art.tiles[1]!.url, undefined);
  assert.equal(kept.template === "match" && kept.art.tiles[1]!.prompt, "a new tile");
});

test("a picture to follow is kept when safe, dropped when not, and never sent to Claude or the server", () => {
  const ref = "https://blob.test/cast/ana.png";
  const spec = withArt(defaultSpec("runner"), "player", { ref, url: "https://blob.test/made.png" });
  assert.equal(slotsOf(readSpec(spec)).find((s) => s.key === "player")!.art.ref, ref);
  assert.equal(slotsOf(withArt(spec, "player", { ref: "javascript:alert(1)" })).find((s) => s.key === "player")!.art.ref, undefined);
  assert.equal(slotsOf(withArt(spec, "player", { ref: undefined })).find((s) => s.key === "player")!.art.ref, undefined);
  assert.doesNotMatch(JSON.stringify(bare(spec)), /blob\.test/);
});

test("an edit keeps each slot's picture to follow, even when its prompt changes", () => {
  const before = withArt(defaultSpec("collector"), "hazard", { ref: "/api/local/wasp.png" });
  const after = withArt(defaultSpec("collector"), "hazard", { prompt: "a grumpy hornet" });
  const kept = slotsOf(keepMadeArt(before, after)).find((s) => s.key === "hazard")!.art;
  assert.equal(kept.ref, "/api/local/wasp.png");
  assert.equal(kept.prompt, "a grumpy hornet");
});
