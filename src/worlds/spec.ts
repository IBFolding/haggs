export type WorldPreset = "aether" | "neon" | "dunes";
export type WorldKind = "island" | "portal" | "crystal" | "monolith" | "tower" | "ground" | "rock" | "arch" | "orb" | "cube" | "sphere";
export type Vec3 = [number, number, number];

export interface WorldObject {
  id: string;
  kind: WorldKind;
  position: Vec3;
  rotation: Vec3;
  scale: number;
  color: string;
  width?: number;
}
export interface WorldShot {
  id: string;
  name: string;
  start: number;
  end: number;
  from: Vec3;
  to: Vec3;
  lookFrom: Vec3;
  lookTo: Vec3;
  lensMm: number;
}
export interface WorldSpec {
  version: 1;
  id: string;
  name: string;
  prompt: string;
  preset: WorldPreset;
  seed: number;
  environment: { fog: number; daylight: number; motion: number; accent: string };
  objects: WorldObject[];
  film: { fps: number; duration: number; shots: WorldShot[] };
}
export const PRESETS: WorldPreset[] = ["aether", "neon", "dunes"];
export const KINDS: WorldKind[] = ["island", "portal", "crystal", "monolith", "tower", "ground", "rock", "arch", "orb", "cube", "sphere"];
const palette: Record<WorldPreset, string> = { aether: "#c8ff2e", neon: "#50f0ed", dunes: "#ffb76a" };
export const titleOf: Record<WorldPreset, string> = { aether: "Aether Isles", neon: "Neon District", dunes: "Dune Cathedral" };

