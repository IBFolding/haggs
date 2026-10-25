"use client";

import { BankPicker, useReturnedPick } from "../bank-picker";
import { uploadFile } from "../upload-client";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { defaultKv } from "../../story/kv";
import { createRunStore, type PictureRun, type Run } from "../../story/runs";
import { Nav, openKeys } from "../nav";
import { SaveToProject } from "../save-to-project";
import { quoteWorkflow, runWorkflow, type Quote, type WorkflowResult } from "../workflow-actions";
import { SiteFooter } from "../site-footer";

/**
 * Swap a character into any video: drop the video, drop who should be in it,
 * say who to replace. The scene, the camera and the sound stay as they are.
 * It runs Comfy's Higgsfield Genjutsu workflow on Comfy Cloud.
 */

const SOURCE = { template: "api_higgsfield_genjutsu_motion_transfer" } as const;
const VIDEO = "13/file";
const FACE = "14/image";
const SCENE = "15/image";
const PROMPT = "9/model.prompt";
const QUALITY = "9/model.resolution";

async function addFile(file: File): Promise<string> {
  const added = await uploadFile(file);
  if (added.ok) return added.url;
  // Hosted, a file can't travel inside the request (Vercel allows 4.5 MB), so a failed upload is the end of it.
  if (process.env.NEXT_PUBLIC_HOSTED === "1") throw new Error(added.reason);
  if (file.size > 20 * 1024 * 1024) throw new Error(added.reason);
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("That file couldn't be read."));
    r.readAsDataURL(file);
  });
}

function Drop({ label, hint, accept, value, onChange }: { label: string; hint: string; accept: "video" | "image"; value: string | null; onChange: (url: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [bank, setBank] = useState(false);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function take(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith(accept)) return setError(accept === "video" ? "Drop a video here." : "Drop a picture here.");
    setBusy(true);
    setError(null);
    try {
      onChange(await addFile(file));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That file couldn't be added.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className={`swap-drop${over ? " over" : ""}${value ? " full" : ""}`} onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={(e) => { e.preventDefault(); setOver(false); void take(e.dataTransfer.files[0]); }}>
      <button className="swap-drop-face" onClick={() => input.current?.click()} aria-label={`Choose ${label.toLowerCase()}`}>
        {value ? (accept === "video" ? <video src={value} muted loop autoPlay playsInline /> : <img src={value} alt="" />) : (
          <span className="swap-drop-empty"><b>{label}</b><small>{busy ? "Adding…" : hint}</small></span>
        )}
      </button>
      {value && <span className="swap-drop-label">{label} · <button className="plain" onClick={() => input.current?.click()}>Change</button></span>}
      {accept === "image" && <button className="plain swap-bank" onClick={() => setBank(true)}>From your bank</button>}
      {bank && <BankPicker kinds={["character", "accessory"]} label="Swap a character" onClose={() => setBank(false)} onPick={(item) => { if (item.image) onChange(item.image); else setError("That one has no picture yet. Open it and add one."); }} />}
      {error && <span className="library-error" role="alert">{error}</span>}
      <input ref={input} type="file" accept={`${accept}/*`} hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; void take(f); }} />
    </div>
  );
}

