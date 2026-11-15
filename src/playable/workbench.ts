import { readSpec, slotsOf, type GameSpec } from './spec';

export type DesignBrief = { hook: string; goal: string; controls: string; progression: string; artDirection: string };
export type RunReport = { revision: string; startedAt: number; ready: boolean; started: boolean; seconds: number; score: number | null; outcome: 'playing' | 'won' | 'lost' | 'error'; errors: string[] };
export type Checkpoint = { id: string; name: string; at: number; spec: GameSpec };
export type Review = { revision: string; at: number; controls: boolean; goal: boolean; progression: boolean; notes: string; run?: RunReport };
export type Workbench = { brief: DesignBrief; checkpoints: Checkpoint[]; reviews: Review[] };
export const REVIEW_LIMIT = 20;
const short = (v: unknown, limit = 600) => typeof v === 'string' ? v.trim().slice(0, limit) : '';
const object = (v: unknown): Record<string, unknown> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {};

/** Change detection only, never an authorization or content-integrity boundary. Includes art changes. */
export function revisionOf(spec: GameSpec): string {
  let n = 2166136261;
  const s = JSON.stringify(spec);
  for (let i = 0; i < s.length; i++) { n ^= s.charCodeAt(i); n = Math.imul(n, 16777619); }
  return (n >>> 0).toString(16).padStart(8, '0');
}
export function briefOf(spec: GameSpec): DesignBrief {
  return { hook: spec.pitch, goal: spec.template === 'code' ? '' : spec.text.win, controls: spec.template === 'code' ? spec.controls : '', progression: '', artDirection: 'Keep the cast, palette and visual language consistent.' };
}
export function readBrief(value: unknown): DesignBrief {
  const v = object(value);
  return { hook: short(v.hook), goal: short(v.goal), controls: short(v.controls), progression: short(v.progression), artDirection: short(v.artDirection) };
}
export function readRun(value: unknown): RunReport | undefined {
  const v = object(value);
  if (typeof v.revision !== 'string' || !/^[a-f0-9]{8}$/.test(v.revision) || !Number.isFinite(v.startedAt)) return;
  return { revision: v.revision, startedAt: Number(v.startedAt), ready: v.ready === true, started: v.started === true, seconds: Math.max(0, Math.min(86400, Number(v.seconds) || 0)), score: typeof v.score === 'number' && Number.isFinite(v.score) ? v.score : null, outcome: ['won','lost','error'].includes(String(v.outcome)) ? v.outcome as RunReport['outcome'] : 'playing', errors: Array.isArray(v.errors) ? v.errors.slice(0, 8).map(x => short(x, 500)).filter(Boolean) : [] };
}
export function readWorkbench(value: unknown, spec: GameSpec): Workbench {
  const v = object(value);
  const checkpoints = (Array.isArray(v.checkpoints) ? v.checkpoints : []).slice(-10).flatMap(x => {
    const c = object(x); if (typeof c.id !== 'string' || !short(c.name,60) || !Number.isFinite(c.at)) return [];
    try { return [{ id: c.id.slice(0,80), name: short(c.name,60), at: Number(c.at), spec: readSpec(c.spec) }]; } catch { return []; }
  });
  const reviews = (Array.isArray(v.reviews) ? v.reviews : []).slice(-REVIEW_LIMIT).flatMap(x => {
    const r = object(x); if (typeof r.revision !== 'string' || !/^[a-f0-9]{8}$/.test(r.revision) || !Number.isFinite(r.at)) return [];
    const run = readRun(r.run);
    return [{ revision: r.revision, at: Number(r.at), controls: r.controls === true, goal: r.goal === true, progression: r.progression === true, notes: short(r.notes,2000), ...(run?.revision === r.revision ? { run } : {}) }];
  });
  return { brief: v.brief ? readBrief(v.brief) : briefOf(spec), checkpoints, reviews };
}
export function repairBrief(spec: GameSpec, workspace: Workbench): string {
  const revision = revisionOf(spec);
  const review = [...workspace.reviews].reverse().find(x => x.revision === revision);
  return [`Improve this game against its design brief. Preserve unrelated mechanics and existing asset IDs.`, ...Object.entries(workspace.brief).map(([k,v]) => `${k}: ${v || 'Not specified'}`), review ? `Human review (not an automated quality score): controls ${review.controls?'passed':'needs work'}, goal ${review.goal?'passed':'needs work'}, progression ${review.progression?'passed':'needs work'}. ${review.notes}` : 'No human review for this revision yet.', review?.run ? `Observed game-reported run: ${JSON.stringify(review.run)}. This telemetry is diagnostic, not a proof of fairness or quality.` : '', 'Return a complete game. Do not start asset generation or spend Comfy credits.'].filter(Boolean).join('\n\n');
}
export function exportPlayable(spec: GameSpec, workbench: Workbench) {
  return { format: 'haggs.playable/1', exportedAt: new Date().toISOString(), spec, workbench: readWorkbench(workbench,spec) };
}
export function importPlayable(value: unknown): { spec: GameSpec; workbench: Workbench } {
  const v = object(value);
  if (v.format !== 'haggs.playable/1') throw new Error('Choose a Haggs Playable project JSON.');
  const spec = readSpec(v.spec);
  return { spec, workbench: readWorkbench(v.workbench,spec) };
}
export function assetReadiness(spec: GameSpec) {
  const slots = slotsOf(spec);
  return { total: slots.length, ready: slots.filter(s => s.art.url).length };
}

/** Validated game events are observations, not a quality or authorization signal. */
export function recordEvent(run: RunReport, event: unknown, now: number): RunReport | undefined {
  const e = object(event);
  if (e.type === 'ready') return { revision: run.revision, startedAt: now, ready: true, started: false, seconds: 0, score: null, outcome: 'playing', errors: [] };
  if (e.type === 'started') return { ...run, started: true, startedAt: now, seconds: 0 };
  const next = { ...run, seconds: Math.max(0,Math.round((now-run.startedAt)/100)/10) };
  if (e.type === 'error') return { ...next, outcome: 'error', errors: [...run.errors,short(e.message,500)||'Runtime error'].slice(-8) };
  if (run.outcome !== 'playing') return;
  if (e.type === 'score' && typeof e.score === 'number' && Number.isFinite(e.score)) return { ...next, score: e.score };
  if (e.type === 'end' && typeof e.won === 'boolean' && typeof e.score === 'number' && Number.isFinite(e.score)) return { ...next, score: e.score, outcome: e.won ? 'won' : 'lost' };
  return;
}
