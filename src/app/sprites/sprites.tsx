"use client";

import { useRef, useState } from "react";

import { ModeTabs } from "../mode-tabs";
import { Nav } from "../nav";
import { SiteFooter } from "../site-footer";
import { uploadFile } from "../upload-client";

type Layout = { columns: number; rows: number; frames: number; cell: number; fps: number; seconds: number };

/**
 * Sprite sheet: a short clip of a character (a walk, a spin, an attack) cut into evenly spaced frames and laid out
 * as one picture, a grid of squares that a game engine reads. Free; nothing is generated.
 */
export function Sprites() {
  const [frames, setFrames] = useState(8);
  const [columns, setColumns] = useState(4);
  const [size, setSize] = useState(128);
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [sheet, setSheet] = useState<{ url: string; layout: Layout } | null>(null);
  const [clip, setClip] = useState<File | null>(null);
  const [over, setOver] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const across = Math.max(1, Math.min(columns, frames));
  const rows = Math.ceil(frames / across);

  async function make(file: File) {
    setProblem(null);
    setSheet(null);
    setBusy("Adding the clip…");
    const added = await uploadFile(file);
    if (!added.ok) { setBusy(null); return setProblem(added.reason); }
    if (added.kind !== "video") { setBusy(null); return setProblem("Add a short clip (mp4, mov or webm)."); }
    setBusy("Cutting the frames…");
    const res = await fetch("/api/sprites", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url: added.url, frames, columns, size }) }).catch(() => null);
    const body = (await res?.json().catch(() => null)) as { ok: true; url: string; layout: Layout } | { ok: false; reason: string } | null;
    setBusy(null);
    if (!body || !body.ok) return setProblem(body && !body.ok ? body.reason : "The sheet couldn't be made.");
    setSheet({ url: body.url, layout: body.layout });
  }

  return (
    <div className="app">
      <Nav current="Video" />
      <div className="canvas">
        <div className="swap">
          <ModeTabs group="Video" current="/sprites" />
          <div className="cx">
            <aside className="cx-builder" aria-label="Make a sprite sheet">
              <div className="cx-scroll">
                <span className="eyebrow">Sprite sheet</span>
                <h1 className="cx-title">Turn a clip into a sprite sheet.</h1>
                <p className="cx-lede">A short clip of a character walking, spinning or striking a pose, cut into evenly spaced frames on one grid a game engine reads. Free, and nothing is generated.</p>
                <button
                  className={`rx-drop${over ? " over" : ""}`}
                  disabled={busy !== null}
                  onClick={() => file.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setOver(true); }}
                  onDragLeave={() => setOver(false)}
                  onDrop={(e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files?.[0]; if (f) { setClip(f); setSheet(null); } }}
                >
                  <span aria-hidden>▶</span>
                  <b>{clip ? clip.name : "Add a clip"}</b>
                  <small>{clip ? "Click to use another" : "mp4, mov or webm, up to 300 MB. Drop it here or click."}</small>
                </button>
                <input ref={file} type="file" accept="video/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) { setClip(f); setSheet(null); } }} />
                <section className="rx-step">
                  <b>Frames <small className="dw-count">2 to 64</small></b>
                  <div className="lab-chips small">
                    {[4, 8, 12, 16, 24, 32].map((n) => <button key={n} className={frames === n ? "on" : ""} onClick={() => setFrames(n)}>{n}</button>)}
                    <input className="sp-num" type="number" min={2} max={64} value={frames} onChange={(e) => setFrames(Number(e.target.value))} aria-label="Frames" />
                  </div>
                </section>
                <section className="rx-step">
                  <b>Frames across</b>
                  <div className="lab-chips small">
                    {[2, 4, 6, 8].map((n) => <button key={n} className={columns === n ? "on" : ""} onClick={() => setColumns(n)}>{n}</button>)}
                    <input className="sp-num" type="number" min={1} max={16} value={columns} onChange={(e) => setColumns(Number(e.target.value))} aria-label="Frames across" />
                  </div>
                </section>
                <section className="rx-step">
                  <b>Size of each square <small className="dw-count">pixels</small></b>
                  <div className="lab-chips small">
                    {[32, 64, 128, 256].map((n) => <button key={n} className={size === n ? "on" : ""} onClick={() => setSize(n)}>{n}</button>)}
                    <input className="sp-num" type="number" min={32} max={512} step={2} value={size} onChange={(e) => setSize(Number(e.target.value))} aria-label="Size of each square in pixels" />
                  </div>
                </section>
                {problem && <p className="library-error" role="alert">{problem}</p>}
              </div>
              <div className="cx-foot">
                <button className="fire" disabled={busy !== null || !clip} onClick={() => clip && void make(clip)}>{busy ?? (clip ? "Cut the frames" : "Add a clip first")} <span className="cost">free</span></button>
              </div>
            </aside>

            <div className="cx-main">
              {sheet ? (
                <section className="sp-result" aria-label="Sprite sheet">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className="sprite-sheet" src={sheet.url} alt="The sprite sheet" />
                  <p className="muted">{sheet.layout.frames} frames, {sheet.layout.columns} across and {sheet.layout.rows} down, each {sheet.layout.cell}×{sheet.layout.cell}. Play it at {Math.round(sheet.layout.fps * 10) / 10} frames a second to match the clip.</p>
                  <p><a className="fire" href={sheet.url} download="sprite-sheet.png">Download the sheet</a></p>
                </section>
              ) : (
                <section className="sp-plan" aria-label="The sheet you will get">
                  <span className="eyebrow muted">The sheet you will get</span>
                  <div className="sp-grid" style={{ gridTemplateColumns: `repeat(${across}, minmax(0, 1fr))`, maxWidth: `${Math.min(across * 96, 760)}px` }} aria-hidden>
                    {Array.from({ length: Math.min(frames, 64) }, (_, i) => <i key={i}>{i + 1}</i>)}
                  </div>
                  <p className="muted">{frames} frames · {across} across, {rows} down · each {size}×{size} · the sheet is {across * size}×{rows * size} pixels.</p>
                </section>
              )}
            </div>
          </div>
        </div>
        <SiteFooter />
      </div>
    </div>
  );
}
