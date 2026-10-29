import assert from "node:assert/strict";
import { test } from "node:test";

import { codeEditRequest, codeFixRequest, codeIdeaRequest, forRewrite, mcpCodeAsk, progressOf, readCodeReply } from "./code";
import { KIT_SOURCE, THREE_URL, srcdoc } from "./kit";
import { CODE_LIMITS, SpecError, bare, forArt, keepMadeArt, readSpec, ruleChips, slotsOf, withArt, type CodeSpec } from "./spec";

const manifest = {
  title: "Comet Courier",
  pitch: "Dodge comets and deliver parcels across the belt.",
  genre: "Shooter",
  controls: "Arrows to fly, Space to fire",
  aspect: "16:9",
  touch: "pad",
  palette: { sky: "#05070f", ground: "#141a2e", accent: "#ffcc33", text: "#ffffff" },
  assets: [
    { id: "ship", label: "Ship", kind: "sprite", prompt: "a small courier spaceship", color: "#ffcc33", shape: "triangle" },
    { id: "comet", label: "Comet", kind: "sprite", prompt: "a fiery comet", color: "#ff5533", shape: "circle" },
    { id: "space", label: "Space", kind: "background", prompt: "a starfield", color: "#05070f", shape: "square" },
  ],
  said: "Made Comet Courier.",
};
const GAME = "let x = HAGGS.W / 2;\nHAGGS.start({ update(dt) { x += HAGGS.axis().x * 200 * dt; }, draw() { HAGGS.draw('ship', x, 300, 64, 64); } });";
const reply = (m: object = manifest, code = GAME) => `<manifest>\n${JSON.stringify(m)}\n</manifest>\n<game>\n${code}\n</game>`;

test("a finished reply becomes a code game, with its assets as art slots", () => {
  const { spec, said } = readCodeReply(reply(), { three: false });
  assert.equal(spec.template, "code");
  assert.equal(spec.title, "Comet Courier");
  assert.equal(spec.code, GAME);
  assert.equal(said, "Made Comet Courier.");
  assert.deepEqual(slotsOf(spec).map((s) => [s.key, s.kind]), [["assets.ship", "sprite"], ["assets.comet", "sprite"], ["assets.space", "background"]]);
  assert.deepEqual(ruleChips(spec), ["Shooter", "2D", "16:9", "3 assets"]);
});