export function seeded(seed: number) {
  let x = (Math.floor(seed) >>> 0) || 1;
  return () => ((x = (Math.imul(x, 1664525) + 1013904223) >>> 0) / 4294967296);
}
export function makeWorld(preset: WorldPreset = "aether", seed = 42): WorldSpec {
  const random = seeded(seed);
  const objects: WorldObject[] = [];
  const add = (kind: WorldKind, position: Vec3, scale = 1, color = palette[preset], width?: number) => {
    const obj: WorldObject = { id: `object-${objects.length + 1}`, kind, position, scale, color, rotation: [0, random() * 6.283, 0] };
    if (width !== undefined) obj.width = width;
    objects.push(obj);
  };
  if (preset === "aether") {
    add("island", [0, -.5, 0], 2.6, "#3f6866");
    add("portal", [0, 2.3, 0], 1.2);
    add("monolith", [0, 1.05, 0], 1.15, "#b0bd99");
    for (let i = 0; i < 9; i++) {
      const a = i * 2.39996, r = 4 + i * .69;
      add("island", [Math.cos(a) * r, -1 + (i % 3) * .25, Math.sin(a) * r], .55 + (i % 3) * .15, "#315253");
      add("crystal", [Math.cos(a) * r, .45 + (i % 3) * .25, Math.sin(a) * r], .55, i % 2 ? "#9dedc8" : "#c8ff2e");
    }
  } else if (preset === "neon") {
    add("ground", [0, -.7, 0], 1, "#162333");
    for (let x = -3; x <= 3; x++) for (let z = -3; z <= 3; z++) {
      if (Math.abs(x) + Math.abs(z) <= 1) continue;
      const h = 1.3 + random() * 7;
      add("tower", [x * 2.8, h / 2 - .6, z * 2.8], h, random() > .4 ? "#29dad0" : "#a6fa45", .6 + random() * .6);
    }
    add("portal", [0, 2.1, 0], 1.55);
    add("orb", [0, 2.2, 0], .6);
  } else {
    add("ground", [0, -.7, 0], 1, "#897260");
    add("arch", [0, .25, 0], 2.9, "#c6a67a");
    add("orb", [0, 2.9, 0], .65);
    for (let i = 0; i < 22; i++) {
      const a = random() * 6.283, r = 3 + random() * 13;
      add(i % 3 ? "rock" : "monolith", [Math.cos(a) * r, -.2, Math.sin(a) * r], .6 + random() * 1.5, "#b59c7d");
    }
  }
  const shots: WorldShot[] = [
    { id: "S01", name: "Establish", start: 0, end: 3.5, from: [15, 8, 16], to: [10, 6, 12], lookFrom: [0, 1, 0], lookTo: [0, 1.7, 0], lensMm: 32 },
    { id: "S02", name: "Orbit", start: 3.5, end: 7, from: [8, 4, -10], to: [-8, 5, -10], lookFrom: [0, 2, 0], lookTo: [0, 2, 0], lensMm: 42 },
    { id: "S03", name: "Hero", start: 7, end: 10, from: [-8, 5, 9], to: [0, 4, 9], lookFrom: [0, 1.6, 0], lookTo: [0, 2.2, 0], lensMm: 55 },
  ];
  return { version: 1, id: `world-${seed}`, name: titleOf[preset], prompt: "", preset, seed, environment: { fog: .45, daylight: .55, motion: .6, accent: palette[preset] }, objects, film: { fps: 24, duration: 10, shots } };
}
export function fromWorldPrompt(prompt: string, seed = 42) {
  const p = prompt.toLowerCase();
  const preset: WorldPreset = /city|neon|cyber|street|tower|skyscraper/.test(p) ? "neon" : /desert|dune|sand|ruins|temple/.test(p) ? "dunes" : "aether";
  return { ...makeWorld(preset, seed), prompt: prompt.slice(0, 1500) };
}
const finiteVec = (v: unknown): v is Vec3 => Array.isArray(v) && v.length === 3 && v.every(x => typeof x === "number" && Number.isFinite(x) && Math.abs(x) <= 500);
const validColor = (v: unknown) => typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v);
export function validateWorld(w: unknown): w is WorldSpec {
  if (!w || typeof w !== "object") return false;
  const a = w as Partial<WorldSpec>;
  if (a.version !== 1 || !PRESETS.includes(a.preset as WorldPreset) || !Number.isInteger(a.seed) || typeof a.name !== "string" || a.name.length > 160 || typeof a.prompt !== "string" || a.prompt.length > 1500 || typeof a.id !== "string") return false;
  const e = a.environment;
  if (!e || !validColor(e.accent) || ![e.fog, e.daylight, e.motion].every(n => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 1)) return false;
  if (!Array.isArray(a.objects) || a.objects.length > 600) return false;
  const ids = new Set<string>();
  for (const o of a.objects) {
    if (!o || typeof o.id !== "string" || !/^[a-zA-Z0-9_-]{1,64}$/.test(o.id) || ids.has(o.id) || !KINDS.includes(o.kind) || !finiteVec(o.position) || !finiteVec(o.rotation) || !validColor(o.color) || !(o.scale > 0 && o.scale <= 100) || (o.width !== undefined && !(o.width > 0 && o.width <= 100))) return false;
    ids.add(o.id);
  }
  const f = a.film;
  if (!f || !Number.isInteger(f.fps) || f.fps! < 1 || f.fps! > 60 || typeof f.duration !== "number" || f.duration <= 0 || f.duration > 120 || !Array.isArray(f.shots) || f.shots.length < 1 || f.shots.length > 50) return false;
  let last = 0;
  for (const s of f.shots) {
    if (!s || typeof s.name !== "string" || typeof s.id !== "string" || !Number.isFinite(s.start) || !Number.isFinite(s.end) || Math.abs(s.start - last) > .00001 || s.end <= s.start || s.end > f.duration + .00001 || ![s.from, s.to, s.lookFrom, s.lookTo].every(finiteVec) || !Number.isFinite(s.lensMm) || s.lensMm < 12 || s.lensMm > 250) return false;
    last = s.end;
  }
  return Math.abs(last - f.duration) < .00001;
}
export function shotAt(w: WorldSpec, time: number) { return w.film.shots.find(s => time < s.end) ?? w.film.shots[w.film.shots.length - 1]!; }
export function cameraAt(s: WorldShot, time: number) {
  const u = Math.max(0, Math.min(1, (time - s.start) / (s.end - s.start)));
  const t = u * u * (3 - 2 * u);
  const lerp = (a: Vec3, b: Vec3): Vec3 => a.map((v, i) => v + (b[i]! - v) * t) as Vec3;
  return { position: lerp(s.from, s.to), target: lerp(s.lookFrom, s.lookTo), lensMm: s.lensMm };
}
