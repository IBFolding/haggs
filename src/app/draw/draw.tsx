"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { MAX_MARKS, motionPrompt, type Mark, type Pt } from "../../story/draw-motion";
import { defaultKv } from "../../story/kv";
import { createRunStore } from "../../story/runs";
import { ModeTabs } from "../mode-tabs";
import { Nav } from "../nav";
import { shrinkPicture } from "../shrink";
import { SiteFooter } from "../site-footer";

const HANDOFF_KEY = "haggs.handoff";
const TOO_SHORT = 0.08;

type Sample = { name: string; src: string; marks: Omit<Mark, "id">[] };

/** One-tap pictures, each with a sketch already on it, so the page is never empty. */
const SAMPLES: Sample[] = [
  { name: "Cyclist", src: "/samples/street.jpg", marks: [{ kind: "subject", from: { x: 0.5, y: 0.62 }, to: { x: 0.9, y: 0.62 }, note: "the cyclist" }] },
  { name: "Ocean liner", src: "/samples/portrait.jpg", marks: [{ kind: "subject", from: { x: 0.6, y: 0.27 }, to: { x: 0.8, y: 0.15 }, note: "her hair" }, { kind: "camera", from: { x: 0.3, y: 0.8 }, to: { x: 0.6, y: 0.8 }, note: "" }] },
  { name: "Observatory", src: "/samples/landscape.jpg", marks: [{ kind: "camera", from: { x: 0.5, y: 0.85 }, to: { x: 0.5, y: 0.25 }, note: "" }] },
];

const fresh = (m: Omit<Mark, "id">): Mark => ({ ...m, id: crypto.randomUUID() });

/**
 * Draw to video: sketch arrows on a picture to say what moves and where the camera goes. haggs turns the arrows into
 * a motion prompt and hands the picture and the prompt to Video, where the price is on the Generate button as always.
 * Nothing here costs anything.
 */
