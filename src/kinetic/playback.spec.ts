import assert from "node:assert/strict";
import { test } from "node:test";

import { layout, parseSheet } from "./beats";
import { clipAt, seekSeconds, syncClips, syncFilmClips } from "./playback";

test("a clip is seeked from the film clock with its zoom at the same instant", () => {
  const timeline = layout(parseSheet("bpm 120\nOPEN | 2\n@clip app | 4 | DEMO | zoom 0.8 0.2 2"));
  const first = clipAt(timeline, 1.75);
  assert.deepEqual(first, {
    name: "app",
    offsetSeconds: 0.75,
    zoom: { x: 0.8, y: 0.2, scale: 2 },
    beats: 1.5,
    totalBeats: 4,
  });
  assert.deepEqual(clipAt(timeline, 1.75), first, "seeking to the same time is deterministic");
  assert.equal(clipAt(timeline, 0.5), null);
  assert.equal(clipAt(timeline, 4), null);
});

test("preview seeks stay on a real frame inside the film", () => {
  const timeline = layout(parseSheet("bpm 120\nA | 2\nB | 2"));
  assert.equal(seekSeconds(timeline, -4), 0);
  assert.equal(seekSeconds(timeline, 0.75), 0.75);
  assert.ok(seekSeconds(timeline, 99) < timeline.totalSeconds);
  assert.equal(seekSeconds(timeline, Number.NaN), 0);
});

function fakeVideo(duration = 10) {
  return {
    currentTime: 0,
    duration,
    paused: true,
    plays: 0,
    pauses: 0,
    play() { this.plays++; this.paused = false; return Promise.resolve(); },
    pause() { this.pauses++; this.paused = true; },
  };
}

test("seeking pauses other clips and restores the active clip's exact frame every time", () => {
  const timeline = layout(parseSheet("bpm 120\n@clip app | 4\n@clip other | 2"));
  const app = fakeVideo();
  const other = fakeVideo();
  other.paused = false;
  syncClips({ app, other }, timeline, 1.25, false);
  assert.equal(app.currentTime, 1.25);
  assert.equal(app.paused, true);
  assert.equal(other.paused, true);
  app.currentTime = 8;
  syncClips({ app, other }, timeline, 1.25, false);
  assert.equal(app.currentTime, 1.25, "a repeated seek does not depend on prior playback state");
});

test("playback starts the active clip and only seeks it when it drifts from the film clock", () => {
  const timeline = layout(parseSheet("bpm 120\n@clip app | 4\n@clip other | 2"));
  const app = fakeVideo();
  const other = fakeVideo();
  app.currentTime = 1.3;
  syncClips({ app, other }, timeline, 1.25, true);
  assert.equal(app.plays, 1);
  assert.equal(app.paused, false);
  assert.equal(app.currentTime, 1.3, "normal playback is not reset on every animation frame");
  assert.equal(other.paused, true);
  app.currentTime = 4;
  syncClips({ app, other }, timeline, 1.25, true);
  assert.equal(app.currentTime, 1.25, "a material drift is corrected back to the audio clock");
});

test("an incoming whip-pan clip is paused at its first frame on every seek", () => {
  const timeline = layout(parseSheet("bpm 120\n@clip app | 2\nWORDS | 2\n@clip app | 2"));
  const app = fakeVideo();
  app.currentTime = 1.5;
  syncClips({ app }, timeline, 1.95, false, 0.4);
  assert.equal(app.currentTime, 0, "the incoming clip must not retain its previous playback position");
  assert.equal(app.paused, true);
  app.currentTime = 1.5;
  syncClips({ app }, timeline, 1.95, true, 0.4);
  assert.equal(app.currentTime, 0);
  assert.equal(app.plays, 0, "the incoming clip must not start before its block");
});

test("a short block does not begin its outgoing whip on its first frame", () => {
  const timeline = layout(parseSheet("bpm 120\n@clip app | 0.5\n@clip other | 2"));
  const app = fakeVideo();
  const other = fakeVideo();
  other.currentTime = 7;
  syncClips({ app, other }, timeline, 0, true, 1, 0);
  assert.equal(app.plays, 1);
  assert.equal(other.currentTime, 7, "the following clip is not visible until the outgoing transition starts");
  assert.equal(other.paused, true);
});

test("startup preroll holds the first clip at frame zero until the film clock starts", () => {
  const timeline = layout(parseSheet("bpm 120\n@clip app | 2"));
  const app = fakeVideo();
  app.currentTime = 1.5;
  syncFilmClips({ app }, timeline, -0.05, 0.4);
  assert.equal(app.currentTime, 0);
  assert.equal(app.plays, 0);
  assert.equal(app.paused, true);
  syncFilmClips({ app }, timeline, 0, 0.4);
  assert.equal(app.plays, 1);
  assert.equal(app.paused, false);
});

test("a seek never asks a short clip for a frame past its duration", () => {
  const timeline = layout(parseSheet("bpm 120\n@clip app | 4"));
  const app = fakeVideo(0.4);
  syncClips({ app }, timeline, 1.25, false);
  assert.equal(app.currentTime, 0.4);
});

test("a short clip holds its last frame instead of restarting during a longer block", () => {
  const timeline = layout(parseSheet("bpm 120\n@clip app | 4"));
  const app = fakeVideo(0.4);
  app.currentTime = 0.4;
  syncClips({ app }, timeline, 1.25, true);
  assert.equal(app.plays, 0);
  assert.equal(app.currentTime, 0.4);
});