test("code fences inside the parts are taken off, and a cut-off or broken reply says why", () => {
  const fenced = `<manifest>\n\`\`\`json\n${JSON.stringify(manifest)}\n\`\`\`\n</manifest>\n<game>\n\`\`\`js\n${GAME}\n\`\`\`\n</game>`;
  assert.equal(readCodeReply(fenced, { three: false }).spec.code, GAME);
  assert.throws(() => readCodeReply(`<manifest>${JSON.stringify(manifest)}</manifest>\n<game>\nlet half =`, { three: false }), /ran out of room/);
  assert.throws(() => readCodeReply("Sure! Here's a game.", { three: false }), /no manifest/);
  assert.throws(() => readCodeReply("<manifest>{not json</manifest><game>x</game>", { three: false }), /couldn't be read/);
  assert.throws(() => readCodeReply(reply(manifest, "   "), { three: false }), /empty game/);
});

test("assets are limited, named safely and never repeated; code that is too long is refused", () => {
  const many = { ...manifest, assets: [...Array.from({ length: 40 }, (_, i) => ({ id: `a${i}`, prompt: "x" })), { id: "Bad Id" }, { id: "a1", prompt: "again" }] };
  const spec = readCodeReply(reply(many), { three: false }).spec;
  assert.equal(spec.art.assets.length, CODE_LIMITS.assets);
  assert.ok(spec.art.assets.every((a) => /^[a-z][a-z0-9_-]*$/.test(a.id)));
  assert.equal(new Set(spec.art.assets.map((a) => a.id)).size, spec.art.assets.length);
  assert.throws(() => readSpec({ template: "code", code: "x".repeat(CODE_LIMITS.code + 1) }), SpecError);
  assert.equal((readSpec({ template: "code", aspect: "21:9", touch: "wiggle" }) as CodeSpec).aspect, "16:9");
});

test("an edit keeps made art on assets whose id and prompt are unchanged; pricing sends no code", () => {
  const first = readCodeReply(reply(), { three: false }).spec;
  const made = withArt(withArt(first, "assets.ship", { url: "https://blob.test/ship.png" }), "assets.comet", { url: "https://blob.test/comet.png" });
  const changed = { ...manifest, assets: [manifest.assets[0], { ...manifest.assets[1], prompt: "an icy comet" }, manifest.assets[2]] };
  const next = readCodeReply(reply(changed, GAME + "\n// faster"), { three: false, before: made as CodeSpec }).spec;
  const art = Object.fromEntries(slotsOf(next).map((s) => [s.key, s.art.url]));
  assert.equal(art["assets.ship"], "https://blob.test/ship.png");
  assert.equal(art["assets.comet"], undefined);
  const light = forArt(made) as CodeSpec;
  assert.equal(light.code, "");
  assert.doesNotMatch(JSON.stringify(light), /blob\.test/);
  assert.equal((bare(made) as CodeSpec).code, GAME);
  assert.deepEqual(keepMadeArt(made, made), made);
});

test("requests: references become named assets, 3D changes the guide, edits and fixes carry the code without links", () => {
  const idea = codeIdeaRequest({ idea: "a comet courier", genre: "Shooter", three: true, references: [{ id: "ref-ana", label: "Ana" }] });
  assert.match(idea.user, /"ref-ana" \(Ana\)/);
  assert.match(idea.user, /Genre: Shooter/);
  assert.match(idea.system, /three\.js/);
  assert.match(codeIdeaRequest({ idea: "a comet courier" }).system, /Never use THREE/);
  assert.throws(() => codeIdeaRequest({ idea: "hi" }), /few words/);
  const made = withArt(readCodeReply(reply(), { three: false }).spec, "assets.ship", { url: "https://blob.test/ship.png" }) as CodeSpec;
  assert.doesNotMatch(forRewrite(made), /blob\.test/);
  assert.match(codeEditRequest(made, "make it harder").user, /HAGGS\.start/);
  assert.match(codeFixRequest(made, "x is not defined").user, /x is not defined/);
  assert.match(mcpCodeAsk({ idea: "a comet courier", three: true }), /code: true and 3d: true/);
});

test("progress counts the game's lines as they stream", () => {
  assert.deepEqual(progressOf("<manifest>{}"), { lines: 0, inGame: false });
  assert.deepEqual(progressOf("<manifest>{}</manifest>\n<game>\na\nb\n"), { lines: 3, inGame: true });
});

test("the frame page is locked down: no network, no same origin, nothing can close the script early", () => {
  const spec = readCodeReply(reply(manifest, "const s = '</script><img src=x onerror=alert(1)>';\n" + GAME), { three: false }).spec;
  const page = srcdoc({ ...spec, title: "<b>Hi</b>" }, { ship: "data:image/png;base64,AAAA" }, ["https://*.public.blob.vercel-storage.com", "javascript:alert(1)"]);
  assert.match(page, /Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline';/);
  assert.match(page, /img-src data: blob: https:\/\/\*\.public\.blob\.vercel-storage\.com;/);
  assert.doesNotMatch(page, /javascript:alert/);
  assert.doesNotMatch(page, /allow-same-origin|connect-src [^']/);
  assert.equal(page.split("</script>").length - 1, 3, "only the config, kit and game scripts close");
  assert.match(page, /&lt;b&gt;Hi&lt;\/b&gt;/);
  assert.match(page, /data:image\/png;base64,AAAA/);
  assert.doesNotMatch(page, /jsdelivr/);
  const three = srcdoc({ ...spec, three: true }, {});
  assert.ok(three.includes(THREE_URL));
  assert.match(three, /script-src 'unsafe-inline' https:\/\/cdn\.jsdelivr\.net;/);
});

test("the kit parses, and so does a game script inside its wrapper", () => {
  assert.doesNotThrow(() => new Function(KIT_SOURCE));
  assert.doesNotThrow(() => new Function("HAGGS", "THREE", GAME));
});
