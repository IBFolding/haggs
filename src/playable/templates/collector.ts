import { between, nextRandom, type Rng } from "../rng";
import type { CollectorSpec } from "../spec";
import { WORLD, type Input, type Status } from "./types";

/**
 * Collector: a top-down arena. Walk with the keys or towards a held finger,
 * gather pickups (three are always out), and stay clear of hazards that
 * bounce off the walls. Reach the target before the clock runs out.
 */

export type Body = { x: number; y: number; r: number };
export type Mover = Body & { vx: number; vy: number };

export type CollectorState = {
  template: "collector";
  rng: Rng;
  t: number;
  status: Status;
  score: number;
  lives: number;
  player: Body;
  pickups: Body[];
  hazards: Mover[];
  safe: number;
};

const ON_FIELD = 3;
const MARGIN = 30;

const touching = (a: Body, b: Body) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2 < (a.r + b.r) ** 2;

/** A spot at least `away` from the player, tried a few times then taken anyway. */
function spot(rng: Rng, from: Body, away: number): { x: number; y: number } {
  let best = { x: WORLD.w / 2, y: WORLD.h / 2 };
  for (let i = 0; i < 12; i++) {
    best = { x: between(rng, MARGIN, WORLD.w - MARGIN), y: between(rng, MARGIN, WORLD.h - MARGIN) };
    if ((best.x - from.x) ** 2 + (best.y - from.y) ** 2 > away * away) break;
  }
  return best;
}

export function initCollector(spec: CollectorSpec, seed: number): CollectorState {
  const rng = { seed };
  const player = { x: WORLD.w / 2, y: WORLD.h / 2, r: 20 };
  const hazards: Mover[] = Array.from({ length: spec.rules.hazards }, () => {
    const at = spot(rng, player, 200);
    const angle = nextRandom(rng) * Math.PI * 2;
    return { ...at, r: 18, vx: Math.cos(angle) * spec.rules.hazardSpeed, vy: Math.sin(angle) * spec.rules.hazardSpeed };
  });
  const pickups = Array.from({ length: ON_FIELD }, () => ({ ...spot(rng, player, 90), r: 14 }));
  return { template: "collector", rng, t: 0, status: "playing", score: 0, lives: spec.rules.lives, player, pickups, hazards, safe: 1 };
}

export const timeLeft = (spec: CollectorSpec, s: CollectorState) => Math.max(0, spec.rules.seconds - s.t);

export function stepCollector(spec: CollectorSpec, s: CollectorState, input: Input, dt: number): CollectorState {
  if (s.status !== "playing") return s;
  dt = Math.min(dt, 1 / 20);
  s.t += dt;
  const p = s.player;

  let dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  let dy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  if (!dx && !dy && input.point) {
    const ax = input.point.x - p.x;
    const ay = input.point.y - p.y;
    const far = Math.hypot(ax, ay);
    if (far > 6) {
      dx = ax / far;
      dy = ay / far;
    }
  }
  const len = Math.hypot(dx, dy);
  if (len > 0) {
    p.x += (dx / len) * spec.rules.speed * dt;
    p.y += (dy / len) * spec.rules.speed * dt;
  }
  p.x = Math.min(WORLD.w - p.r, Math.max(p.r, p.x));
  p.y = Math.min(WORLD.h - p.r, Math.max(p.r, p.y));

  for (const h of s.hazards) {
    h.x += h.vx * dt;
    h.y += h.vy * dt;
    if (h.x < h.r || h.x > WORLD.w - h.r) { h.vx = -h.vx; h.x = Math.min(WORLD.w - h.r, Math.max(h.r, h.x)); }
    if (h.y < h.r || h.y > WORLD.h - h.r) { h.vy = -h.vy; h.y = Math.min(WORLD.h - h.r, Math.max(h.r, h.y)); }
  }

  s.pickups = s.pickups.map((k) => {
    if (!touching(p, k)) return k;
    s.score += 1;
    return { ...spot(s.rng, p, 120), r: k.r };
  });

  s.safe = Math.max(0, s.safe - dt);
  if (s.safe === 0 && s.hazards.some((h) => touching(p, { ...h, r: h.r - 4 }))) {
    s.lives -= 1;
    s.safe = 1.2;
    if (s.lives <= 0) s.status = "lost";
  }
  if (s.status === "playing" && s.score >= spec.rules.target) s.status = "won";
  else if (s.status === "playing" && s.t >= spec.rules.seconds) s.status = "lost";
  return s;
}

export function collectorHud(spec: CollectorSpec, s: CollectorState): string[] {
  return [`${s.score} / ${spec.rules.target}`, `${Math.ceil(timeLeft(spec, s))}s`, "♥".repeat(Math.max(0, s.lives))];
}
