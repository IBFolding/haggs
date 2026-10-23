import assert from "node:assert/strict";
import test from "node:test";
import { buildCut } from "./cut";
import { fcpxml, tc } from "./fcpxml";
import { newShot, type Project } from "./model";

const take = (url: string) => ({ url, kind: "video" as const, usd: 0, promptHash: "", at: 1 });
function project(): Project {
  return {
    id: "p", name: "Night & Day", notes: [],
    shots: [
      { ...newShot(), heading: "Door", seconds: 4, render: take("/api/local/a.mp4"), voices: [{ id: "v1", text: "Tell me what I missed", speaker: "A", voice: "x", url: "/api/local/v1.mp3", offset: 1 }] },
      { ...newShot(), heading: "Hall", seconds: 3, trimIn: 2, render: take("/api/local/b.mp4") },
    ],
    music: { url: "/api/local/m.mp3", name: "Score", gain: -8 },
    effects: [{ id: "e", name: "door", url: "/api/local/e.mp3", start: 5, gain: -3, seconds: 1.5 }],
    overlays: [{ id: "o", name: "ELLIS", url: "/api/local/t.png", start: 0.5, seconds: 2 }],
  } as unknown as Project;
}

test("times are whole frames at 30 fps", () => {
  assert.equal(tc(0), "0/30s");
  assert.equal(tc(1.5), "45/30s");
  assert.equal(tc(1 / 3), "10/30s");
});

test("the picture is on the spine in order, trimmed where the footage starts later", () => {
  const xml = fcpxml(buildCut(project()), "Night & Day", { origin: "http://localhost:3111" });
  assert.match(xml, /<fcpxml version="1\.10">/);
  assert.match(xml, /<format id="r1" name="FFVideoFormat1080p30" frameDuration="1\/30s" width="1920" height="1080"/);
  assert.match(xml, /<project name="Night &amp; Day">/);
  assert.match(xml, /offset="0\/30s" name="Door" start="0\/30s" duration="120\/30s"/);
  assert.match(xml, /offset="120\/30s" name="Hall" start="60\/30s" duration="90\/30s"/);
  assert.match(xml, /src="http:\/\/localhost:3111\/api\/local\/a\.mp4"/);
});

test("voice, effects, music and titles are connected on their own lanes, in the time of the clip they sit on", () => {
  const xml = fcpxml(buildCut(project()), "x");
  assert.match(xml, /lane="-1" offset="30\/30s" name="Tell me what I missed"/);
  assert.match(xml, /lane="-2" offset="\d+\/30s" name="door"[^>]*>\s*<adjust-volume amount="-3dB"/);
  assert.match(xml, /lane="-3" offset="0\/30s" name="Score"/);
  assert.match(xml, /lane="1" offset="15\/30s" name="ELLIS"/);
  // The effect at 5s sits on the second clip (starts at 4s, footage from 2s): 2 + 1 = 3s in.
  assert.match(xml, /lane="-2" offset="90\/30s"/);
});

test("markers land on the clip they are in, in the clip's own time; muted tracks are left out", () => {
  const p = project();
  p.sound = { voiceMute: true, musicMute: true };
  const xml = fcpxml(buildCut(p), "x", { markers: [{ id: "m", at: 5, text: "Cut here" }] });
  assert.match(xml, /<marker start="90\/30s" duration="1\/30s" value="Cut here"\/>/);
  assert.doesNotMatch(xml, /lane="-1"|lane="-3"/);
});

test("an empty cut is refused, and a vertical cut is 1080 by 1920", () => {
  assert.throws(() => fcpxml({ clips: [], total: 0, voices: [], music: null, aspect: "16:9", skipped: [] }, "x"), /nothing to export/);
  const p = project();
  p.aspect = "9:16";
  assert.match(fcpxml(buildCut(p), "x"), /width="1080" height="1920"/);
});
