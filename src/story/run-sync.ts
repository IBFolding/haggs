/**
 * Keeps the Gallery the same on every device. A run has a revision (the time
 * it last changed); the newer side wins, and a deletion travels as a marker
 * so a device that still has the run doesn't send it back.
 */

export type Stamp = { id: string; rev: number; deleted?: boolean };
export type RunPlan = { push: string[]; pull: string[]; removeLocal: string[]; markDeleted: string[] };

/** `deletedHere` is every run you removed on this device that the account hasn't been told about. */
export function planRuns(local: Stamp[], remote: Stamp[], deletedHere: string[]): RunPlan {
  const out: RunPlan = { push: [], pull: [], removeLocal: [], markDeleted: [] };
  const l = new Map(local.map((x) => [x.id, x]));
  const r = new Map(remote.map((x) => [x.id, x]));
  for (const id of deletedHere) if (!r.get(id)?.deleted) out.markDeleted.push(id);
  const gone = new Set(deletedHere);
  for (const [id, mine] of l) {
    const theirs = r.get(id);
    if (!theirs) out.push.push(id);
    else if (theirs.deleted) out.removeLocal.push(id);
    else if (mine.rev > theirs.rev) out.push.push(id);
    else if (theirs.rev > mine.rev) out.pull.push(id);
  }
  for (const [id, theirs] of r) {
    if (l.has(id) || theirs.deleted || gone.has(id)) continue;
    out.pull.push(id);
  }
  return out;
}
