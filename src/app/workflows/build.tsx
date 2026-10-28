"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { compileCanvas, portsOf, type Canvas, type CNode, type Library } from "../../comfy/canvas";
import { STEPS, type StepKind } from "../../comfy/recipe";
import type { Entry } from "../../server/comfy-library";
import { VOICES } from "../../providers/cloud-edits";
import { Nav, openKeys } from "../nav";
import { libraryPrompts, listWorkflows, planCanvas } from "../workflow-actions";
import { planToCanvas, type Plan } from "../../comfy/canvas";
import { alternativesFor, isOpen } from "../../comfy/alternatives";
import { quickById } from "../../comfy/quick";
import { defaultKv } from "../../story/kv";
import { WorkflowApp } from "./[name]/workflow-app";

/**
 * Build your own workflow on an open canvas. Drop steps and whole library
 * workflows anywhere, draw a line from what one makes to what the next
 * needs, and stack as many as you like, open-weights and partner models
 * together. When it runs the way you want, turn it into an app.
 */

const W = 252;
const PORT_Y = 25;
const info = (k: StepKind) => STEPS.find((s) => s.kind === k)!;
const newId = () => `n${Math.random().toString(36).slice(2, 8)}`;
const FIRST: CNode[] = [{ id: "start", kind: "picture-in", x: 40, y: 80 }];