export function Swap() {
  const [video, setVideo] = useState<string | null>(null);
  // A character sent here from the builder arrives as ?face=
  const sent = useSearchParams().get("face");
  const [face, setFace] = useState<string | null>(sent && (sent.startsWith("/api/local/") || sent.startsWith("https://")) ? sent : null);
  const [who, setWho] = useState("");
  // Back from building a character: they are the new face.
  useReturnedPick(["character"], (item) => { if (item.image) setFace(item.image); });
  const [quality, setQuality] = useState<"480p" | "720p">("480p");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [seconds, setSeconds] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<WorkflowResult | null>(null);
  const [kept, setKept] = useState<PictureRun | null>(null);
  const [saving, setSaving] = useState<PictureRun | null>(null);
  const runs = useMemo(() => createRunStore(defaultKv()), []);

  const prompt = `Replace ${who.trim() || "the main person"} with the character from the first reference image, keeping their identity, face and clothes exactly. Keep everything else the same: the scene, the other people, the source motion, camera movement, timing and audio.`;

  useEffect(() => {
    void quoteWorkflow(SOURCE, { [QUALITY]: quality }).then(setQuote);
  }, [quality]);
  useEffect(() => {
    setSeconds(null);
    if (!video) return;
    const el = document.createElement("video");
    el.preload = "metadata";
    el.onloadedmetadata = () => Number.isFinite(el.duration) && setSeconds(el.duration);
    el.src = video;
  }, [video]);

  const billed = seconds ? Math.min(seconds, 30) : null;
  const total = quote && quote.min > 0 && billed ? quote.min * billed : null;
  const tooShort = seconds !== null && seconds < 4;

  async function go() {
    if (!video || !face) return;
    setRunning(true);
    setResult(null);
    setKept(null);
    const r = await runWorkflow(SOURCE, { [PROMPT]: prompt, [QUALITY]: quality }, { [VIDEO]: video, [FACE]: face, [SCENE]: "" });
    setRunning(false);
    setResult(r);
    if (!r.ok && r.needsKey) openKeys();
    if (r.ok && r.kind === "video") setKept((await runs.record({ modelId: "comfy:genjutsu-swap", modelName: "Character swap (Genjutsu)", prompt: `Swap ${who.trim() || "the main person"}`, settings: { resolution: quality }, url: r.url, kind: "video", usd: total })) as PictureRun);
  }

  return (
    <div className="app">
      <Nav current="Workflows" />
      {saving && <SaveToProject run={saving} onClose={() => setSaving(null)} />}
      <div className="canvas">
        <div className="swap">
          <header className="swap-head">
            <h1>Swap a character</h1>
            <p>Put anyone into any video, from a single picture. The scene, the camera and the sound stay as they are.</p>
          </header>
          <div className="swap-body">
            <div className="swap-form">
              <div className="swap-drops">
                <Drop label="Your video" hint="Drop a clip, 4 to 30 seconds" accept="video" value={video} onChange={setVideo} />
                <span className="swap-arrow" aria-hidden="true">+</span>
                <Drop label="New character" hint="Drop a picture of who should be in it" accept="image" value={face} onChange={setFace} />
              </div>
              <label className="wf-field">
                <span>Who to replace</span>
                <input value={who} onChange={(e) => setWho(e.target.value)} placeholder="the man on the left, the woman in red…" maxLength={160} />
              </label>
              <div className="swap-quality" role="radiogroup" aria-label="Quality">
                {(["480p", "720p"] as const).map((q) => (
                  <button key={q} role="radio" aria-checked={quality === q} className={quality === q ? "on" : ""} onClick={() => setQuality(q)}>
                    {q === "480p" ? "Faster · 480p" : "Sharper · 720p"}
                  </button>
                ))}
              </div>
              {tooShort && <p className="library-error" role="alert">This video is under 4 seconds; Genjutsu needs at least 4.</p>}
              <button className="fire wf-run" disabled={!video || !face || running || tooShort} onClick={() => void go()}>
                {running ? "Swapping on Comfy Cloud…" : "Swap"}
                <span className="cost">{total !== null ? `about $${total.toFixed(2)} for ${Math.round(billed!)}s` : quote ? quote.label : "···"}</span>
              </button>
              <p className="wf-small">Only the first 30 seconds are used. Billed per second to your Comfy credits; an estimate, not an invoice.</p>
            </div>
            <div className="wf-result" aria-live="polite">
              {running ? <div className="wf-result-wait">Swapping. This takes a few minutes; the result appears here.</div>
                : result?.ok ? (
                  <>
                    <video src={result.url} controls autoPlay loop playsInline />
                    <div className="sheet-row">
                      {kept && <button className="pill on" onClick={() => setSaving(kept)}>Save to project</button>}
                      <a className="pill" href={result.url} download>Download</a>
                      <button className="pill" onClick={() => void go()}>Swap again</button>
                    </div>
                  </>
                ) : result && !result.ok ? <p className="library-error" role="alert">{result.reason}</p>
                : <div className="wf-result-wait">Your swapped video appears here.</div>}
            </div>
          </div>
        </div>
        <SiteFooter />
      </div>
    </div>
  );
}
