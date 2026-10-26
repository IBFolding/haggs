"use client";

import { useRef, useState } from "react";

import { track } from "../activity/activity";
import { editEstimate } from "../providers/cloud-edits";
import { createStyleStore, type CustomStyle } from "../styles/custom";
import { styleSheetPrompt } from "../styles/style";
import { defaultKv } from "../story/kv";
import { openKeys } from "./nav";
import { makeStill } from "./series-actions";
import { creditsText } from "../story/price-text";

/** A picture shrunk to a size Comfy takes comfortably, as a small jpeg. */
async function shrink(file: File, max = 1280): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error("That picture couldn't be read.")); i.src = url; });
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas");
    c.width = Math.round(img.naturalWidth * k);
    c.height = Math.round(img.naturalHeight * k);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.88);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Make a look of your own. Name it, say how it should be drawn, and give it a
 * style sheet: a picture of the look. Add one you already have, or have one
 * drawn from your words. The sheet is what makes the look copy across shots.
 */
export function StyleMaker({ onSaved, onClose, start }: { onSaved: (s: CustomStyle) => void; onClose: () => void; start?: CustomStyle }) {
  const [name, setName] = useState(start?.name ?? "");
  const [words, setWords] = useState(start?.words ?? "");
  const [sheet, setSheet] = useState<string | null>(start?.sheet ?? null);
  const [busy, setBusy] = useState<"sheet" | "save" | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const pick = useRef<HTMLInputElement>(null);
  const price = editEstimate({ tool: "flux3", seconds: 0, resolution: "1K" });

  async function draw() {
    if (!words.trim()) return setProblem("Describe the look first; the sheet is drawn from your words.");
    setBusy("sheet");
    setProblem(null);
    const r = await track({ label: `Drawing a style sheet: ${name.trim() || "your style"}`, href: window.location.pathname + window.location.search, failure: (x) => (x.ok ? null : x.reason) }, () => makeStill(styleSheetPrompt({ id: "x", name, says: "", words: words.trim() }), "16:9")).catch((e: unknown) => ({ ok: false as const, reason: e instanceof Error ? e.message : "The sheet didn't finish.", needsKey: false }));
    setBusy(null);
    if (!r.ok) {
      if ("needsKey" in r && r.needsKey) openKeys();
      return setProblem(r.reason);
    }
    setSheet(r.url);
  }

  async function save() {
    setBusy("save");
    setProblem(null);
    try {
      const saved = await createStyleStore(defaultKv()).save({ ...(start ? { id: start.id } : {}), name, words, sheet });
      onSaved(saved);
    } catch (e) {
      setProblem(e instanceof Error ? e.message : "It couldn't be saved.");
      setBusy(null);
    }
  }

  return (
    <div className="sm-back" role="dialog" aria-modal="true" aria-label="Make your own style" onClick={onClose}>
      <div className="sm" onClick={(e) => e.stopPropagation()}>
        <h2>Make your own style</h2>
        <label className="wf-field"><span>Name</span><input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="Faded Polaroid" autoFocus /></label>
        <label className="wf-field"><span>How is it drawn?</span><textarea rows={3} maxLength={400} value={words} onChange={(e) => setWords(e.target.value)} placeholder="faded 1970s snapshot, warm washed-out colour, soft flash, a little grain" /></label>
        <div className="sm-sheet">
          <b>Style sheet</b>
          <p className="gs-soft">A picture of the look: colour, line and texture. It goes to Comfy beside your footage so the look is copied, not guessed.</p>
          {sheet ? <img src={sheet} alt="Your style sheet" /> : <div className="sm-none">No sheet yet</div>}
          <div className="gs-row">
            <button className="pill" disabled={busy !== null} onClick={() => pick.current?.click()}>{sheet ? "Use a different picture" : "Add a picture of the look"}</button>
            <button className="pill on" disabled={busy !== null || !words.trim()} onClick={() => void draw()}>{busy === "sheet" ? "Drawing…" : sheet ? "Draw it again" : "Draw one from my words"} <span className="cost">about {creditsText(price)}</span></button>
            {sheet && <button className="plain" onClick={() => setSheet(null)}>Remove the sheet</button>}
            <input ref={pick} type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) { try { setSheet(await shrink(f)); } catch (x) { setProblem(x instanceof Error ? x.message : "That picture couldn't be read."); } } }} />
          </div>
        </div>
        {problem && <p className="library-error" role="alert">{problem}</p>}
        <div className="gs-row sm-foot">
          <button className="fire" disabled={busy !== null || !name.trim() || !words.trim()} onClick={() => void save()}>{start ? "Save changes" : "Save the style"}</button>
          <button className="plain" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
