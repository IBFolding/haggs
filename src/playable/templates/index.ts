import type { GameSpec } from "../spec";
import { collectorHud, initCollector, stepCollector, type CollectorState } from "./collector";
import { initMatch, matchHud, stepMatch, type MatchState } from "./match";
import { initRunner, runnerHud, stepRunner, type RunnerState } from "./runner";
import type { Input } from "./types";

export type GameState = RunnerState | CollectorState | MatchState;

/** A state for this spec. If the template changed under a running game, a fresh one. */
export function initGame(spec: GameSpec, seed: number): GameState {
  if (spec.template === "runner") return initRunner(spec, seed);
  if (spec.template === "collector") return initCollector(spec, seed);
  return initMatch(spec, seed);
}

export function stepGame(spec: GameSpec, state: GameState, input: Input, dt: number): GameState {
  if (spec.template === "runner" && state.template === "runner") return stepRunner(spec, state, input, dt);
  if (spec.template === "collector" && state.template === "collector") return stepCollector(spec, state, input, dt);
  if (spec.template === "match" && state.template === "match") return stepMatch(spec, state, dt);
  return initGame(spec, state.rng.seed);
}

export function hudOf(spec: GameSpec, state: GameState): string[] {
  if (spec.template === "runner" && state.template === "runner") return runnerHud(spec, state);
  if (spec.template === "collector" && state.template === "collector") return collectorHud(spec, state);
  if (spec.template === "match" && state.template === "match") return matchHud(spec, state);
  return [];
}

export type { Input } from "./types";
