import { CAM_SECONDS, tidyKeys, type CamKey, type CamState } from "./grey-camera";
import { subjectFacing, type GreySubject } from "./grey";

/**
 * Named camera moves for the grey room. Each one is a few plain numbers
 * (how long, how far, which way, from which figure) turned into ordinary
 * camera keys, so retiming, reversing, saving, snapshots and the Blender
 * export treat them like any other path. The camera always looks at the
 * middle of the room; "from" only picks the side the move starts from.
 * Pure arithmetic: no GPU, no network, no cost.
 */

export const MOVES = ["Arc", "Push in", "Pull out", "Crane up", "Crane down", "Orbit", "Bullet time", "Dolly zoom", "Whip"] as const;
export type Move = (typeof MOVES)[number];
export type Way = "left" | "right";

export type MoveOptions = {
  /** Seconds the move takes, 1 to the length of the path. The camera holds its last key afterwards. */
  seconds: number;
  /** How much, in the move's own unit (see MOVE_INFO). */
  amount: number;
  /** Which way round (arc, orbit, bullet time, whip); for the dolly zoom, "right" moves in and "left" moves out. */
  way: Way;
  /** Start from the front of this figure instead of where the camera is now. */
  from?: string | undefined;
};

type Info = { says: string; unit: "°" | "m"; min: number; max: number; step: number; amount: number; seconds: number; turns: boolean };

export const MOVE_INFO: Record<Move, Info> = {
  Arc: { says: "A partial swing round the room", unit: "°", min: 15, max: 180, step: 5, amount: 70, seconds: 4, turns: true },
  "Push in": { says: "Dolly toward the middle", unit: "m", min: 0.5, max: 8, step: 0.5, amount: 2.5, seconds: 4, turns: false },
  "Pull out": { says: "Dolly away from the middle", unit: "m", min: 0.5, max: 8, step: 0.5, amount: 3, seconds: 4, turns: false },
  "Crane up": { says: "Rise, looking down more", unit: "m", min: 0.5, max: 5, step: 0.5, amount: 2.5, seconds: 4, turns: false },
  "Crane down": { says: "Drop toward the floor", unit: "m", min: 0.5, max: 5, step: 0.5, amount: 1, seconds: 4, turns: false },
  Orbit: { says: "A steady turn all the way round", unit: "°", min: 90, max: 360, step: 30, amount: 360, seconds: 6, turns: true },
  "Bullet time": { says: "A fast orbit that slows round the middle", unit: "°", min: 90, max: 360, step: 30, amount: 270, seconds: 6, turns: true },
  "Dolly zoom": { says: "Move and zoom opposite ways so the middle holds its size", unit: "m", min: 0.5, max: 6, step: 0.5, amount: 2.5, seconds: 5, turns: false },
  Whip: { says: "Hold, then a very fast swing", unit: "°", min: 30, max: 180, step: 10, amount: 90, seconds: 3, turns: true },
};

export function defaultMoveOptions(move: Move): MoveOptions {
  const i = MOVE_INFO[move];
  return { seconds: i.seconds, amount: i.amount, way: "right" };
}

const clamp = (n: number, lo: number, hi: number) => (Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : lo);
const tick = (t: number) => Math.round(t * 20) / 20;
const lerp = (a: number, b: number, f: number) => (f >= 1 ? b : a + (b - a) * f);
const smooth = (u: number) => u * u * (3 - 2 * u);
/** Slow at both ends, fast between: the usual start and stop of a real move. */
const EASE_STEPS = 6;

/** Fast at the ends, slow in the middle (k near 1 nearly stops there). */
const dwell = (u: number, k: number) => u + (k * Math.sin(2 * Math.PI * u)) / (2 * Math.PI);

/** The camera a move starts from: the current one, or the front of a chosen figure. */
export function moveStart(cam: CamState, subjects: GreySubject[], from?: string): CamState {
  const s = from ? subjects.find((x) => x.id === from) : undefined;
  return s ? { ...cam, angle: subjectFacing(s) } : { ...cam };
}

/** Evenly spaced keys over `seconds`, each given by `at(u)` with u from 0 to 1. */
function sample(c: CamState, seconds: number, steps: number, at: (u: number) => Partial<CamState>): CamKey[] {
  const keys: CamKey[] = [];
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    keys.push({ t: tick(u * seconds), ...c, ...at(u) });
  }
  return keys;
}

export function moveKeys(move: Move, start: CamState, options: Partial<MoveOptions> = {}): CamKey[] {
  const info = MOVE_INFO[move];
  const seconds = clamp(options.seconds ?? info.seconds, 1, CAM_SECONDS);
  const amount = clamp(options.amount ?? info.amount, info.min, info.max);
  const sign = options.way === "left" ? -1 : 1;
  const c = start;
  let keys: CamKey[];
  switch (move) {
    case "Arc":
    case "Orbit":
      keys = sample(c, seconds, move === "Orbit" ? 8 : EASE_STEPS, (u) => ({ angle: c.angle + sign * amount * (move === "Orbit" ? u : smooth(u)) }));
      break;
    case "Bullet time":
      keys = sample(c, seconds, 10, (u) => ({ angle: c.angle + sign * amount * dwell(u, 0.85) }));
      break;
    case "Push in":
    case "Pull out": {
      const end = clamp(c.distance + (move === "Push in" ? -amount : amount), 1.5, 12);
      keys = sample(c, seconds, EASE_STEPS, (u) => ({ distance: lerp(c.distance, end, smooth(u)) }));
      break;
    }
    case "Crane up":
    case "Crane down": {
      const end = clamp(c.height + (move === "Crane up" ? amount : -amount), 0.3, 6);
      keys = sample(c, seconds, EASE_STEPS, (u) => ({ height: lerp(c.height, end, smooth(u)) }));
      break;
    }
    case "Dolly zoom": {
      // Lens follows distance, so whatever sits in the middle keeps its size while the room stretches round it.
      const want = (options.way === "left" ? c.distance + amount : Math.max(1.5, c.distance - amount)) / c.distance;
      const lo = Math.max(1.5 / c.distance, 14 / c.lens);
      const hi = Math.min(12 / c.distance, 135 / c.lens);
      const ratio = lo <= hi ? clamp(want, lo, hi) : 1;
      keys = sample(c, seconds, EASE_STEPS, (u) => {
        const r = 1 + (ratio - 1) * smooth(u);
        return { distance: c.distance * r, lens: c.lens * r };
      });
      break;
    }
    default: {
      // Whip: hold, a quarter-second swing, hold.
      const swing = Math.min(0.25, seconds / 4);
      const at = tick(Math.max(swing, seconds * 0.45));
      const to = c.angle + sign * amount;
      keys = [
        { t: 0, ...c },
        { t: at, ...c },
        { t: tick(at + swing), ...c, angle: to },
        { t: tick(Math.max(at + swing + 0.05, seconds)), ...c, angle: to },
      ];
    }
  }
  return tidyKeys(keys) ?? [];
}

/** What the move will do, in a line, for the screen. */
export function describeMove(move: Move, options: Partial<MoveOptions> = {}, fromLabel?: string): string {
  const info = MOVE_INFO[move];
  const way = info.turns ? ` ${options.way === "left" ? "left" : "right"}` : "";
  const start = fromLabel ? `, from the front of ${fromLabel}` : "";
  return `${move}${way}, ${+clamp(options.amount ?? info.amount, info.min, info.max).toFixed(1)}${info.unit} over ${clamp(options.seconds ?? info.seconds, 1, CAM_SECONDS).toFixed(1)} s${start}`;
}
