"use client";

import { useEffect, useState, type ReactNode } from "react";

/** A remembered open/closed flag. Falls back to the default when storage is blocked. */
export function usePersistedFlag(key: string, initial: boolean): [boolean, (next: boolean) => void] {
  const [open, setOpen] = useState(initial);
  useEffect(() => { try { const saved = localStorage.getItem(key); if (saved !== null) setOpen(saved === "true"); } catch { /* Storage may be blocked. */ } }, [key]);
  return [open, (next) => { setOpen(next); try { localStorage.setItem(key, String(next)); } catch { /* Session-only. */ } }];
}

/** A titled panel that folds. The content stays mounted, so an upload in progress is never lost. */
export function Collapsible({ id, title, defaultOpen = true, children, className = "" }: { id: string; title: string; defaultOpen?: boolean; children: ReactNode; className?: string }) {
  const [open, setOpen] = usePersistedFlag(`haggs.grey.${id}`, defaultOpen);
  return (
    <section className={`gw-fold${className ? ` ${className}` : ""}`} data-open={open}>
      <button type="button" className="gw-fold-head" aria-expanded={open} aria-controls={`gw-fold-${id}`} onClick={() => setOpen(!open)}>
        <b>{title}</b><span aria-hidden="true">{open ? "⌃" : "⌄"}</span>
      </button>
      <div id={`gw-fold-${id}`} className="gw-fold-body" hidden={!open}>{children}</div>
    </section>
  );
}

/** "More options": everything past the one main action of a step, folded away until asked for. */
export function MoreOptions({ children, label = "More options", open }: { children: ReactNode; label?: string; open?: boolean }) {
  return <details className="gw-more" {...(open ? { open: true } : {})}><summary>{label}</summary><div className="gw-more-body">{children}</div></details>;
}
