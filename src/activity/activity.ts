/**
 * What is running in the background, so you can leave the page that started
 * it. Lives outside React, so it survives moving between pages; the header
 * shows it. A reload forgets what was running, because the work was in the
 * page that is gone.
 */

export type Job = {
  id: string;
  label: string;
  /** The page to go back to. */
  href?: string;
  state: "running" | "done" | "failed";
  startedAt: number;
  endedAt?: number;
  /** Why it failed. */
  note?: string;
  /** A file it made, to watch or save. */
  url?: string;
  seen: boolean;
};

export type Options<T> = {
  label: string;
  href?: string;
  /** Pull a file out of the result. */
  result?: (value: T) => { url?: string } | null | undefined;
  /** Say why a result that didn't throw still didn't work; null when it did. */
  failure?: (value: T) => string | null;
  /** Runs once when the work succeeds, for example to keep what it made in the Gallery. */
  after?: (value: T) => void;
};

const KEEP = 12;
let list: Job[] = [];
let version = 0;
const listeners = new Set<() => void>();

const emit = () => {
  version += 1;
  list = [...list];
  for (const fn of listeners) fn();
};

export const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => void listeners.delete(fn);
};
export const jobs = (): readonly Job[] => list;
export const runningCount = () => list.filter((j) => j.state === "running").length;
export const unseenCount = () => list.filter((j) => j.state !== "running" && !j.seen).length;
export const snapshotVersion = () => version;

export function markSeen() {
  if (!list.some((j) => j.state !== "running" && !j.seen)) return;
  list = list.map((j) => (j.state === "running" ? j : { ...j, seen: true }));
  emit();
}
export function dismiss(id: string) {
  list = list.filter((j) => j.id !== id);
  emit();
}
export function clearFinished() {
  list = list.filter((j) => j.state === "running");
  emit();
}
export function reset() {
  list = [];
  emit();
}

let counter = 0;
const settle = (id: string, change: Partial<Job>) => {
  list = list.map((j) => (j.id === id ? { ...j, ...change, endedAt: Date.now(), seen: false } : j));
  // Keep the newest few; a running job is never the one dropped.
  const finished = list.filter((j) => j.state !== "running");
  if (finished.length > KEEP) {
    const drop = new Set(finished.slice(KEEP).map((j) => j.id));
    list = list.filter((j) => !drop.has(j.id));
  }
  emit();
};

/** Run `work` and show it in the header until it ends. Returns what `work` returns, and throws what it throws. */
export async function track<T>(options: Options<T>, work: Promise<T> | (() => Promise<T>)): Promise<T> {
  counter += 1;
  const id = `job-${Date.now()}-${counter}`;
  list = [{ id, label: options.label, ...(options.href ? { href: options.href } : {}), state: "running", startedAt: Date.now(), seen: true }, ...list];
  emit();
  try {
    const value = await (typeof work === "function" ? work() : work);
    const why = options.failure?.(value) ?? null;
    const made = options.result?.(value);
    if (why) settle(id, { state: "failed", note: why });
    else {
      settle(id, { state: "done", ...(made?.url ? { url: made.url } : {}) });
      try { options.after?.(value); } catch { /* keeping a copy must never fail the run */ }
    }
    return value;
  } catch (error) {
    settle(id, { state: "failed", note: error instanceof Error ? error.message : "It didn't finish." });
    throw error;
  }
}
