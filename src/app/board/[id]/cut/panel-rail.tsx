"use client";

import type { ReactNode } from "react";

import { STEPS, groupById, stepProgress, type Group, type GroupId } from "../../../../story/panel-guide";

const PATHS: Record<GroupId, ReactNode> = {
  timing: <><circle cx="12" cy="13" r="7.5" /><path d="M12 9v4l2.5 2M9.5 3h5" /></>,
  picture: <><rect x="3" y="4" width="18" height="16" rx="3" /><circle cx="9" cy="10" r="1.6" /><path d="m4 18 5-5 4 4 3-3 4 4" /></>,
  reframe: <><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" /><circle cx="12" cy="12" r="2" /></>,
  caption: <><rect x="3" y="5" width="18" height="14" rx="3" /><path d="M8 11.5c-1.5-1.5-3.5 0-2.5 1.8 1 1.6 3 .6 3-.3M16 11.5c-1.5-1.5-3.5 0-2.5 1.8 1 1.6 3 .6 3-.3" /></>,
  cut: <><circle cx="6" cy="7" r="2.5" /><circle cx="6" cy="17" r="2.5" /><path d="m8 8.5 12 8M8 15.5l12-8" /></>,
  continuity: <><rect x="3" y="7" width="8" height="10" rx="2" /><rect x="13" y="7" width="8" height="10" rx="2" /><path d="M11 12h2" /></>,
  look: <><path d="M12 3 3 8l9 5 9-5z" /><path d="m3 12 9 5 9-5M3 16l9 5 9-5" /></>,
  reshoot: <><path d="M4 12a8 8 0 0 1 14-5.3L20 9M20 4v5h-5M20 12a8 8 0 0 1-14 5.3L4 15M4 20v-5h5" /></>,
  voice: <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></>,
  edit: <><path d="m15 5 4 4L8 20H4v-4zM13 7l4 4" /></>,
  sound: <><path d="M4 10v4h4l5 4V6L8 10zM16.5 9a4 4 0 0 1 0 6M19 6.5a8 8 0 0 1 0 11" /></>,
  titles: <><path d="M5 6h14M12 6v13M9 19h6" /></>,
  review: <><path d="m5 12 4.5 4.5L19 7" /><rect x="3" y="3" width="18" height="18" rx="4" /></>,
  passes: <><path d="M4 7h16M4 12h16M4 17h10" /></>,
  more: <><path d="M5 5l14 7-14 7z" /></>,
};

export function RailIcon({ id, size = 22 }: { id: GroupId; size?: number }) {
  return <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{PATHS[id]}</svg>;
}

/** The big visual tiles for the tools used most. They open the same groups the rail does. */
export const TILES: GroupId[] = ["timing", "picture", "cut", "look"];

export function ToolRail({ rail, open, suggested, onOpen }: { rail: Group[]; open: GroupId; suggested: GroupId | null; onOpen: (id: GroupId) => void }) {
  return (
    <nav className="ed-rail" aria-label="Shot tool groups">
      {rail.map((g) => (
        <button key={g.id} type="button" className={`ed-rail-btn${open === g.id ? " on" : ""}${suggested === g.id ? " suggest" : ""}`} aria-current={open === g.id ? "true" : undefined} aria-label={g.label + (suggested === g.id ? " (suggested next)" : "")} title={g.hint} onClick={() => onOpen(g.id)}>
          <RailIcon id={g.id} />
          <span>{g.label}</span>
        </button>
      ))}
    </nav>
  );
}

/** A small "where am I" guide: three steps with progress dots and one suggested next group. It never blocks the rail. */
export function GuideCard({ rail, visited, open, suggested, onOpen }: { rail: Group[]; visited: GroupId[]; open: GroupId; suggested: GroupId | null; onOpen: (id: GroupId) => void }) {
  const steps = stepProgress(visited, rail, open);
  const next = suggested ? groupById(suggested) : null;
  return (
    <section className="ed-guide" aria-label="Next step guide">
      <ol className="ed-guide-steps">
        {steps.map((s, i) => (
          <li key={s.id} className={s.state} aria-current={s.state === "current" ? "step" : undefined}>
            <i aria-hidden="true">{s.state === "done" ? "✓" : i + 1}</i>
            <span>{s.label}</span>
            <small className="sr-only">{s.seen} of {s.total} opened</small>
          </li>
        ))}
      </ol>
      {next ? <button type="button" className="ed-guide-next" onClick={() => onOpen(next.id)}><small>Next step</small><b>{next.label}</b><span aria-hidden="true">→</span></button> : <p className="ed-guide-done">All tools opened. Pick any to go back.</p>}
      <p className="ed-guide-hint">{STEPS.find((s) => s.id === groupById(open).step)?.label}: {groupById(open).hint}</p>
    </section>
  );
}

export function ToolTiles({ rail, open, onOpen }: { rail: Group[]; open: GroupId; onOpen: (id: GroupId) => void }) {
  return (
    <div className="ed-tiles" role="group" aria-label="Most used tools">
      {TILES.filter((id) => rail.some((g) => g.id === id)).map((id) => (
        <button key={id} type="button" className={`ed-tile${open === id ? " on" : ""}`} aria-pressed={open === id} onClick={() => onOpen(id)}>
          <RailIcon id={id} size={28} />
          <span>{groupById(id).label}</span>
        </button>
      ))}
    </div>
  );
}

/** Shows only the open group's section of the Shot tab. */
export function Pane({ id, open, children }: { id: GroupId; open: GroupId; children: ReactNode }) {
  return open === id ? <div className="ed-pane" role="region" aria-label={groupById(id).label}>{children}</div> : null;
}
