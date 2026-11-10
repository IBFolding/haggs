import { cameraAt, makeWorld, seeded, validateWorld, type Vec3, type WorldShot, type WorldSpec } from "../worlds/spec";

export type ReviewState = "unreviewed" | "approved" | "needs-change";
export type FilmShot = WorldShot & { beat: string; review: ReviewState; notes: string };
export type FilmEngine = "three" | "blender" | "comfy";
export interface FilmDocument {
  version: 1;
  title: string;
  brief: string;
  world: WorldSpec;
  duration: number;
  fps: 24;
  shots: FilmShot[];
}

export type ShotIdea = { name: string; beat: string; seconds?: number; lensMm?: number };
export const FILM_STORAGE_KEY = "haggs:film-engine:v2";
const BEATS = [
  ["The first light", "A slow establishing move reveals the world and its scale."],
  ["Our first witness", "Discover a figure or focal point grounded in the landscape."],
  ["Across the impossible", "A moving wide shot explores the geography and the destination."],
  ["Something awakens", "Introduce a visual change and a reason to keep watching."],
  ["Approaching the heart", "Move closer to the hero object with controlled anticipation."],
  ["The reveal", "Give the audience a clear, memorable visual payoff."],
  ["A breath", "Allow the location and atmosphere a moment of quiet."],
  ["The final image", "Finish on the iconic composition; a clean place for the cut."],
] as const;

const round = (n: number) => { const value = Math.round(n * 1000) / 1000; return Object.is(value, -0) ? 0 : value; };
const finiteVec = (v: unknown): v is Vec3 => Array.isArray(v) && v.length === 3 && v.every((n) => typeof n === "number" && Number.isFinite(n) && Math.abs(n) < 500);
const lerp = (a: Vec3, b: Vec3, t: number): Vec3 => a.map((x, i) => round(x + (b[i]! - x) * t)) as Vec3;
const vec = (x: number, y: number, z: number): Vec3 => [round(x), round(y), round(z)];

function makeCamera(i: number, count: number, seed: number) {
  const rng = seeded(seed + i * 19 + 700);
  const orbit = (i / count) * Math.PI * 2 - Math.PI / 4;
  const radius = 9 + rng() * 6;
  const height = 4 + rng() * 4;
  const spin = (i % 2 ? 1 : -1) * (.19 + rng() * .27);
  return {
    from: vec(Math.sin(orbit) * radius, height, Math.cos(orbit) * radius),
    to: vec(Math.sin(orbit + spin) * (radius - 2.1), height + (i % 3 - 1) * .9, Math.cos(orbit + spin) * (radius - 2.1)),
    lookFrom: vec(0, 1.5 + (i % 3) * .25, 0),
    lookTo: vec(0, 2.1 + (i % 2) * .38, 0),
  };
}

export function makeFilmDocument(world: WorldSpec = makeWorld(), duration = 60, ideas?: readonly ShotIdea[], brief = ""): FilmDocument {
  const fps = 24 as const;
  const count = Math.min(16, Math.max(1, ideas?.length ?? BEATS.length));
  const totalFrames = Math.round(Math.min(120, Math.max(8, duration)) * fps);
  const weights = Array.from({ length: count }, (_, i) => Math.max(1, ideas?.[i]?.seconds ?? [8, 7, 9, 10, 8, 8, 6, 4][i % 8]!));
  const sumWeights = weights.reduce((a, b) => a + b, 0);
  let cursor = 0;
  const shots: FilmShot[] = weights.map((weight, i) => {
    const remaining = count - i - 1;
    const endFrame = i === count - 1 ? totalFrames : Math.min(totalFrames - remaining, cursor + Math.max(1, Math.round(totalFrames * weight / sumWeights)));
    const idea = ideas?.[i];
    const camera = makeCamera(i, count, world.seed);
    const s: FilmShot = {
      id: `S${String(i + 1).padStart(2, "0")}`,
      name: String(idea?.name || BEATS[i % BEATS.length]![0]).slice(0, 90),
      beat: String(idea?.beat || BEATS[i % BEATS.length]![1]).slice(0, 900),
      notes: "",
      review: "unreviewed",
      start: cursor / fps,
      end: endFrame / fps,
      lensMm: Math.min(120, Math.max(18, Math.round(idea?.lensMm ?? [32, 65, 28, 40, 55, 42, 70, 35][i % 8]!))),
      ...camera,
    };
    cursor = endFrame;
    return s;
  });
  return { version: 1, title: world.name + " · Film", brief: brief.slice(0, 1800), world, duration: totalFrames / fps, fps, shots };
}

export function filmWorld(doc: FilmDocument): WorldSpec {
  return { ...doc.world, film: { fps: doc.fps, duration: doc.duration, shots: doc.shots.map(({ id, name, start, end, from, to, lookFrom, lookTo, lensMm }) => ({ id, name, start, end, from, to, lookFrom, lookTo, lensMm })) } };
}

export function validateFilmDocument(value: unknown): value is FilmDocument {
  if (!value || typeof value !== "object") return false;
  const doc = value as Partial<FilmDocument>;
  if (doc.version !== 1 || !doc.world || !validateWorld(doc.world) || doc.fps !== 24 || typeof doc.title !== "string" || doc.title.length > 160 || typeof doc.brief !== "string" || doc.brief.length > 1800 || typeof doc.duration !== "number" || doc.duration < 8 || doc.duration > 120 || !Array.isArray(doc.shots) || doc.shots.length < 1 || doc.shots.length > 16) return false;
  let last = 0;
  for (const s of doc.shots) {
    if (!s || typeof s.id !== "string" || !/^S\d{2}$/.test(s.id) || typeof s.name !== "string" || s.name.length > 90 || typeof s.beat !== "string" || s.beat.length > 900 || typeof s.notes !== "string" || s.notes.length > 2000 || !["unreviewed", "approved", "needs-change"].includes(s.review) || typeof s.start !== "number" || typeof s.end !== "number" || !Number.isFinite(s.start) || !Number.isFinite(s.end) || Math.abs(s.start - last) > .00001 || s.end <= s.start || s.end > doc.duration + .00001 || ![s.from, s.to, s.lookFrom, s.lookTo].every(finiteVec) || !Number.isFinite(s.lensMm) || s.lensMm < 12 || s.lensMm > 250) return false;
    last = s.end;
  }
  return Math.abs(last - doc.duration) < .00001 && validateWorld(filmWorld(doc as FilmDocument));
}

export function filmShotAt(doc: FilmDocument, time: number): FilmShot {
  return doc.shots.find((s) => time < s.end) ?? doc.shots[doc.shots.length - 1]!;
}

export function frameForShot(shot: FilmShot): number {
  return Math.floor((shot.start + shot.end) * 12);
}

export function filmCameraAt(shot: FilmShot, time: number) {
  return cameraAt(shot, time);
}

export function filmManifest(doc: FilmDocument) {
  return {
    format: "haggs-film-engine-v2",
    title: doc.title, brief: doc.brief,
    renderer: { preview: "Three.js", cinematic: "Blender Cycles", openWeight: "ComfyUI shot handoff" },
    fps: doc.fps, durationSeconds: doc.duration,
    world: filmWorld(doc),
    shots: doc.shots.map((s) => ({ id: s.id, name: s.name, beat: s.beat, durationSeconds: round(s.end - s.start), startSeconds: s.start, endSeconds: s.end, lensMm: s.lensMm, cameraFrom: s.from, cameraTo: s.to, lookFrom: s.lookFrom, lookTo: s.lookTo, review: s.review, notes: s.notes })),
    state: "planned-not-rendered",
  };
}
