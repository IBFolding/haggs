"use client";

import { useRef, useState } from "react";

import { track } from "../../../../../activity/activity";
import { actorMattePrompt, MATTE_INPUT } from "../../../../../comfy/actor-matte";
import { surfaceWords, texturePrompt } from "../../../../../comfy/surface-texture";
import { editEstimate } from "../../../../../providers/cloud-edits";
import { addSurface, removeSurface, updateSurface, type GreyScene, type Surface } from "../../../../../story/grey-scene";
import { run } from "../../../../actions";
import { openKeys } from "../../../../nav";
import { uploadFile } from "../../../../upload-client";
import { runWorkflow } from "../../../../workflow-actions";
import { Slide } from "./set-panel";

const QUICK = ["Wall", "Floor", "Table", "Door"];

/** Walls, floors and other real surfaces in the footage, found and given a new material. */
export function SurfacesPanel({ scene, footageUrl, isVideo, onChange }: { scene: GreyScene; footageUrl: string | null; isVideo: boolean; onChange: (next: GreyScene) => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [words, setWords] = useState<Record<string, string>>({});
  const live = useRef(scene);
  live.current = scene;
  const href = () => window.location.pathname + window.location.search;
  const fail = (x: { ok: boolean; reason?: string }) => (x.ok ? null : (x.reason ?? "It didn't finish."));

  async function find(sf: Surface) {
    if (!footageUrl) return;
    setBusy(`find:${sf.id}`);
    setProblem(null);
    const prompt = actorMattePrompt({ describe: surfaceWords(sf.label, words[sf.id] ?? sf.words ?? "") });
    const r = await track({ label: `Finding the ${sf.label.toLowerCase()}`, href: href(), failure: fail }, () => runWorkflow({ file: JSON.stringify(prompt) }, {}, { [MATTE_INPUT]: footageUrl })).catch((e: unknown) => ({ ok: false as const, reason: e instanceof Error ? e.message : "It didn't finish.", needsKey: false }));
    setBusy(null);
    if (!r.ok) {
      if ("needsKey" in r && r.needsKey) openKeys();
      return setProblem(r.reason);
    }
    onChange(updateSurface(live.current, sf.id, { words: surfaceWords(sf.label, words[sf.id] ?? sf.words ?? ""), mask: { url: r.url, at: Date.now(), price: r.price } }));
  }

  async function upload(sf: Surface, file: File | undefined) {
    if (!file) return;
    setBusy(`tex:${sf.id}`);
    setProblem(null);
    const r = await uploadFile(file);
    setBusy(null);
    if (!r.ok || r.kind !== "image") return setProblem(r.ok ? "Add a picture." : r.reason);
    onChange(updateSurface(live.current, sf.id, { texture: { url: r.url, name: file.name.replace(/\.[^.]+$/, ""), scale: sf.texture?.scale ?? 1 } }));
  }

  async function makeTexture(sf: Surface, text: string) {
    const prompt = texturePrompt(text);
    if (!prompt) return;
    setBusy(`tex:${sf.id}`);
    setProblem(null);
    const r = await track({ label: `Making ${text.trim().slice(0, 30)}`, href: href(), failure: fail }, () => run("bfl/flux-3-image", prompt, {})).catch((e: unknown) => ({ ok: false as const, reason: e instanceof Error ? e.message : "It didn't finish.", needsKey: false }));
    setBusy(null);
    const first = r.ok ? r.shots[0] : undefined;
    if (!r.ok || !first) {
      if ("needsKey" in r && r.needsKey) openKeys();
      return setProblem(r.ok ? "No picture came back." : r.reason);
    }
    onChange(updateSurface(live.current, sf.id, { texture: { url: first.url, name: text.trim().slice(0, 40), scale: sf.texture?.scale ?? 1 } }));
  }

  return (
    <section className="gs-sec">
      <h3>Walls and floors</h3>
      <p className="gs-soft">For a wall, floor or table you filmed. haggs finds it in the footage, then lays a new material over it and keeps its real shading. {isVideo ? "" : "This needs a video shot."}</p>
      <div className="gs-row">
        {QUICK.map((q) => <button key={q} className="pill" disabled={!isVideo} onClick={() => onChange(addSurface(scene, q))}>+ {q}</button>)}
      </div>
      {(scene.surfaces ?? []).map((sf) => (
        <div key={sf.id} className="gs-surf">
          <div className="gs-surf-head">
            <b>{sf.label}</b>
            <span className="gs-lact">
              <button aria-label={sf.hidden ? "Show" : "Hide"} title={sf.hidden ? "Show" : "Hide"} onClick={() => onChange(updateSurface(scene, sf.id, { hidden: !sf.hidden }))}>{sf.hidden ? "○" : "●"}</button>
              <button aria-label="Remove" title="Remove" onClick={() => onChange(removeSurface(scene, sf.id))}>×</button>
            </span>
          </div>
          <div className="gs-row">
            <input className="gs-name" type="text" maxLength={120} value={words[sf.id] ?? sf.words ?? ""} placeholder={surfaceWords(sf.label, "")} onChange={(e) => setWords({ ...words, [sf.id]: e.target.value })} aria-label={`Words to find the ${sf.label}`} />
            <button className="pill" disabled={busy !== null || !footageUrl} onClick={() => void find(sf)}>{busy === `find:${sf.id}` ? "Finding…" : sf.mask ? "Find again" : "Find it"} <span className="cost">GPU time</span></button>
          </div>
          {sf.mask && (
            <>
              <TextureControls sf={sf} busy={busy === `tex:${sf.id}`} onUpload={(f) => void upload(sf, f)} onMake={(t) => void makeTexture(sf, t)} />
              {sf.texture && (
                <div className="gs-sliders">
                  <Slide label="Amount" min={0} max={1} step={0.01} value={sf.strength} onChange={(v) => onChange(updateSurface(scene, sf.id, { strength: v }))} />
                  <Slide label="Pattern size" min={0.1} max={4} step={0.05} value={sf.texture.scale} onChange={(v) => onChange(updateSurface(scene, sf.id, { texture: { ...sf.texture!, scale: v } }))} />
                </div>
              )}
            </>
          )}
        </div>
      ))}
      {problem && <p className="library-error" role="alert">{problem}</p>}
    </section>
  );
}

function TextureControls({ sf, busy, onUpload, onMake }: { sf: Surface; busy: boolean; onUpload: (f: File | undefined) => void; onMake: (words: string) => void }) {
  const pick = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  return (
    <div className="gs-tex">
      <div className="gs-row">
        <input className="gs-name" type="text" maxLength={200} value={text} placeholder="aged red brick" onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") onMake(text); }} aria-label={`Material for the ${sf.label}`} />
        <button className="pill on" disabled={busy || !text.trim()} onClick={() => onMake(text)}>{busy ? "Making…" : "Make it"} <span className="cost">about ${editEstimate({ tool: "flux3", seconds: 0, resolution: "1K" }).toFixed(2)}</span></button>
      </div>
      <div className="gs-row">
        <button className="pill" disabled={busy} onClick={() => pick.current?.click()}>Or add a picture</button>
        {sf.texture && <span className="gs-soft">Using {sf.texture.name}</span>}
        <input ref={pick} type="file" accept="image/*" hidden onChange={(e) => { onUpload(e.target.files?.[0]); e.target.value = ""; }} />
      </div>
    </div>
  );
}
