"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { defaultKv } from "../story/kv";
import {
  CARD_H, CARD_W, addNote, editNote, empty, groupCards, moveCard, moveFrame, moveNote, parse, place, removeFrame, removeNote, renameFrame, resizeFrame,
  membersOf, setFrameMembers, arrange, type CardSize, type Layout,
} from "../story/workspace";

export type WorkItem = { id: string; src: string; kind: "image" | "video" | "audio"; tag?: string; title?: string; usd?: number | null; at?: number };

/**
 * A free table for the pictures you are working with: drag them around, group
 * them into named frames, jot notes between them, and send any picture back to
 * the box as a reference. The layout is kept in this browser per page.
 */
export function Workspace({ storeKey, items, onUse, onStart, renderItem, visibleIds, onBack }: { onBack?:()=>void; renderItem?: (item: WorkItem) => ReactNode; visibleIds?: string[]; storeKey: string; items: WorkItem[]; onUse?: (src: string) => void; onStart?: (layout: Layout, name: string) => void }) {
  const kv = useMemo(() => defaultKv(), []);
  const [layout, setLayout] = useState<Layout>(empty());
  const scroll=useRef<HTMLDivElement>(null),canvas=useRef<HTMLDivElement>(null);
  const history=useRef<Layout[]>([]),beforeDrag=useRef<Layout|null>(null);
  const [undoCount,setUndoCount]=useState(0),[notice,setNotice]=useState("");
  const current=useRef(layout);current.current=layout;
  const remember=(value:Layout)=>{history.current=[...history.current,value].slice(-20);setUndoCount(history.current.length);};
  const commit=(update:(l:Layout)=>Layout)=>{remember(current.current);setLayout(update);};
  const undo=()=>{const previous=history.current.pop();if(previous){setLayout(previous);setUndoCount(history.current.length);setNotice("Layout restored. Media is unchanged.");}};
  const measured=():Record<string,CardSize>=>Object.fromEntries(Array.from(canvas.current?.querySelectorAll<HTMLElement>('[data-workspace-card]')??[]).map(el=>[el.dataset.workspaceCard!,{w:el.offsetWidth/(renderItem?1.4:1),h:el.offsetHeight/(renderItem?2.2:1.3)}]));
  const tidy=()=>{commit(l=>arrange(l,measured(),(scroll.current?.clientWidth??1000)/(renderItem?1.4:1)));scroll.current?.scrollTo({top:0,left:0});setNotice("Auto-arranged all cards and groups. Undo restores your placement.");};
  const [cardSizes,setCardSizes]=useState<Record<string,CardSize>>({});
  const [ready, setReady] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [targetGroup, setTargetGroup] = useState("");
  const [saveError, setSaveError] = useState(false);
  const [naming, setNaming] = useState<string | null>(null);
  const drag = useRef<null | { kind: "card" | "frame" | "note" | "size"; id: string; x: number; y: number; moved: boolean; ids?: string[] }>(null);
  const ids = useMemo(() => items.map((i) => i.id), [items]);

  useEffect(() => {
    let live = true;
    void Promise.all([kv.get<unknown>(storeKey),kv.get<{undo?:Layout[];picked?:string[]}>(`${storeKey}/view`)]).then(([v,view]) => { if (live) { setLayout(parse(v)); history.current=(view?.undo??[]).slice(-20).map(parse);setUndoCount(history.current.length);setPicked(new Set(view?.picked??[]));setReady(true); } }).catch(() => {if(live)setReady(true);});
    return () => { live = false; };
  }, [kv, storeKey]);

  // Visibility and filters never erase saved positions or membership.
  useEffect(() => {
    if (!ready) return;
    setLayout((l) => place(l, ids));
  }, [ready, ids]);

  useEffect(() => {
    if (!ready) return;
    // Start the transaction now, so changing views cannot cancel a pending debounce.
    let live = true;
    void kv.set(storeKey, layout).then(() => { if (live) setSaveError(false); }).catch(() => { if (live) setSaveError(true); });
    return () => { live = false; };
  }, [kv, storeKey, layout, ready]);

  useEffect(()=>{if(ready)void kv.set(`${storeKey}/view`,{undo:history.current,picked:[...picked]}).catch(()=>setSaveError(true));},[ready,kv,storeKey,undoCount,picked,layout]);
  useEffect(()=>{if(!canvas.current)return;const observer=new ResizeObserver(()=>{const sizes=measured();setCardSizes(old=>JSON.stringify(old)===JSON.stringify(sizes)?old:sizes);});canvas.current.querySelectorAll('[data-workspace-card]').forEach(el=>observer.observe(el));return()=>observer.disconnect();},[items,ready,visibleIds]);

  const begin = (e: React.PointerEvent, kind: "card" | "frame" | "note" | "size", id: string) => {
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    let group: string[] | undefined;
    if (kind === "card") {
      group = picked.has(id) ? [...picked] : [id];
      if (!picked.has(id) && !(e.shiftKey || e.metaKey)) setPicked(new Set([id]));
    }
    beforeDrag.current=current.current;
    drag.current = { kind, id, x: e.clientX, y: e.clientY, moved: false, ...(group ? { ids: group } : {}) };
  };
  const track = (e: React.PointerEvent) => {
    e.stopPropagation();
    const d = drag.current;
    if (!d) return;
    const dx = (e.clientX - d.x) / (renderItem ? 1.4 : 1);
    const dy = (e.clientY - d.y) / (renderItem ? 2.2 : 1.3);
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
    if(d?.moved&&beforeDrag.current)remember(beforeDrag.current);beforeDrag.current=null;
    if (d && !d.moved && d.kind === "card" && id && (e.shiftKey || e.metaKey)) {
      setPicked((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
    }
  };

  const group = useCallback(() => {
    if (picked.size === 0) return;
    commit((l) => { const next = groupCards(l, [...picked], "Group"); return setFrameMembers(next, next.frames.at(-1)!.id, [...picked]); });
    setPicked(new Set());
  }, [picked]);

  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const chosen = [...picked].map((id) => byId.get(id)).filter((i): i is WorkItem => Boolean(i));
  const width = Math.max(1400, ...Object.values(layout.cards).map((c) => c.x + CARD_W + 80), ...layout.frames.map((f) => f.x + f.w + 80));
  const height = Math.max(700, ...Object.entries(layout.cards).map(([id,c]) => c.y + (cardSizes[id]?.h??CARD_H) + 80), ...layout.notes.map(n=>n.y+240), ...layout.frames.map((f) => f.y + f.h + 80));

  const scale = renderItem ? 1.4 : 1;
  const scaleY = renderItem ? 2.2 : 1.3;
  const visible = new Set(visibleIds ?? ids);
  return (
    <div className={`ws${renderItem ? " ws-detailed" : ""}`} aria-label="Workspace">
      <div className="ws-bar">
        {onBack&&<button className="plain" onClick={onBack}>← Back to Gallery</button>}
        <button className="plain" disabled={!ready||!items.length} onClick={tidy}>Auto-arrange</button>
        <button className="plain" disabled={!undoCount} onClick={undo}>Undo layout</button>
        <button className="plain" onClick={()=>scroll.current?.scrollTo({top:0,left:0,behavior:'smooth'})}>Back to top</button>
        <span className="ws-hint">{picked.size ? `${picked.size} selected` : "Drag the handle to arrange. Select cards to group them."}</span>
        <button className="plain" disabled={picked.size === 0} onClick={group}>Group</button>
        <label>Group <select aria-label="Target group" value={targetGroup} onChange={(e) => setTargetGroup(e.target.value)}><option value="">Choose group</option>{layout.frames.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label>
        <button className="plain" disabled={!targetGroup || !picked.size} onClick={() => commit((l) => setFrameMembers(l, targetGroup, [...membersOf(l, targetGroup), ...picked]))}>Add to group</button>
        <button className="plain" disabled={!targetGroup || !picked.size} onClick={() => commit((l) => setFrameMembers(l, targetGroup, membersOf(l, targetGroup).filter((id) => !picked.has(id))))}>Remove from group</button>
        {onUse && <button className="plain" disabled={chosen.filter((c) => c.kind === "image").length === 0} onClick={() => chosen.filter((c) => c.kind === "image").forEach((c) => onUse(c.src))}>Use as reference</button>}
        <button className="plain" onClick={() => commit((l) => addNote(l, "", 60 + l.notes.length * 24, 60 + l.notes.length * 24))}>Add note</button>
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
      {notice&&<p className="ws-status" role="status">{notice}</p>}
      {saveError && <p role="alert">Workspace could not be saved. <button onClick={() => void kv.set(storeKey, layout).then(() => setSaveError(false)).catch(() => setSaveError(true))}>Retry save</button></p>}
      <div ref={scroll} className="ws-scroll" onPointerDown={() => setPicked(new Set())}>
        <div ref={canvas} className="ws-canvas" style={{ width: width * scale, height: height * scaleY }} onPointerMove={track} onPointerCancel={()=>{if(beforeDrag.current)setLayout(beforeDrag.current);drag.current=null;beforeDrag.current=null;}}>
          {layout.frames.map((f) => (
            <div key={f.id} className="ws-frame" style={{ left: f.x * scale, top: f.y * scaleY, width: f.w * scale, height: f.h * scaleY }} onPointerDown={(e) => e.stopPropagation()}>
              <div className="ws-frame-head" onPointerDown={(e) => begin(e, "frame", f.id)} onPointerMove={track} onPointerUp={(e) => end(e)}>
                <input
                  value={f.name}
                  aria-label="Group name"
                  onPointerDown={(e) => e.stopPropagation()}
                  onChange={(e) => commit((l) => renameFrame(l, f.id, e.target.value))}
                />
                <button title="Ungroup" onPointerDown={(e) => e.stopPropagation()} onClick={() => commit((l) => removeFrame(l, f.id))}>×</button>
              </div>
              <span className="ws-size" onPointerDown={(e) => begin(e, "size", f.id)} onPointerMove={track} onPointerUp={(e) => end(e)} />
            </div>
          ))}
          {items.map((it) => {
            const at = layout.cards[it.id];
            if (!at || !visible.has(it.id)) return null;
            return (
              <figure
                key={it.id}
                className={`ws-card${picked.has(it.id) ? " on" : ""}`}
                style={{ left: at.x * scale, top: at.y * scaleY, width: CARD_W * scale, minHeight: renderItem ? 0 : CARD_H * scaleY, ...(renderItem?{}:{height:CARD_H*scaleY}) }}
                onPointerMove={track}
                onPointerUp={(e) => end(e, it.id)}
                data-workspace-card={it.id}
              >
                <div className="ws-card-tools" onPointerDown={(e) => e.stopPropagation()}>
                  <label><input type="checkbox" aria-label={`Select ${it.title ?? it.id}`} checked={picked.has(it.id)} onChange={() => setPicked((p) => { const n = new Set(p); if (n.has(it.id)) n.delete(it.id); else n.add(it.id); return n; })} /> Select</label>
                  <span className="ws-membership" title={layout.frames.filter((f) => membersOf(layout, f.id).includes(it.id)).map((f) => f.name).join(", ")}>{layout.frames.filter((f) => membersOf(layout, f.id).includes(it.id)).map((f) => f.name).join(", ")}</span>
                  <button aria-label={`Move ${it.title ?? it.id}`} onPointerDown={(e) => begin(e, "card", it.id)} onKeyDown={(e) => { const delta: Record<string, [number, number]> = { ArrowLeft: [-10, 0], ArrowRight: [10, 0], ArrowUp: [0, -10], ArrowDown: [0, 10] }; const d = delta[e.key]; if(d) { e.preventDefault(); commit((l) => moveCard(l, it.id, Math.max(0, at.x + d[0]), Math.max(0, at.y + d[1]))); } }}>Move</button>
                </div>
                <div className="ws-card-content" onPointerDown={(e) => e.stopPropagation()}>
                {renderItem ? renderItem(it) : it.kind === "video" ? <video src={it.src} muted loop playsInline draggable={false} onMouseOver={(e) => void e.currentTarget.play()} onMouseOut={(e) => e.currentTarget.pause()} /> : <img src={it.src} alt={it.title ?? ""} draggable={false} />}
                {it.tag && <span className="ws-tag">{it.tag}</span>}
                </div>
              </figure>
            );
          })}
          {layout.notes.map((n) => (
            <div key={n.id} className="ws-note" style={{ left: n.x * scale, top: n.y * scaleY }} onPointerDown={(e) => e.stopPropagation()}>
              <div className="ws-note-head" onPointerDown={(e) => begin(e, "note", n.id)} onPointerMove={track} onPointerUp={(e) => end(e)}>
                Note
                <button title="Delete note" onPointerDown={(e) => e.stopPropagation()} onClick={() => commit((l) => removeNote(l, n.id))}>×</button>
              </div>
              <textarea value={n.text} placeholder="Idea, prompt, reminder…" onChange={(e) => commit((l) => editNote(l, n.id, e.target.value))} />
            </div>
          ))}
          {items.length === 0 && layout.notes.length === 0 && <p className="ws-empty">Nothing here yet. Make or attach a picture and it lands on the table.</p>}
        </div>
      </div>
    </div>
  );
}
