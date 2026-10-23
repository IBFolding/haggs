import assert from "node:assert/strict";
import test from "node:test";
import { angleName, characterLine, hooks, locked, mixCheck, moodRight, scorePrompt, sideOf } from "./labs";

test("a prompt that names the subject, place, light and camera scores full marks", () => {
  const s = scorePrompt("A fisherman mends a net on a wooden pier at golden dusk, slow push-in on his hands.");
  assert.equal(s.score, 100);
  assert.deepEqual(s.tips, []);
});

test("a vague prompt scores low and says what is missing", () => {
  const s = scorePrompt("a beautiful epic shot");
  assert.ok(s.score < 40, String(s.score));
  assert.ok(s.tips.some((t) => /light/i.test(t)) && s.tips.some((t) => /camera/i.test(t)) && s.tips.some((t) => /beautiful/i.test(t)));
});

test("each missing part costs 25 and filler words cost more", () => {
  assert.equal(scorePrompt("A fisherman mends a net on a wooden pier").score, 50);
  assert.equal(scorePrompt("A fisherman mends a net on a wooden pier, nice").score, 40);
});

test("the right camera move for a mood is judged, and there can be more than one", () => {
  assert.equal(moodRight("quiet", "push"), true);
  assert.equal(moodRight("quiet", "orbit"), false);
  assert.equal(moodRight("lonely", "still"), true);
  assert.equal(moodRight("nope", "push"), false);
});

test("the camera's place is named from its angle and distance", () => {
  assert.equal(angleName(0, 0.2).name, "Close-up");
  assert.equal(angleName(0, 0.9).name, "Wide shot");
  assert.equal(angleName(180, 0.5).name, "Reverse");
  assert.equal(angleName(90, 0.5).name, "Profile");
  assert.equal(angleName(-90, 0.2).name, "Close profile");
  assert.equal(angleName(540, 0.5).at, "behind");
});

test("a character is locked once five traits are chosen, and the line carries them", () => {
  const picks = { hair: "short grey wavy", face: "square jaw, short beard", eyes: "hazel", age: "fifties", wear: "a camel overcoat" };
  assert.equal(locked(picks), true);
  assert.equal(locked({ hair: "short grey wavy" }), false);
  assert.match(characterLine("Ellis", picks), /^Ellis: short grey wavy, .*a camel overcoat\. Keep this person exactly the same/);
});

test("the side of a place you are looking from", () => {
  assert.deepEqual([0, 90, 180, 270, 350].map(sideOf), ["front", "right", "back", "left", "front"]);
});

test("hooks are made from the topic", () => {
  assert.equal(hooks("morning routines")[0], "Nobody tells you this about morning routines.");
  assert.equal(hooks("").length, 5);
});

test("a mix is right when the words sit over the music and effects sit under the words", () => {
  assert.equal(mixCheck({ voice: -6, music: -18, fx: -12 }).ok, true);
  assert.match(mixCheck({ voice: -6, music: -8, fx: -12 }).notes[0]!, /too close/);
  assert.match(mixCheck({ voice: -12, music: -20, fx: -6 }).notes.join(" "), /effect is louder/);
  assert.match(mixCheck({ voice: -6, music: -30, fx: -12 }).notes[0]!, /disappeared/);
  assert.match(mixCheck({ voice: 0, music: -12, fx: -20 }).notes.join(" "), /near the top/);
});
