import assert from "node:assert/strict";
import { it } from "node:test";

import { createProject, newShot } from "./model";
import { soundsInProjects } from "./sound-backfill";

it("finds the voice lines, effects and music a project already holds, once each", () => {
  const p = createProject("Moss & Marlow");
  const shot = { ...newShot(), voices: [{ id: "v1", url: "/api/local/v1.mp3", text: "Marlow has a plan.", speaker: "Marlow", voice: "Laura", offset: 0 }, { id: "v2", url: "", text: "not spoken yet", speaker: "A", voice: "Laura", offset: 0 }] };
  const full = { ...p, shots: [shot], effects: [{ id: "e1", name: "Rain on tin", url: "/api/local/rain.mp3", start: 0, gain: 0, seconds: 3 }, { id: "e2", name: "Rain again", url: "/api/local/rain.mp3", start: 2, gain: 0, seconds: 3 }], music: { url: "/api/local/score.mp3", name: "Theme", gain: -6 } };
  const found = soundsInProjects([full]);
  assert.deepEqual(found.map((r) => r.url).sort(), ["/api/local/rain.mp3", "/api/local/score.mp3", "/api/local/v1.mp3"]);
  assert.ok(found.every((r) => r.kind === "audio" && r.usd === null));
  assert.equal(found.find((r) => r.url.endsWith("v1.mp3"))!.prompt, "Marlow has a plan.");
  assert.equal(found.find((r) => r.url.endsWith("rain.mp3"))!.modelName, "Sound effect");
  assert.match(found.find((r) => r.url.endsWith("score.mp3"))!.modelName, /music/i);
});

it("looks in every board, not just the one on screen", () => {
  const p = createProject("Two boards");
  const withBoards = { ...p, boards: [{ id: "a", name: "A", kind: "board" as const, shots: [{ ...newShot(), voices: [{ id: "v", url: "/api/local/a.mp3", text: "Line A", speaker: "A", voice: "Laura", offset: 0 }] }], notes: [] }, { id: "b", name: "B", kind: "board" as const, shots: [{ ...newShot(), voices: [{ id: "w", url: "/api/local/b.mp3", text: "Line B", speaker: "B", voice: "Laura", offset: 0 }] }], notes: [] }] };
  assert.deepEqual(soundsInProjects([withBoards]).map((r) => r.url).sort(), ["/api/local/a.mp3", "/api/local/b.mp3"]);
});
