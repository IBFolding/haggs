import { between, nextRandom, type Rng } from "../rng";
import type { RunnerSpec } from "../spec";
import { WORLD, overlaps, type Box, type Input, type Status } from "./types";

/**
 * Runner: the world scrolls left at the spec's speed (a little faster as time
 * goes on), hazards stand on the ground, pickups float above it. Jump is an
 * edge, so holding the key doesn't bounce. Every hazard is sized and spaced
 * from the jump the spec allows, so any clamped spec can be cleared.
 */

export const GROUND = 380;
/** Pixels to a metre, for the distance goal. */
export const PX_PER_M = 40;

export type RunnerState = {
  template: "runner";
  rng: Rng;
  t: number;
  status: Status;
  score: number;
  lives: number;
  /** Pixels run so far. */
  run: number;
  player: Box & { vy: number; grounded: boolean };
  hazards: Box[];
  pickups: (Box & { taken: boolean })[];
  nextHazard: number;
  nextPickup: number;
  /** Seconds of not being hurt again after a hit. */
  safe: number;
  held: boolean;
};

/** How high and how far one jump goes with these rules. */
export function jumpReach(spec: RunnerSpec): { height: number; air: number; across: number } {
  const { jump, gravity, speed } = spec.rules;
  const air = (2 * jump) / gravity;
  return { height: (jump * jump) / (2 * gravity), air, across: speed * air };
}

export function initRunner(spec: RunnerSpec, seed: number): RunnerState {
  return {
    template: "runner",
    rng: { seed },
    t: 0,
    status: "playing",
    score: 0,
    lives: spec.rules.lives,
    run: 0,
    player: { x: 140, y: GROUND - 52, w: 44, h: 52, vy: 0, grounded: true },
    hazards: [],
    pickups: [],
    nextHazard: 1.2,
    nextPickup: 0.8,
    safe: 0,
    held: false,
  };
}

export const runnerSpeed = (spec: RunnerSpec, t: number) => spec.rules.speed * (1 + Math.min(0.5, t / 90));

export const metres = (s: RunnerState) => Math.floor(s.run / PX_PER_M);

export function stepRunner(spec: RunnerSpec, s: RunnerState, input: Input, dt: number): RunnerState {
  if (s.status !== "playing") return s;
  dt = Math.min(dt, 1 / 20);
  s.t += dt;
  const speed = runnerSpeed(spec, s.t);
  const reach = jumpReach(spec);
  const p = s.player;

  const pressed = Boolean(input.action || input.up);
  if (pressed && !s.held && p.grounded) {
    p.vy = -spec.rules.jump;
    p.grounded = false;
  }
  s.held = pressed;
  p.vy += spec.rules.gravity * dt;
  p.y += p.vy * dt;
  if (p.y >= GROUND - p.h) {
    p.y = GROUND - p.h;
    p.vy = 0;
    p.grounded = true;
  }

  const dx = speed * dt;
  s.run += dx;
  for (const h of s.hazards) h.x -= dx;
  for (const k of s.pickups) k.x -= dx;
  s.hazards = s.hazards.filter((h) => h.x + h.w > -20);
  s.pickups = s.pickups.filter((k) => k.x + k.w > -20 && !k.taken);

  s.nextHazard -= dt;
  if (s.nextHazard <= 0) {
    const h = Math.min(between(s.rng, 34, 72), reach.height * 0.7);
    const w = Math.max(18, Math.min(between(s.rng, 26, 52), reach.across - p.w - 24));
    s.hazards.push({ x: WORLD.w + 10, y: GROUND - h, w, h });
    // Never closer than a landing and a breath after the last jump.
    s.nextHazard = Math.max(spec.rules.spawnEvery * between(s.rng, 0.7, 1.35), reach.air + 0.35);
  }
  s.nextPickup -= dt;
  if (s.nextPickup <= 0) {
    const lift = between(s.rng, 50, Math.max(60, reach.height * 0.9));
    s.pickups.push({ x: WORLD.w + 10 + nextRandom(s.rng) * 80, y: GROUND - 28 - lift, w: 28, h: 28, taken: false });
    s.nextPickup = spec.rules.pickupEvery * between(s.rng, 0.7, 1.3);
  }

  for (const k of s.pickups) {
    if (!k.taken && overlaps(p, k)) {
      k.taken = true;
      s.score += 1;
    }
  }
  s.safe = Math.max(0, s.safe - dt);
  if (s.safe === 0 && s.hazards.some((h) => overlaps(p, h, 6))) {
    s.lives -= 1;
    s.safe = 1.2;
    if (s.lives <= 0) s.status = "lost";
  }

  if (s.status === "playing") {
    const reached = spec.rules.goal === "distance" ? metres(s) >= spec.rules.target : s.score >= spec.rules.target;
    if (reached) s.status = "won";
  }
  return s;
}

export function runnerHud(spec: RunnerSpec, s: RunnerState): string[] {
  const goal = spec.rules.goal === "distance" ? `${Math.min(metres(s), spec.rules.target)} / ${spec.rules.target} m` : `${s.score} / ${spec.rules.target}`;
  return [goal, ...(spec.rules.goal === "distance" ? [`★ ${s.score}`] : []), "♥".repeat(Math.max(0, s.lives))];
}