export function Draw() {
  const router = useRouter();
  const [picture, setPicture] = useState<string | null>(null);
  const [marks, setMarks] = useState<Mark[]>([]);
  const [tool, setTool] = useState<"subject" | "camera">("subject");
  const [drag, setDrag] = useState<{ from: Pt; to: Pt } | null>(null);
  /* The drag is also kept in a ref, so fast pointer events never read a stale copy. */
  const dragging = useRef<{ from: Pt; to: Pt } | null>(null);
  const [edited, setEdited] = useState<string | null>(null);
  const [recent, setRecent] = useState<string[]>([]);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [problem, setProblem] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const file = useRef<HTMLInputElement>(null);

  // This session's own pictures, so a picture you just made is one tap away.
  useEffect(() => {
    void createRunStore(defaultKv()).list().then((all) => setRecent(all.filter((r) => r.kind === "image").slice(0, 8).map((r) => r.url))).catch(() => undefined);
  }, []);

  // The sketch is drawn at the picture's real size on screen, so arrowheads are never stretched.
  useEffect(() => {
    const el = stage.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const watch = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    watch.observe(el);
    return () => watch.disconnect();
  }, [picture]);

  const auto = useMemo(() => motionPrompt(marks), [marks]);
  const prompt = edited ?? auto;

  function choose(src: string, starter: Omit<Mark, "id">[] = []) {
    setPicture(src);
    setMarks(starter.map(fresh));
    setEdited(null);
    setProblem(null);
  }

  function point(e: React.PointerEvent): Pt {
    const r = stage.current!.getBoundingClientRect();
    return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) };
  }
  function start(e: React.PointerEvent) {
    if (marks.length >= MAX_MARKS) return setProblem(`That is the most arrows (${MAX_MARKS}). Delete one to draw another.`);
    setProblem(null);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const p = point(e);
    dragging.current = { from: p, to: p };
    setDrag(dragging.current);
  }
  function move(e: React.PointerEvent) {
    const d = dragging.current;
    if (!d) return;
    dragging.current = { from: d.from, to: point(e) };
    setDrag(dragging.current);
  }
  function end() {
    const d = dragging.current;
    dragging.current = null;
    if (d && Math.hypot(d.to.x - d.from.x, d.to.y - d.from.y) >= TOO_SHORT) {
      setMarks((held) => [...held, fresh({ kind: tool, from: d.from, to: d.to, note: "" })]);
      setEdited(null);
    }
    setDrag(null);
  }

  function upload(f: File | undefined) {
    if (!f) return;
    if (!f.type.startsWith("image/")) return setProblem("Add a picture (png, jpg or webp).");
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" && choose(reader.result);
    reader.readAsDataURL(f);
  }

  async function make() {
    if (!picture || !prompt.trim()) return;
    const sent = await shrinkPicture(picture, 1536);
    try {
      sessionStorage.setItem(HANDOFF_KEY, JSON.stringify({ url: sent, to: "Video", prompt }));
    } catch {
      return setProblem("This browser wouldn't hold the picture for the next page. Try a smaller one.");
    }
    router.push("/video");
  }

  const px = (p: Pt) => ({ x: p.x * size.w, y: p.y * size.h });
  const arrow = (from: Pt, to: Pt, key: string, kind: Mark["kind"], n?: number, ghost = false) => {
    const a = px(from), b = px(to);
    const ang = Math.atan2(b.y - a.y, b.x - a.x), head = 16;
    const h1 = { x: b.x - head * Math.cos(ang - 0.45), y: b.y - head * Math.sin(ang - 0.45) };
    const h2 = { x: b.x - head * Math.cos(ang + 0.45), y: b.y - head * Math.sin(ang + 0.45) };
    return (
      <g key={key} className={`dw-arrow ${kind}${ghost ? " ghost" : ""}`}>
        <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
        <polygon points={`${b.x},${b.y} ${h1.x},${h1.y} ${h2.x},${h2.y}`} />
        {n !== undefined && <><circle cx={a.x} cy={a.y} r={11} /><text x={a.x} y={a.y + 4} textAnchor="middle">{n}</text></>}
      </g>
    );
  };

  return (
    <div className="app">
      <Nav current="Video" />
      <div className="canvas">
        <div className="swap">
          <ModeTabs group="Video" current="/draw" />
          <div className="cx">
            <aside className="cx-builder" aria-label="Draw the motion">
              <div className="cx-scroll">
                <span className="eyebrow">Draw to video</span>
                <h1 className="cx-title">Draw the move. Get the shot.</h1>
                <p className="cx-lede">Drag arrows on a picture: green for what moves, white for where the camera goes. haggs writes the motion, and Video shows the price before anything is made.</p>
                <button
                  className={`cx-upload${over ? " over" : ""}`}
                  onClick={() => file.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setOver(true); }}
                  onDragLeave={() => setOver(false)}
                  onDrop={(e) => { e.preventDefault(); setOver(false); upload(e.dataTransfer.files?.[0]); }}
                >
                  <span aria-hidden>＋</span><b>{picture ? "Use another picture" : "Add a picture"}</b><small>drop one here, or pick a sample</small>
                </button>
                <input ref={file} type="file" accept="image/*" hidden onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ""; }} />

                <section className="rx-step">
                  <b><i>1</i> What the next arrow means</b>
                  <div className="dw-tools" role="group" aria-label="What the arrow means">
                    <button className={tool === "subject" ? "on" : ""} onClick={() => setTool("subject")}>Something moves</button>
                    <button className={tool === "camera" ? "on" : ""} onClick={() => setTool("camera")}>The camera moves</button>
                  </div>
                </section>

                <section className="rx-step">
                  <b><i>2</i> Arrows <small className="dw-count">{marks.length} of {MAX_MARKS}</small></b>
                  {marks.length === 0 ? <p className="dw-hint">{picture ? "Drag on the picture to draw one." : "Pick a picture first."}</p> : (
                    <ol className="dw-marks">
                      {marks.map((m, i) => (
                        <li key={m.id}>
                          <span className={`dw-n ${m.kind}`}>{i + 1}</span>
                          {m.kind === "subject" ? (
                            <input value={m.note} maxLength={40} placeholder="What moves? e.g. the dog" aria-label={`What arrow ${i + 1} moves`} onChange={(e) => { const note = e.target.value; setMarks((held) => held.map((x) => (x.id === m.id ? { ...x, note } : x))); setEdited(null); }} />
                          ) : <span className="dw-cam">Camera move</span>}
                          <button className="plain" onClick={() => { setMarks((held) => held.filter((x) => x.id !== m.id)); setEdited(null); }} aria-label={`Delete arrow ${i + 1}`}>×</button>
                        </li>
                      ))}
                    </ol>
                  )}
                </section>

                <section className="rx-step">
                  <b><i>3</i> The motion</b>
                  <textarea className="dw-prompt" value={prompt} placeholder="Draw an arrow and the motion appears here. You can edit it." onChange={(e) => setEdited(e.target.value)} rows={5} />
                  {edited !== null && <button className="plain" onClick={() => setEdited(null)}>Write it from the arrows again</button>}
                </section>
                {problem && <p className="library-error" role="alert">{problem}</p>}
              </div>
              <div className="cx-foot">
                <button className="cx-shuffle" disabled={marks.length === 0} onClick={() => { setMarks([]); setEdited(null); }}>Clear</button>
                <button className="fire" onClick={() => void make()} disabled={!picture || !prompt.trim()}>Make it a video <span className="cost">priced on Video</span></button>
              </div>
            </aside>

            <div className="cx-main">
              {picture ? (
                <div ref={stage} className="dw-stage" onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={() => { dragging.current = null; setDrag(null); }}>
                  <img src={picture} alt="The picture you are drawing on" draggable={false} onLoad={(e) => setSize({ w: e.currentTarget.clientWidth, h: e.currentTarget.clientHeight })} />
                  <svg width={size.w} height={size.h} aria-hidden>
                    {marks.map((m, i) => arrow(m.from, m.to, m.id, m.kind, i + 1))}
                    {drag && arrow(drag.from, drag.to, "drag", tool, undefined, true)}
                  </svg>
                </div>
              ) : (
                <div className="chars-sheet dw-empty-stage"><div className="wf-result-wait">Pick a sample below or add your own picture, then drag on it to draw an arrow.</div></div>
              )}

              <section className="cx-gallery" aria-label="Pictures to draw on">
                {recent.length > 0 && (
                  <>
                    <span className="eyebrow muted">Your pictures</span>
                    <div className="dw-recent">
                      {recent.map((src) => (
                        <button key={src} className={picture === src ? "on" : ""} onClick={() => choose(src)} title="Draw on this one"><img src={src} alt="" loading="lazy" /></button>
                      ))}
                    </div>
                  </>
                )}
                <span className="eyebrow muted">Start from a sample</span>
                <div className="cx-cards">
                  {SAMPLES.map((s) => (
                    <button key={s.name} className={`cx-card${picture === s.src ? " on" : ""}`} onClick={() => choose(s.src, s.marks)}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={s.src} alt="" />
                      <span><b>{s.name}</b><small>{s.marks.length} arrow{s.marks.length === 1 ? "" : "s"} already drawn</small></span>
                    </button>
                  ))}
                </div>
              </section>
            </div>
          </div>
        </div>
        <SiteFooter />
      </div>
    </div>
  );
}
