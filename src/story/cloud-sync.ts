import type { Kv } from "./kv";
import type { Project } from "./model";
import type { ProjectStore } from "./store";

/**
 * Projects follow you across devices when you are signed in. The newest copy
 * wins, a project deleted on one device is deleted on the others, and nothing
 * leaves this browser until you sign in.
 */

export type Stamp = { id: string; updatedAt: number };
export type Remote = {
  list(): Promise<Stamp[]>;
  get(id: string): Promise<{ project: Project; sheets: string | null } | null>;
  put(project: Project, sheets: string | null): Promise<void>;
  remove(id: string): Promise<void>;
};

export type Plan = { push: string[]; pull: string[]; removeRemote: string[] };

/** What to do given what each side has, and what was there the last time they agreed (`known`). Deletions only travel from here to the account. */
export function plan(local: Stamp[], remote: Stamp[], known: string[]): Plan {
  const l = new Map(local.map((s) => [s.id, s.updatedAt]));
  const r = new Map(remote.map((s) => [s.id, s.updatedAt]));
  const was = new Set(known);
  const out: Plan = { push: [], pull: [], removeRemote: [] };
  for (const [id, at] of l) {
    const theirs = r.get(id);
    // Missing from the account: upload it. A project here is never deleted because the account lacks it
    // (a signed-out request also reads as an empty account), only because you deleted it.
    if (theirs === undefined) out.push.push(id);
    else if (at > theirs) out.push.push(id);
    else if (theirs > at) out.pull.push(id);
  }
  for (const [id] of r) {
    if (l.has(id)) continue;
    if (was.has(id)) out.removeRemote.push(id); // it was in both, now gone from here: deleted here
    else out.pull.push(id);
  }
  return out;
}

const KNOWN = "sync/known";
const MAX_BYTES = 4 * 1024 * 1024;

export type Report = { pushed: number; pulled: number; removed: number; skipped: string[] };

export async function syncProjects(kv: Kv, store: ProjectStore, remote: Remote): Promise<Report> {
  const known = (await kv.get<string[]>(KNOWN)) ?? [];
  const local = (await store.list()).map(({ id, updatedAt }) => ({ id, updatedAt }));
  const todo = plan(local, await remote.list(), known);
  const report: Report = { pushed: 0, pulled: 0, removed: 0, skipped: [] };

  for (const id of todo.push) {
    const project = await store.load(id);
    if (!project) continue;
    const sheets = (await kv.get<string>(`sheets/${id}`)) ?? null;
    if (JSON.stringify(project).length + (sheets?.length ?? 0) > MAX_BYTES) { report.skipped.push(project.name); continue; }
    await remote.put(project, sheets);
    report.pushed += 1;
  }
  for (const id of todo.pull) {
    const got = await remote.get(id);
    if (!got) continue;
    await store.keep(got.project);
    if (got.sheets) await kv.set(`sheets/${id}`, got.sheets);
    report.pulled += 1;
  }
  for (const id of todo.removeRemote) { await remote.remove(id); report.removed += 1; }

  // Next time, what both sides have now is what they agree on.
  const here = new Set((await store.list()).map((x) => x.id));
  await kv.set(KNOWN, (await remote.list()).map((x) => x.id).filter((id) => here.has(id)));
  return report;
}
