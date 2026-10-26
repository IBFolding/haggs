"use client";
import { useEffect, useState, type ReactNode } from "react";

export function Section({ name, children, initial = false, classic = false, reveal = 0 }: {
  name: string; children: ReactNode; initial?: boolean; classic?: boolean; reveal?: number;
}) {
  const [open, setOpen] = useState(initial);
  useEffect(() => {
    try { const saved = localStorage.getItem(`haggs.cut.section.${name}`); if (saved !== null) setOpen(saved === "true"); } catch {}
  }, [name]);
  useEffect(() => { if (reveal) setOpen(true); }, [reveal]);
  if (classic) return <>{children}</>;
  return <details className="ed-section" open={open}>
    <summary aria-label={name} onClick={(e) => {
      e.preventDefault();
      const next = !open;
      setOpen(next);
      // Persist an explicit choice, never a mount-time native toggle event.
      try { localStorage.setItem(`haggs.cut.section.${name}`, String(next)); } catch {}
    }}>{name}<span className="ed-section-state" aria-hidden="true">{open ? "Collapse −" : "Expand +"}</span></summary>
    <div>{children}</div>
  </details>;
}
