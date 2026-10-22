import { getModelCard } from "../catalog/models";
import { cloudEstimate } from "../providers/cloud-price";
import type { Project, Shot } from "./model";
import { renderSeconds } from "./references";

/**
 * Animate every still: the board's stills become video in one go, each from
 * its own picture at its own length, priced as a whole before anything runs.
 * Locked shots — title cards, black — are left as they are.
 */

export const ANIMATE_MODEL = "minimax/minimax-h3";

export type AnimatePlan = { shots: { id: string; index: number; beat: string; seconds: number; usd: number }[]; total: number };

const round = (n: number) => Math.round(n * 1000) / 1000;

export function readyToAnimate(shot: Shot): Shot {
  if (shot.model.id === ANIMATE_MODEL) return shot;
  return { ...shot, model: { id: ANIMATE_MODEL, settings: { resolution: "768P" } } };
}

export function animatePlan(project: Project): AnimatePlan {
  const duration = getModelCard(ANIMATE_MODEL).settings.duration;
  const shots = project.shots.flatMap((shot, index) => {
    if (shot.render?.kind !== "image" || shot.locked) return [];
    const ready = readyToAnimate(shot);
    const seconds = renderSeconds({ ...ready, seconds: ready.seconds ?? 4 }, duration as { type: string; min?: number; max?: number }) ?? 4;
    const resolution = String(ready.model.settings.resolution ?? "768P");
    // The still is the first frame; references beyond it are not sent with one, so they cost nothing here.
    return [{ id: shot.id, index, beat: shot.beat, seconds, usd: cloudEstimate({ seconds, resolution, references: 0 }) }];
  });
  return { shots, total: round(shots.reduce((n, s) => n + s.usd, 0)) };
}