export function BuildWorkflow({ start }: { start?: Canvas }) {
  // A ready-made app opens straight as a simple form; its canvas is one tap away.
  const quick = quickById(useSearchParams().get("quick") ?? "");
  const [canvas, setCanvas] = useState<Canvas>(start ?? quick?.canvas ?? { name: "My app", nodes: FIRST, links: [] });
  const [library, setLibrary] = useState<Library>({});
  const [titles, setTitles] = useState<Record<string, string>>({});
  const [linking, setLinking] = useState<string | null>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [menu, setMenu] = useState(false);
  const [hunt, setHunt] = useState("");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [note, setNote] = useState<string | null>(null);
  // Set when the canvas can't load its library steps without a way to run them. Asked on the page, not in a pop-up on arrival.
  const [needKey, setNeedKey] = useState(false);
  const [trying, setTrying] = useState(false);
  const autoTried = useRef(false);
  const [goal, setGoal] = useState("");
  const [planning, setPlanning] = useState(false);
  const [sent, setSent] = useState<{ id: string; summary: string; plan: Plan }[]>([]);
  const surface = useRef<HTMLDivElement>(null);
  const [draftReady,setDraftReady]=useState(false);
  const draftKey=`workflow-builder/draft/${quick?.id??"custom"}`;
  useEffect(()=>{let live=true;if(start){setDraftReady(true);return;}void defaultKv().get<Canvas>(draftKey).then(saved=>{if(live&&saved&&Array.isArray(saved.nodes)&&Array.isArray(saved.links))setCanvas(saved);}).catch(()=>setNote("Your saved draft could not be loaded.")).finally(()=>{if(live)setDraftReady(true);});return()=>{live=false;};},[draftKey,start]);
  useEffect(()=>{if(draftReady&&!start)void defaultKv().set(draftKey,canvas).catch(()=>setNote("Draft could not be saved. Keep this page open and try again."));},[canvas,draftReady,draftKey,start]);

  // Library workflows already on a saved canvas need loading before it can compile.
  useEffect(() => {
    const need = [...new Set(canvas.nodes.flatMap((n) => (n.kind === "library" && n.template && !library[n.template] ? [n.template] : [])))];
    if (!need.length) return;
    void libraryPrompts(need).then((r) => {
      if (!r.ok) return r.needsKey ? setNeedKey(true) : setNote(r.reason);
      setNeedKey(false);
      setLibrary((l) => ({ ...l, ...r.prompts }));
    });
  }, [canvas.nodes, library]);

  // What Claude has sent over MCP, waiting to be applied.
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    let live = true;
    const look = () => fetch("/api/bridge/inbox?project=canvas").then((r) => (r.ok ? r.json() : null)).then((b: { items?: { id: string; kind: string; summary: string; payload: Plan }[] } | null) => live && b?.items && setSent(b.items.filter((i) => i.kind === "canvas").map((i) => ({ id: i.id, summary: i.summary, plan: i.payload })))).catch(() => undefined);
    void look();
    const t = setInterval(look, 4000);
    return () => { live = false; clearInterval(t); };
  }, []);

  async function applySent(item: { id: string; plan: Plan }) {
    const names = item.plan.steps.flatMap((s) => (s.template ? [s.template] : []));
    const next = planToCanvas(item.plan, names);
    await fetch(`/api/bridge/inbox?project=canvas&id=${encodeURIComponent(item.id)}`, { method: "DELETE" }).catch(() => undefined);
    setSent((all) => all.filter((x) => x.id !== item.id));
    if (!next.nodes.length) return setNote("That plan had nothing the canvas could use.");
    setCanvas(next);
    setPan({ x: 0, y: 0 });
  }

  useEffect(() => {
    if (entries.length) return;
    void listWorkflows().then((l) => setEntries(l.entries.filter((e) => e.kind === "image" || e.kind === "video")));
  }, [entries.length]);

  const compiled = useMemo(() => {
    try {
      return { json: JSON.stringify(compileCanvas(canvas, library)), error: null };
    } catch (caught) {
      return { json: null, error: caught instanceof Error ? caught.message : "That canvas can't run." };
    }
  }, [canvas, library]);

  useEffect(() => {
    if (draftReady && quick && !start && compiled.json && !autoTried.current) {
      autoTried.current = true;
      setTrying(true);
    }
  }, [quick, start, compiled.json,draftReady]);

  const patch = (id: string, p: Partial<CNode>) => setCanvas((c) => ({ ...c, nodes: c.nodes.map((n) => (n.id === id ? { ...n, ...p } : n)) }));
  const remove = (id: string) => setCanvas((c) => ({ ...c, nodes: c.nodes.filter((n) => n.id !== id), links: c.links.filter((l) => l.from !== id && l.to !== id) }));

  function place(node: Omit<CNode, "id" | "x" | "y">) {
    const rightmost = Math.max(0, ...canvas.nodes.map((n) => n.x));
    const id = newId();
    setCanvas((c) => {
      const last = c.nodes.at(-1);
      const n: CNode = { ...node, id, x: rightmost + 300, y: 80 + (c.nodes.length % 2) * 40 };
      // The new node takes what the last one made, when it can use it.
      const links = last && accepts(n, last) ? [...c.links, { from: last.id, to: id }] : c.links;
      return { ...c, nodes: [...c.nodes, n], links };
    });
    setMenu(false);
  }

  function accepts(to: CNode, from: CNode): boolean {
    try {
      const needs = portsOf(to, library).needs;
      const makes = portsOf(from, library).makes;
      return to.kind === "library" ? needs.length === 0 || needs.includes(makes) : needs.includes(makes);
    } catch {
      return false;
    }
  }

  function connect(to: CNode) {
    const from = canvas.nodes.find((n) => n.id === linking);
    setLinking(null);
    if (!from || from.id === to.id) return;
    if (!accepts(to, from)) return setNote(`${label(to)} can't take a ${portsOf(from, library).makes === "image" ? "picture" : "video"} from ${label(from)}.`);
    setNote(null);
    setCanvas((c) => (c.links.some((l) => l.from === from.id && l.to === to.id) ? c : { ...c, links: [...c.links, { from: from.id, to: to.id }] }));
  }

  const label = (n: CNode) => (n.kind === "library" ? titles[n.template ?? ""] ?? n.template ?? "Workflow" : info(n.kind).label);

  function drag(e: React.PointerEvent, id: string) {
    if(window.matchMedia("(max-width: 600px)").matches)return;
    const n = canvas.nodes.find((x) => x.id === id)!;
    const sx = e.clientX, sy = e.clientY, ox = n.x, oy = n.y;
    const move = (ev: PointerEvent) => patch(id, { x: Math.round(ox + ev.clientX - sx), y: Math.round(oy + ev.clientY - sy) });
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  function panStart(e: React.PointerEvent) {
    if(window.matchMedia("(max-width: 600px)").matches)return;
    if ((e.target as HTMLElement).closest(".cv-node, .cv-bar, .cv-menu, .cv-link-x")) return;
    setLinking(null);
    const sx = e.clientX, sy = e.clientY, ox = pan.x, oy = pan.y;
    const move = (ev: PointerEvent) => setPan({ x: ox + ev.clientX - sx, y: oy + ev.clientY - sy });
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  async function plan() {
    setPlanning(true);
    setNote(null);
    const r = await planCanvas(goal);
    setPlanning(false);
    if (!r.ok && r.needsKey && /Claude/.test(r.reason)) {
      // No Claude key needed: the connected Claude plans it over MCP and sends it here.
      const ask = `Use haggs_find_workflows and haggs_propose_canvas to lay out this app in haggs: ${goal.trim()}`;
      await navigator.clipboard?.writeText(ask).catch(() => undefined);
      return setNote("Copied a request. Paste it to Claude (the haggs MCP is connected) and its plan lands here for you to apply.");
    }
    if (!r.ok) return r.needsKey ? openKeys() : setNote(r.reason);
    const next = planToCanvas(r.plan, r.offered);
    if (!next.nodes.length) return setNote("Haggy couldn't turn that into steps. Try saying it another way.");
    setTitles((t) => ({ ...t, ...r.titles }));
    setCanvas(next);
    setPan({ x: 0, y: 0 });
  }

  /** Swaps a node for a library workflow that does the same job, keeping its place and its links. Says so, and changes nothing, if the workflow can't be stacked. */
  async function swap(id: string, e: Entry, quiet = false): Promise<boolean> {
    const r = await libraryPrompts([e.name]);
    if (!r.ok) {
      if (r.needsKey) openKeys();
      else if (!quiet) setNote(r.reason);
      return false;
    }
    try {
      portsOf({ id: "probe", kind: "library", template: e.name, x: 0, y: 0 }, r.prompts);
    } catch (caught) {
      if (!quiet) setNote(caught instanceof Error ? caught.message : `${e.title} can't be stacked.`);
      return false;
    }
    setLibrary((l) => ({ ...l, ...r.prompts }));
    setTitles((t) => ({ ...t, [e.name]: e.title }));
    setCanvas((c) => ({ ...c, nodes: c.nodes.map((n) => (n.id === id ? { id: n.id, x: n.x, y: n.y, kind: "library" as const, template: e.name } : n)) }));
    setNote(null);
    return true;
  }

  /** The best way to do a step: open weights first, then the most used, taking the first that can be stacked. */
  async function bestOf(id: string, alts: Entry[]) {
    const order = [...alts.filter(isOpen), ...alts.filter((a) => !isOpen(a))].slice(0, 6);
    for (const a of order) if (await swap(id, a, true)) return;
    setNote("None of the alternatives for this step can be stacked yet.");
  }

  const shown = entries.filter((e) => !hunt.trim() || `${e.title} ${e.tags.join(" ")} ${e.models.join(" ")}`.toLowerCase().includes(hunt.trim().toLowerCase())).slice(0, 40);

  async function addLibrary(e: Entry) {
    const r = await libraryPrompts([e.name]);
    if (!r.ok) return r.needsKey ? openKeys() : setNote(r.reason);
    setLibrary((l) => ({ ...l, ...r.prompts }));
    setTitles((t) => ({ ...t, [e.name]: e.title }));
    place({ kind: "library", template: e.name });
  }

  if (trying && compiled.json) return <WorkflowApp name={canvas.name} file={compiled.json} canvas={canvas} onBack={() => setTrying(false)} />;

  const at = (id: string) => canvas.nodes.find((n) => n.id === id)!;

  return (
    <div className="app">
      <Nav current="Workflows" />
      <h1 className="sr-only">Build a workflow</h1>
      <div className="cv" ref={surface} onPointerDown={panStart}>
        <div className="cv-bar">
          <input className="cv-name" value={canvas.name} maxLength={80} onChange={(e) => setCanvas((c) => ({ ...c, name: e.target.value }))} aria-label="App name" />
          <form className="cv-plan" onSubmit={(e) => { e.preventDefault(); void plan(); }}>
            <input value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="Describe the app and Haggy lays it out…" aria-label="Describe the app" />
            <button className="pill" disabled={planning || goal.trim().length < 6}>{planning ? "Planning…" : "Plan it"}</button>
          </form>
          <div className="cv-add">
            <button className="pill on" onClick={() => setMenu((m) => !m)} aria-expanded={menu}>+ Add a step</button>
          </div>
          <span className="cv-hint">{linking ? "Choose the step that should receive this result." : "Connect steps in the order you want. The result becomes a simple app with upload fields and a Run button."}</span>
          <button className="fire" disabled={!compiled.json} onClick={() => setTrying(true)}>Turn it into an app</button>
        </div>

        {sent.length > 0 && (
          <div className="cv-sent" role="status">
            {sent.map((i) => (
              <div key={i.id}>
                <b>Claude sent a canvas</b> <span>{i.summary}</span>
                <button className="pill on" onClick={() => void applySent(i)}>Apply</button>
                <button className="plain" onClick={() => { void fetch(`/api/bridge/inbox?project=canvas&id=${encodeURIComponent(i.id)}`, { method: "DELETE" }); setSent((all) => all.filter((x) => x.id !== i.id)); }}>Dismiss</button>
              </div>
            ))}
          </div>
        )}

        {menu && (
          <div className="cv-menu" role="menu">
            <b>Steps</b>
            <div className="cv-steps">
              {STEPS.map((s) => (
                <button key={s.kind} role="menuitem" onClick={() => place({ kind: s.kind })}>
                  <b>{s.label}</b>
                  <span>{s.model ?? "Your file"}</span>
                </button>
              ))}
            </div>
            <b>Stack a workflow</b>
            <input value={hunt} onChange={(e) => setHunt(e.target.value)} placeholder="Search Comfy's workflows: upscale, relight, wan, swap…" aria-label="Search workflows" />
            <div className="cv-lib">
              {shown.map((e) => (
                <button key={e.name} role="menuitem" onClick={() => void addLibrary(e)}>
                  <b>{e.title}</b>
                  <span>{e.models.slice(0, 2).join(" · ") || e.category}</span>
                </button>
              ))}
              {!shown.length && <p className="wf-small">{entries.length ? "Nothing matches." : "Loading Comfy's workflows…"}</p>}
            </div>
          </div>
        )}

        <div className="cv-plane" style={{ transform: `translate(${pan.x}px, ${pan.y}px)` }}>
          <svg className="cv-links" width="4000" height="3000" aria-hidden="false">
            {canvas.links.map((l) => {
              const a = at(l.from), b = at(l.to);
              if (!a || !b) return null;
              const x1 = a.x + W, y1 = a.y + PORT_Y, x2 = b.x, y2 = b.y + PORT_Y, dx = Math.max(60, (x2 - x1) / 2);
              const d = `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`;
              return (
                <g key={`${l.from}-${l.to}`}>
                  <path d={d} />
                  <circle className="cv-link-x" cx={(x1 + x2) / 2} cy={(y1 + y2) / 2} r={9} onClick={() => setCanvas((c) => ({ ...c, links: c.links.filter((k) => k !== l) }))}><title>Remove this link</title></circle>
                </g>
              );
            })}
          </svg>

          {canvas.nodes.map((n) => {
            const isLib = n.kind === "library";
            const s = isLib ? null : info(n.kind as StepKind);
            let ports: { needs: string[]; makes: string } | null = null;
            try { ports = portsOf(n, library); } catch { /* library not loaded yet */ }
            return (
              <div key={n.id} className={`cv-node${linking === n.id ? " from" : ""}`} style={{ left: n.x, top: n.y, width: W }}>
                <div className="cv-head" onPointerDown={(e) => drag(e, n.id)}>
                  {ports && ports.needs.length > 0 || isLib ? <button className={`cv-port in${linking && linking !== n.id ? " live" : ""}`} aria-label={`Feed ${label(n)}`} onPointerDown={(e) => e.stopPropagation()} onClick={() => linking && connect(n)} /> : <span />}
                  <b>{label(n)}</b>
                  <button className="cv-port out" aria-label={`Link from ${label(n)}`} onPointerDown={(e) => e.stopPropagation()} onClick={() => setLinking(linking === n.id ? null : n.id)} />
                </div>
                <div className="cv-body">
                  <small>{isLib ? `Library workflow${ports ? ` · takes ${ports.needs.join(" + ") || "words"}, makes a ${ports.makes}` : " · loading…"}` : `${s!.model ?? "Your file"} · ${s!.blurb}`}</small>
                  {(() => {
                    const alts = alternativesFor(n.kind, entries).slice(0, 12);
                    if (!alts.length) return null;
                    return (
                      <div className="cv-swap">
                        <select value="" onChange={(ev) => { const pick = alts.find((a) => a.name === ev.target.value); if (pick) void swap(n.id, pick); }} aria-label={`Swap the model for ${label(n)}`}>
                          <option value="">Swap the model…</option>
                          {alts.map((a) => <option key={a.name} value={a.name}>{isOpen(a) ? "Open · " : "Partner · "}{a.title}</option>)}
                        </select>
                        <button className="plain" title="Open weights first, then the most used" onClick={() => void bestOf(n.id, alts)}>Best open</button>
                      </div>
                    );
                  })()}
                  {s?.asks.includes("prompt") && <textarea rows={3} value={n.prompt ?? ""} placeholder={n.kind === "speak" ? "What they say" : "Describe it. Whoever runs the app can change this."} onChange={(e) => patch(n.id, { prompt: e.target.value })} aria-label={`Words for ${label(n)}`} />}
                  <div className="cv-opts">
                    {s?.asks.includes("seconds") && <label>Seconds <input type="number" min={4} max={15} value={n.seconds ?? 5} onChange={(e) => patch(n.id, { seconds: Number(e.target.value) })} /></label>}
                    {s?.asks.includes("resolution") && (
                      <label>Quality
                        <select value={n.resolution ?? (n.kind === "animate" ? "768P" : "480p")} onChange={(e) => patch(n.id, { resolution: e.target.value })}>
                          {(n.kind === "animate" ? ["768P", "2K"] : ["480p", "720p", "1080p"]).map((r) => <option key={r}>{r}</option>)}
                        </select>
                      </label>
                    )}
                    {s?.asks.includes("voice") && (
                      <label>Voice
                        <select value={n.voice ?? "Sarah (female, american)"} onChange={(e) => patch(n.id, { voice: e.target.value })}>
                          {VOICES.map((v) => <option key={v}>{v}</option>)}
                        </select>
                      </label>
                    )}
                  </div>
                  <label>Receives from
                    <select aria-label={`Connect input for ${label(n)}`} value="" onChange={e=>{const from=e.target.value;if(from)setCanvas(c=>({...c,links:c.links.some(l=>l.from===from&&l.to===n.id)?c.links:[...c.links,{from,to:n.id}]}));}}>
                      <option value="">Connect a compatible step…</option>
                      {canvas.nodes.filter(other=>other.id!==n.id&&accepts(n,other)).map(other=><option key={other.id} value={other.id}>{label(other)}</option>)}
                    </select>
                  </label>
                  {canvas.links.filter(l=>l.to===n.id).map(l=><button key={l.from} className="plain" onClick={()=>setCanvas(c=>({...c,links:c.links.filter(x=>!(x.from===l.from&&x.to===l.to))}))}>Disconnect {label(at(l.from))}</button>)}
                  <button className="plain danger" onClick={() => remove(n.id)}>Remove</button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="cv-status" role="status">
          {needKey && <span className="key-callout inline"><b>Choose how to run this to build it.</b> Browsing is free; this app needs a way to run before it can be put together. <button className="plain" onClick={() => openKeys()}>Choose how to run</button></span>}
          {note && <span>{note}</span>}
          {compiled.error ? <span className="library-error">{compiled.error}</span> : <span>Ready: this canvas runs as one workflow.</span>}
        </div>
      </div>
    </div>
  );
}
