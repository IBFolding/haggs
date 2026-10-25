"use client";

import { useState } from "react";

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
          <header className="swap-head">
            <h1>Sprite sheet</h1>
            <p>Add a short clip of a character walking, spinning or striking a pose. haggs cuts it into evenly spaced frames and lays them out as one picture, a grid of squares for a game engine. Free, and nothing is generated.</p>
          </header>

          <div className="ac-form">
            <label className="wf-field"><span>Frames (2 to 64)</span><input type="number" min={2} max={64} value={frames} onChange={(e) => setFrames(Number(e.target.value))} /></label>
            <label className="wf-field"><span>Frames across</span><input type="number" min={1} max={16} value={columns} onChange={(e) => setColumns(Number(e.target.value))} /></label>
            <label className="wf-field"><span>Size of each square, in pixels (32 to 512)</span><input type="number" min={32} max={512} step={2} value={size} onChange={(e) => setSize(Number(e.target.value))} /></label>
          </div>
          <label className="wf-field"><span>Clip (mp4, mov or webm, up to 300 MB)</span>
            <input type="file" accept="video/*" disabled={busy !== null} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void make(f); }} />
          </label>
          {busy && <p role="status">{busy}</p>}
          {problem && <p className="library-error" role="alert">{problem}</p>}

          {sheet && (
            <section aria-label="Sprite sheet">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="sprite-sheet" src={sheet.url} alt="The sprite sheet" />
              <p className="muted">{sheet.layout.frames} frames, {sheet.layout.columns} across and {sheet.layout.rows} down, each {sheet.layout.cell}×{sheet.layout.cell}. Play it at {Math.round(sheet.layout.fps * 10) / 10} frames a second to match the clip.</p>
              <p><a className="pill" href={sheet.url} download="sprite-sheet.png">Download the sheet</a></p>
            </section>
          )}
        </div>
        <SiteFooter />
      </div>
    </div>
  );
}
