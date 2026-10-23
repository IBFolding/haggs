import type { Kv } from "./kv";
import type { Project } from "./model";

/** A named copy of a board's cut, kept so an edit can always be gone back on. */
export type Version = { id: string; name: string; at: string; auto: boolean; project: Project };

export const KEEP = 15;

const key = (projectId: string, boardId: string | undefined) => `versions/${projectId}/${boardId ?? "main"}`;

export async function listVersions(kv: Kv, projectId: string, boardId?: string): Promise<Version[]> {
  return (await kv.get<Version[]>(key(projectId, boardId))) ?? [];
}

/** Save a copy, newest first. Over KEEP, the oldest unnamed (auto) copy goes first, then the oldest. */
export async function saveVersion(kv: Kv, projectId: string, boardId: string | undefined, project: Project, name: string, auto = false, now = new Date()): Promise<Version[]> {
  const list = await listVersions(kv, projectId, boardId);
  const made: Version = { id: `v${now.getTime().toString(36)}${list.length}`, name: name.trim() || (auto ? "Before a restore" : "Version"), at: now.toISOString(), auto, project: structuredClone(project) };
  const next = [made, ...list];
  while (next.length > KEEP) {
    const drop = [...next].reverse().find((v) => v.auto) ?? next[next.length - 1]!;
    next.splice(next.indexOf(drop), 1);
  }
  await kv.set(key(projectId, boardId), next);
  return next;
}

export async function removeVersion(kv: Kv, projectId: string, boardId: string | undefined, versionId: string): Promise<Version[]> {
  const next = (await listVersions(kv, projectId, boardId)).filter((v) => v.id !== versionId);
  await kv.set(key(projectId, boardId), next);
  return next;
}

/** Go back to a version. The cut as it is now is kept first as a safety copy, so a restore can itself be undone. */
export async function restoreVersion(kv: Kv, projectId: string, boardId: string | undefined, versionId: string, current: Project): Promise<{ project: Project; versions: Version[] } | null> {
  const found = (await listVersions(kv, projectId, boardId)).find((v) => v.id === versionId);
  if (!found) return null;
  const versions = await saveVersion(kv, projectId, boardId, current, `Before restoring “${found.name}”`, true);
  return { project: structuredClone(found.project), versions };
}
