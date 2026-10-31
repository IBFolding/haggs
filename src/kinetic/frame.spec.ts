import assert from "node:assert/strict";
import { test } from "node:test";

import { frame } from "../app/kinetic/kinetic";
import { layout, parseSheet } from "./beats";
import { DEFAULT_MOTION } from "./draw";
import { syncFilmClips } from "./playback";

function fakeContext(drawImage: (...args: unknown[]) => void = () => undefined) {
  const ctx: Record<string, unknown> = { fillStyle: "", font: "", textAlign: "", textBaseline: "", globalAlpha: 1 };
  for (const op of ["save", "restore", "translate", "scale", "transform", "beginPath", "rect", "clip", "clearRect", "fillRect", "fillText"]) ctx[op] = () => undefined;
  ctx.measureText = (text: string) => ({ width: text.length * 100 });
  ctx.createLinearGradient = () => ({ addColorStop: () => undefined });
  ctx.drawImage = drawImage;
  return ctx as unknown as CanvasRenderingContext2D;
}

function fakeCanvas(ctx: CanvasRenderingContext2D) {
  return { getContext: () => ctx } as unknown as HTMLCanvasElement;
}

function fakeVideo(currentTime: number) {
  return {
    currentTime,
    duration: 10,
    paused: true,
    play() { this.paused = false; return Promise.resolve(); },
    pause() { this.paused = true; },
  };
}

test("shutter samples never draw an incoming clip at a stale playback position", () => {
  const timeline = layout(parseSheet("bpm 120\nWORDS | 2\n@clip next | 2"));
  const next = {
    currentTime: 7,
    duration: 10,
    paused: true,
    play() { this.paused = false; return Promise.resolve(); },
    pause() { this.paused = true; },
  };
  const drawnAt: number[] = [];
  const tmp = fakeContext((image) => { if (image === next) drawnAt.push(next.currentTime); });
  const main = fakeContext();

  syncFilmClips({ next }, timeline, 0.799, 0.4);
  frame(fakeCanvas(main), fakeCanvas(tmp), timeline, 0.799, {
    next: { el: next as unknown as HTMLVideoElement, width: 1280, height: 720 },
  }, DEFAULT_MOTION);

  assert.ok(drawnAt.length > 0, "the shutter must actually sample the incoming clip");
  assert.deepEqual(drawnAt, drawnAt.map(() => 0), "every visible sample uses the incoming clip's first frame");
});

test("zero-whip shutter samples synchronize the clip on each side of a hard cut", () => {
  const timeline = layout(parseSheet("bpm 120\nWORDS | 2\n@clip next | 2"));
  const next = fakeVideo(7);
  const drawnAt: number[] = [];
  const tmp = fakeContext((image) => { if (image === next) drawnAt.push(next.currentTime); });
  const clips = { next };
  frame(fakeCanvas(fakeContext()), fakeCanvas(tmp), timeline, 0.985, {
    next: { el: next as unknown as HTMLVideoElement, width: 1280, height: 720 },
  }, { ...DEFAULT_MOTION, whipBeats: 0 }, (sample) => syncFilmClips(clips, timeline, sample, 0, 0, true));
  assert.ok(drawnAt.length > 0);
  assert.deepEqual(drawnAt, drawnAt.map(() => 0));
});

test("trailing shutter samples restore the outgoing clip's exact frame", () => {
  const timeline = layout(parseSheet("bpm 120\n@clip prev | 2\n@clip next | 2"));
  const prev = fakeVideo(7), next = fakeVideo(0);
  const drawnAt: number[] = [];
  const tmp = fakeContext((image) => { if (image === prev) drawnAt.push(prev.currentTime); });
  const clips = { prev, next };
  frame(fakeCanvas(fakeContext()), fakeCanvas(tmp), timeline, 1.001, {
    prev: { el: prev as unknown as HTMLVideoElement, width: 1280, height: 720 },
    next: { el: next as unknown as HTMLVideoElement, width: 1280, height: 720 },
  }, DEFAULT_MOTION, (sample) => syncFilmClips(clips, timeline, sample, 0.4, 0, true));
  assert.ok(drawnAt.length > 0);
  assert.equal(drawnAt.length, 2);
  [0.986, 0.996].forEach((expected, index) => assert.ok(Math.abs(drawnAt[index]! - expected) < 1e-9));
});

test("adjacent occurrences of one clip use separate outgoing and incoming media", () => {
  const timeline = layout(parseSheet("bpm 120\n@clip app | 2\n@clip app | 2"));
  const outgoing = fakeVideo(0.9), incoming = fakeVideo(7);
  const drawn = { outgoing: [] as number[], incoming: [] as number[] };
  const tmp = fakeContext((image) => {
    if (image === outgoing) drawn.outgoing.push(outgoing.currentTime);
    if (image === incoming) drawn.incoming.push(incoming.currentTime);
  });
  const clips = { app: outgoing, "1:app": incoming };
  frame(fakeCanvas(fakeContext()), fakeCanvas(tmp), timeline, 0.9, {
    app: { el: outgoing as unknown as HTMLVideoElement, width: 1280, height: 720 },
    "1:app": { el: incoming as unknown as HTMLVideoElement, width: 1280, height: 720 },
  }, DEFAULT_MOTION, (sample) => syncFilmClips(clips, timeline, sample, 0.4, 0, true));
  assert.equal(drawn.outgoing.length, 4);
  [0.885, 0.895, 0.905, 0.915].forEach((expected, index) => assert.ok(Math.abs(drawn.outgoing[index]! - expected) < 1e-9));
  assert.deepEqual(drawn.incoming, [0, 0, 0, 0]);
});
