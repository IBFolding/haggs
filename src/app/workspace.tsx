"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { defaultKv } from "../story/kv";
import {
  CARD_H, CARD_W, addNote, editNote, empty, groupCards, moveCard, moveFrame, moveNote, parse, place, prune, removeFrame, removeNote, renameFrame, resizeFrame,
  type Layout,
} from "../story/workspace";

export type WorkItem = { id: string; src: string; kind: "image" | "video"; tag?: string; title?: string; usd?: number | null; at?: number };

/**
 * A free table for the pictures you are working with: drag them around, group
 * them into named frames, jot notes between them, and send any picture back to
 * the box as a reference. The layout is kept in this browser per page.
 */
export function Workspace({ storeKey, items, onUse, onStart }: { storeKey: string; items: WorkItem[]; onUse: (src: string) => void; onStart?: (layout: Layout, name: string) => void }) {
  const kv = useMemo(() => defaultKv(), []);
  const [layout, setLayout] = useState<Layout>(empty());
  const [ready, setReady] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [naming, setNaming] = useState<string | null>(null);
  const drag = useRef<null | { kind: "card" | "frame" | "note" | "size"; id: string; x: number; y: number; moved: boolean; ids?: string[] }>(null);
  const ids = useMemo(() => items.map((i) => i.id), [items]);

  useEffect(() => {
    let live = true;
    void kv.get<unknown>(storeKey).then((v) => { if (live) { setLayout(parse(v)); setReady(true); } }).catch(() => setReady(true));
    return () => { live = false; };
  }, [kv, storeKey]);

  // New pictures get a free cell; ones that left the page are forgotten.
  useEffect(() => {
    if (!ready) return;
    setLayout((l) => place(prune(l, ids), ids));
  }, [ready, ids]);

  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => void kv.set(storeKey, layout).catch(() => undefined), 400);
    return () => clearTimeout(t);
  }, [kv, storeKey, layout, ready]);

  const begin = (e: React.PointerEvent, kind: "card" | "frame" | "note" | "size", id: string) => {
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    let group: string[] | undefined;
    if (kind === "card") {
      group = picked.has(id) ? [...picked] : [id];
      if (!picked.has(id) && !(e.shiftKey || e.metaKey)) setPicked(new Set([id]));
    }
    drag.current = { kind, id, x: e.clientX, y: e.clientY, moved: false, ...(group ? { ids: group } : {}) };
  };
  const track = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) < 4) return;
    d.moved = true;
    d.x = e.clientX;
    d.y = e.clientY;
    setLayout((l) => {
      if (d.kind === "card") return (d.ids ?? [d.id]).reduce((acc, id) => { const c = acc.cards[id]; return c ? moveCard(acc, id, Math.max(0, c.x + dx), Math.max(0, c.y + dy)) : acc; }, l);
      if (d.kind === "frame") return moveFrame(l, d.id, dx, dy);
      if (d.kind === "note") { const n = l.notes.find((x) => x.id === d.id); return n ? moveNote(l, d.id, Math.max(0, n.x + dx), Math.max(0, n.y + dy)) : l; }
      const f = l.frames.find((x) => x.id === d.id);
      return f ? resizeFrame(l, d.id, f.w + dx, f.h + dy) : l;
    });
  };
  const end = (e: React.PointerEvent, id?: string) => {
    const d = drag.current;
    drag.current = null;
    if (d && !d.moved && d.kind === "card" && id && (e.shiftKey || e.metaKey)) {
      setPicked((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
    }
  };

  const group = useCallback(() => {
    if (picked.size === 0) return;
    setLayout((l) => groupCards(l, [...picked], "Group"));
    setPicked(new Set());
  }, [picked]);

  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const chosen = [...picked].map((id) => byId.get(id)).filter((i): i is WorkItem => Boolean(i));
  const width = Math.max(1400, ...Object.values(layout.cards).map((c) => c.x + CARD_W + 80), ...layout.frames.map((f) => f.x + f.w + 80));
  const height = Math.max(700, ...Object.values(layout.cards).map((c) => c.y + CARD_H + 80), ...layout.frames.map((f) => f.y + f.h + 80));

  return (
    <div className="ws" aria-label="Workspace">
      <div className="ws-bar">
        <span className="ws-hint">{picked.size ? `${picked.size} selected` : "Drag to arrange. Shift-click to pick several."}</span>
        <button className="plain" disabled={picked.size === 0} onClick={group}>Group</button>
        <button className="plain" disabled={chosen.filter((c) => c.kind === "image").length === 0} onClick={() => chosen.filter((c) => c.kind === "image").forEach((c) => onUse(c.src))}>Use as reference</button>
        <button className="plain" onClick={() => setLayout((l) => addNote(l, "", 60 + l.notes.length * 24, 60 + l.notes.length * 24))}>Add note</button>
        {picked.size > 0 && <button className="plain" onClick={() => setPicked(new Set())}>Clear</button>}
        {onStart && naming === null && (
          <button className="plain ws-start" disabled={items.length === 0} onClick={() => setNaming(layout.frames[0]?.name && layout.frames[0].name !== "Group" ? layout.frames[0].name : "Workspace")}>
            Start a project
          </button>
        )}
        {onStart && naming !== null && (
          <form className="ws-name" onSubmit={(e) => { e.preventDefault(); onStart(layout, naming); setNaming(null); }}>
            <input autoFocus value={naming} maxLength={60} aria-label="Project name" onChange={(e) => setNaming(e.target.value)} />
            <button className="fire" type="submit">Create</button>
            <button className="plain" type="button" onClick={() => setNaming(null)}>Cancel</button>
          </form>
        )}
      </div>
      <div className="ws-scroll" onPointerDown={() => setPicked(new Set())}>
        <div className="ws-canvas" style={{ width, height }} onPointerMove={track}>
          {layout.frames.map((f) => (
            <div key={f.id} className="ws-frame" style={{ left: f.x, top: f.y, width: f.w, height: f.h }} onPointerDown={(e) => e.stopPropagation()}>
              <div className="ws-frame-head" onPointerDown={(e) => begin(e, "frame", f.id)} onPointerMove={track} onPointerUp={(e) => end(e)}>
                <input
                  value={f.name}
                  aria-label="Group name"
                  onPointerDown={(e) => e.stopPropagation()}
                  onChange={(e) => setLayout((l) => renameFrame(l, f.id, e.target.value))}
                />
                <button title="Ungroup" onPointerDown={(e) => e.stopPropagation()} onClick={() => setLayout((l) => removeFrame(l, f.id))}>×</button>
              </div>
              <span className="ws-size" onPointerDown={(e) => begin(e, "size", f.id)} onPointerMove={track} onPointerUp={(e) => end(e)} />
            </div>
          ))}
          {items.map((it) => {
            const at = layout.cards[it.id];
            if (!at) return null;
            return (
              <figure
                key={it.id}
                className={`ws-card${picked.has(it.id) ? " on" : ""}`}
                style={{ left: at.x, top: at.y, width: CARD_W, height: CARD_H }}
                onPointerDown={(e) => begin(e, "card", it.id)}
                onPointerMove={track}
                onPointerUp={(e) => end(e, it.id)}
                title={it.title}
              >
                {it.kind === "video" ? <video src={it.src} muted loop playsInline draggable={false} onMouseOver={(e) => void e.currentTarget.play()} onMouseOut={(e) => e.currentTarget.pause()} /> : <img src={it.src} alt={it.title ?? ""} draggable={false} />}
                {it.tag && <span className="ws-tag">{it.tag}</span>}
              </figure>
            );
          })}
          {layout.notes.map((n) => (
            <div key={n.id} className="ws-note" style={{ left: n.x, top: n.y }} onPointerDown={(e) => e.stopPropagation()}>
              <div className="ws-note-head" onPointerDown={(e) => begin(e, "note", n.id)} onPointerMove={track} onPointerUp={(e) => end(e)}>
                Note
                <button title="Delete note" onPointerDown={(e) => e.stopPropagation()} onClick={() => setLayout((l) => removeNote(l, n.id))}>×</button>
              </div>
              <textarea value={n.text} placeholder="Idea, prompt, reminder…" onChange={(e) => setLayout((l) => editNote(l, n.id, e.target.value))} />
            </div>
          ))}
          {items.length === 0 && layout.notes.length === 0 && <p className="ws-empty">Nothing here yet. Make or attach a picture and it lands on the table.</p>}
        </div>
      </div>
    </div>
  );
}
