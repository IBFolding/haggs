"use client";

import { useRef, useState, type DragEvent, type ReactNode } from "react";

import { checkDrop, dragHasFiles, type DropRules } from "../story/drop-files";

const acceptOf = (rules: DropRules) => rules.mimes?.join(",") ?? rules.kinds.map((k) => `${k}/*`).join(",");

/**
 * Lets a spot take files dragged in from the desktop. It only reports valid files; what happens next
 * is the caller's existing upload code. A drop never starts anything that costs money by itself.
 * Drags from inside the app (a shelf item onto the picture) carry no files and pass straight through.
 */
export function useFileDrop(rules: DropRules, onFiles: (files: File[]) => void, disabled = false) {
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const depth = useRef(0);
  const live = useRef({ rules, onFiles });
  live.current = { rules, onFiles };
  const carries = (e: DragEvent) => !disabled && dragHasFiles(e.dataTransfer?.types);
  const props = {
    onDragEnter: (e: DragEvent) => { if (!carries(e)) return; e.preventDefault(); depth.current += 1; setActive(true); setError(null); },
    onDragOver: (e: DragEvent) => { if (!carries(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = "copy"; },
    onDragLeave: (e: DragEvent) => { if (!carries(e)) return; depth.current = Math.max(0, depth.current - 1); if (depth.current === 0) setActive(false); },
    onDrop: (e: DragEvent) => {
      if (!carries(e)) return;
      e.preventDefault(); e.stopPropagation();
      depth.current = 0; setActive(false);
      const result = checkDrop(Array.from(e.dataTransfer.files), live.current.rules);
      setError(result.error);
      if (result.accepted.length) live.current.onFiles(result.accepted);
    },
  };
  return { active, error, setError, props };
}

/** The same check for files chosen with the picker, so both ways in give the same message. */
export function useFileChoose(rules: DropRules, onFiles: (files: File[]) => void) {
  const [error, setError] = useState<string | null>(null);
  return { error, choose: (list: FileList | null) => { const result = checkDrop(Array.from(list ?? []), rules); setError(result.error); if (result.accepted.length) onFiles(result.accepted); } };
}

/** A visible overlay while a file is dragged over an existing area. Put it inside a position:relative parent. */
export function DropOverlay({ active, label }: { active: boolean; label: string }) {
  return active ? <div className="dz-overlay" aria-hidden="true"><span>{label}</span></div> : null;
}

export function DropError({ error }: { error: string | null }) {
  return error ? <p className="dz-error library-error" role="alert">{error}</p> : null;
}

/** A permanent drop zone: drag a file in from the desktop, or click it to choose one. */
export function DropZone({ rules, onFiles, label, hint, sub, busy = false, disabled = false, className = "", children }: {
  rules: DropRules; onFiles: (files: File[]) => void; label: string; hint?: string; sub?: string; busy?: boolean; disabled?: boolean; className?: string; children?: ReactNode;
}) {
  const input = useRef<HTMLInputElement>(null);
  const { active, error, setError, props } = useFileDrop(rules, onFiles, disabled || busy);
  return (
    <div className={`dz${active ? " over" : ""}${className ? ` ${className}` : ""}`} {...props}>
      <button type="button" className="dz-pick" disabled={disabled || busy} onClick={() => input.current?.click()}>
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3" /><circle cx="9" cy="10" r="1.6" /><path d="m4 18 5-5 4 4 3-3 4 4" /></svg>
        <b>{busy ? "Adding…" : active ? "Drop to add" : label}</b>
        {hint && <small>{hint}</small>}
        {sub && <small>{sub}</small>}
      </button>
      <input ref={input} type="file" hidden multiple={rules.multiple === true} accept={acceptOf(rules)} aria-label={label} onChange={(e) => {
        const result = checkDrop(Array.from(e.target.files ?? []), rules);
        e.target.value = "";
        setError(result.error);
        if (result.accepted.length) onFiles(result.accepted);
      }} />
      {children}
      <DropError error={error} />
    </div>
  );
}
