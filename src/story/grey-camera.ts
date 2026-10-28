import type { GreyFrame } from "./grey";

/**
 * A moving camera for the grey room: the same four numbers the still camera
 * has, keyed at times. Between keys they ease linearly. Every way of making
 * keys (presets, words, a drawn line) ends up as the same list.
 */

export type CamState = GreyFrame["cam"];
export type CamKey = CamState & { t: number };

/** How long a camera path runs, in seconds. */
export const CAM_SECONDS = 6;

const FIELDS = ["angle", "distance", "height", "lens"] as const;
const clamp = (n: number, lo: number, hi: number) => (Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : lo);
const tick = (t: number) => Math.round(t * 20) / 20;
const state = (c: CamState): CamState => ({ angle: c.angle, distance: c.distance, height: c.height, lens: c.lens });
const sorted = (keys: CamKey[]) => [...keys].sort((a, b) => a.t - b.t);

/** The camera at time `t`: the still camera when there are no keys, otherwise the keys, eased between. */
export function camAt(cam: CamState, keys: CamKey[] | undefined, t: number): CamState {
  if (!keys?.length) return cam;
  const k = sorted(keys);
  const first = k[0]!;
  const last = k.at(-1)!;
  if (t <= first.t) return state(first);
  if (t >= last.t) return state(last);
  let i = 0;
  while (k[i + 1]!.t < t) i++;
  const a = k[i]!;
  const b = k[i + 1]!;
  const f = (t - a.t) / (b.t - a.t || 1);
  const out = { ...cam };
  for (const n of FIELDS) out[n] = a[n] + (b[n] - a[n]) * f;
  return out;
}

/** Puts a key at `t`, replacing one within a twentieth of a second of it. */
export function setKey(keys: CamKey[] | undefined, t: number, cam: CamState): CamKey[] {
  const rest = (keys ?? []).filter((k) => Math.abs(k.t - t) > 0.04);
  return sorted([...rest, { t: tick(clamp(t, 0, CAM_SECONDS)), ...state(cam) }]);
}

export const dropKey = (keys: CamKey[] | undefined, t: number): CamKey[] | undefined => {
  const rest = (keys ?? []).filter((k) => Math.abs(k.t - t) > 0.04);
  return rest.length ? rest : undefined;
};

/** The camera made safe: real ranges, sorted, at most 12 keys inside the path's length. Angles stay unwrapped (−40, 400) so an orbit eases the way it was drawn instead of the short way round. */
export function tidyKeys(keys: unknown): CamKey[] | undefined {
  if (!Array.isArray(keys)) return undefined;
  const out = keys
    .filter((k): k is CamKey => !!k && typeof k === "object" && [k.t, k.angle, k.distance, k.height, k.lens].every((n) => Number.isFinite(n)))
    .map((k) => ({ t: tick(clamp(k.t, 0, CAM_SECONDS)), angle: clamp(k.angle, -720, 720), distance: clamp(k.distance, 1, 12), height: clamp(k.height, 0.2, 6), lens: clamp(Math.round(k.lens), 14, 135) }));
  return out.length ? sorted(out).slice(0, 12) : undefined;
}

/** One camera move, as a change to the camera. Null if the words aren't a move. */
export function stepOf(words: string, c: CamState): CamState | null {
  const w = words.toLowerCase();
  const o = { ...c };
  if (/push|dolly in|move in|closer/.test(w)) o.distance = Math.max(1.5, c.distance * 0.5);
  else if (/pull|back|away|dolly out/.test(w)) o.distance = Math.min(12, c.distance * 1.8);
  else if (/orbit|circle|around|arc/.test(w)) o.angle = c.angle + (/left/.test(w) ? -60 : 60);
  else if (/crane up|rise|up|higher/.test(w)) o.height = Math.min(6, c.height + 2);
  else if (/crane down|drop|down|lower/.test(w)) o.height = Math.max(0.2, c.height - 1.2);
  else if (/zoom in|tight/.test(w)) o.lens = Math.min(135, c.lens * 1.6);
  else if (/zoom out|wide/.test(w)) o.lens = Math.max(14, c.lens * 0.6);
  else if (/hold|still|static|lock/.test(w)) { /* stays put */ }
  else return null;
  if (/rise|and up/.test(w) && !/crane up/.test(w)) o.height = Math.min(6, o.height + 2);
  return o;
}

/** "Push in, then orbit left and rise" → keys spread across the path. `unknown` is the first phrase that wasn't a move. */
export function wordsToKeys(text: string, cam: CamState): { keys: CamKey[]; unknown?: string } {
  const parts = text.split(/,|\bthen\b|\band then\b|;/i).map((p) => p.trim()).filter(Boolean);
  let c = cam;
  const keys: CamKey[] = [{ t: 0, ...state(c) }];
  let unknown: string | undefined;
  parts.forEach((p, i) => {
    const next = stepOf(p, c);
    if (!next) { unknown ??= p; return; }
    c = next;
    keys.push({ t: tick(((i + 1) * CAM_SECONDS) / parts.length), ...state(c) });
  });
  return { keys: tidyKeys(keys) ?? [], ...(unknown ? { unknown } : {}) };
}

export const PRESETS = ["Push in", "Pull back", "Orbit", "Crane up"] as const;
export type Preset = (typeof PRESETS)[number];

export function presetKeys(name: Preset, c: CamState): CamKey[] {
  const K = (t: number, o: Partial<CamState> = {}): CamKey => ({ t, ...state({ ...c, ...o }) });
  const keys =
    name === "Push in" ? [K(0), K(CAM_SECONDS, { distance: Math.max(1.5, c.distance * 0.5) })]
    : name === "Pull back" ? [K(0), K(CAM_SECONDS, { distance: Math.min(12, c.distance * 1.8) })]
    : name === "Orbit" ? [K(0), K(CAM_SECONDS / 2, { angle: c.angle + 60 }), K(CAM_SECONDS, { angle: c.angle + 120 })]
    : [K(0), K(CAM_SECONDS, { height: Math.min(6, c.height + 3) })];
  return tidyKeys(keys) ?? [];
}

/**
 * A line drawn on the room plan, as camera keys: `points` are floor positions in metres
 * (x across, z away from the camera's "front"), resampled to at most eight keys.
 * Angle and distance come from where each point is round the middle of the room.
 */
export function drawnKeys(points: { x: number; z: number }[], keep: Pick<CamState, "height" | "lens">): CamKey[] {
  if (points.length < 4) return [];
  const n = Math.min(8, Math.max(3, Math.round(points.length / 6)));
  const keys: CamKey[] = [];
  for (let i = 0; i < n; i++) {
    const p = points[Math.round((i * (points.length - 1)) / (n - 1))]!;
    keys.push({ t: tick((i * CAM_SECONDS) / (n - 1)), angle: (Math.atan2(p.x, -p.z) * 180) / Math.PI, distance: Math.hypot(p.x, p.z), ...keep });
  }
  return tidyKeys(keys) ?? [];
}
