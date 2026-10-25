import type { Run } from "./runs";

/**
 * Photos and Video are workbenches, not archives: they show what you are making
 * now. Everything you have ever made is in the Gallery.
 */

type Tab = Pick<Storage, "getItem" | "setItem">;

const KEY = "haggs:work-since";

/** When this tab's stretch of work began. It is set once and survives a refresh. */
export function workSince(tab: Tab, now: number): number {
  try {
    const held = Number(tab.getItem(KEY));
    if (Number.isFinite(held) && held > 0) return held;
    tab.setItem(KEY, String(now));
  } catch {
    /* Storage can be blocked; this load still gets a start time. */
  }
  return now;
}

/** The runs of one kind made since the stretch began, plus one run just sent back from the Gallery. */
export function currentWork<T extends Run>(runs: T[], kind: Run["kind"], since: number, reused?: string): T[] {
  return runs.filter((run) => run.kind === kind && (run.at >= since || run.id === reused));
}
