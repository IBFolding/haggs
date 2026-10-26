import type { Kv } from "./kv";
import { localLinks, withLinks } from "./portable";
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

/**
 * Copies a file on this machine to the account's file store. It answers with the cloud address,
 * "never" when that file can't ever be kept (missing, wrong kind), or null to try again later.
 */
export type Portable = { keep(url: string): Promise<string | "never" | null>; perRound?: number };

const FILES = "sync/files";
const PENDING = "sync/pending";
const COPYING = "sync/copying";
/** The stamp this machine gave each project when it sent a copy with its files swapped in, so it does not pull that copy back. */
const SENT = "sync/sent";

export type Report = { pushed: number; pulled: number; removed: number; skipped: string[]; waiting: number };

export async function syncProjects(kv: Kv, store: ProjectStore, remote: Remote, portable?: Portable): Promise<Report> {
  const known = (await kv.get<string[]>(KNOWN)) ?? [];
  const local = (await store.list()).map(({ id, updatedAt }) => ({ id, updatedAt }));
  const sentStamps = (await kv.get<Record<string, number>>(SENT)) ?? {};
  const mine = new Map(local.map((x) => [x.id, x.updatedAt]));
  // A copy this machine sent itself, with its files swapped in, is the same project as the one here.
  const theirs = (await remote.list()).map((x) => (sentStamps[x.id] === x.updatedAt && mine.has(x.id) ? { id: x.id, updatedAt: mine.get(x.id)! } : x));
  const todo = plan(local, theirs, known);
  const report: Report = { pushed: 0, pulled: 0, removed: 0, skipped: [], waiting: 0 };

  // Projects whose files were only partly copied last time are sent again until they are whole.
  const stillHere = new Set(local.map((x) => x.id));
  // The first time files are copied, everything already in the account is sent once more, since it went up without them.
  const started = portable ? await kv.get<boolean>(COPYING) : true;
  if (portable && !started) await kv.set(COPYING, true);
  const pending = (started ? ((await kv.get<string[]>(PENDING)) ?? []) : [...stillHere]).filter((id) => stillHere.has(id));
  const toPush = [...new Set([...todo.push, ...(portable ? pending : [])])];
  const files = (await kv.get<Record<string, string>>(FILES)) ?? {};
  let budget = portable?.perRound ?? 20;
  const unfinished = new Set<string>();

  for (const id of toPush) {
    const project = await store.load(id);
    if (!project) continue;
    let sheets = (await kv.get<string>(`sheets/${id}`)) ?? null;
    let sent: Project = project;
    if (portable) {
      for (const url of localLinks([project, sheets])) {
        if (files[url] || budget <= 0) continue;
        budget -= 1;
        const kept = await portable.keep(url).catch(() => null);
        if (kept) {
          files[url] = kept;
          // Remembered at once: a tab closed or reloaded mid-round must not copy this file again.
          await kv.set(FILES, files);
        }
      }
      const cloud = Object.fromEntries(Object.entries(files).filter(([, v]) => v !== "never"));
      sent = withLinks(project, cloud);
      sheets = sheets === null ? null : withLinks(sheets, cloud);
      const left = localLinks([project, sheets]).filter((url) => !files[url]).length;
      if (left) unfinished.add(id);
      report.waiting += left;
    }
    // A copy with files swapped in is stamped newer, so a device that already holds the version without them takes it.
    if (sent !== project && JSON.stringify(sent) !== JSON.stringify(project)) {
      sent = { ...sent, updatedAt: Math.max(Date.now(), project.updatedAt + 1) };
    }
    if (JSON.stringify(sent).length + (sheets?.length ?? 0) > MAX_BYTES) { report.skipped.push(project.name); continue; }
    await remote.put(sent, sheets);
    if (sent.updatedAt !== project.updatedAt) sentStamps[id] = sent.updatedAt;
    report.pushed += 1;
  }
  if (portable) {
    await kv.set(FILES, files);
    await kv.set(SENT, sentStamps);
    await kv.set(PENDING, [...unfinished]);
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
