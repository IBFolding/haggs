"use client";

import { useEffect, useRef, useState } from "react";

import { applyOutline, outlineSource } from "../../../../../story/grey-outline";
import { track } from "../../../../../activity/activity";
import { actorMattePrompt, imageMattePrompt, IMAGE_MATTE_INPUT, MATTE_INPUT } from "../../../../../comfy/actor-matte";
import { surfaceWords, texturePrompt } from "../../../../../comfy/surface-texture";
import { editEstimate } from "../../../../../providers/cloud-edits";
import { addSurface, removeSurface, updateSurface, type GreyScene, type Surface } from "../../../../../story/grey-scene";
import { run } from "../../../../actions";
import { openKeys } from "../../../../nav";
import { uploadFile } from "../../../../upload-client";
import { runWorkflow } from "../../../../workflow-actions";
import { Slide } from "./set-panel";
import { AreaSelector } from "./area-selector";

const QUICK = ["Floor", "Wall", "Table", "Door", "Window", "Other surface"];
type Reference = { id: string; name: string; image?: string | null };

/** Walls, floors and other real surfaces in the footage, found and given a new material. */
export function SurfacesPanel({ scene, footageUrl, isVideo, references, onChange }: { scene: GreyScene; footageUrl: string | null; isVideo: boolean; references: Reference[]; onChange: (next: GreyScene) => void }) {
  const [selecting, setSelecting] = useState<{id:string; source:string} | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [words, setWords] = useState<Record<string, string>>({});
  const live = useRef(scene);
  live.current = scene;
  const source = outlineSource(scene, footageUrl, isVideo);
  const liveSource = useRef(source); liveSource.current = source;
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  function accept(id: string, started: string, patch: Pick<Surface, "mask" | "selection" | "mode" | "words">) {
    if (!mounted.current) return;
    const next = applyOutline(live.current, id, started, liveSource.current, patch);
    if (next !== live.current) onChange(next);
  }
  const href = () => window.location.pathname + window.location.search;
  const fail = (x: { ok: boolean; reason?: string }) => (x.ok ? null : (x.reason ?? "It didn't finish."));

  async function find(sf: Surface) {
    if (!footageUrl) return;
    const started = source;
    setBusy(`find:${sf.id}`);
    setProblem(null);
    const description = surfaceWords(sf.label, words[sf.id] ?? sf.words ?? "");
    const prompt = isVideo ? actorMattePrompt({ describe: description }) : imageMattePrompt(description);
    const r = await track({ label: `Finding the ${sf.label.toLowerCase()}`, href: href(), failure: fail }, () => runWorkflow({ file: JSON.stringify(prompt) }, {}, { [isVideo ? MATTE_INPUT : IMAGE_MATTE_INPUT]: footageUrl })).catch((e: unknown) => ({ ok: false as const, reason: e instanceof Error ? e.message : "It didn't finish.", needsKey: false }));
    setBusy(null);
    if (!mounted.current || started !== liveSource.current) return;
    if (!r.ok) {
      if ("needsKey" in r && r.needsKey) openKeys();
      return setProblem(r.reason);
    }
    accept(sf.id, started, { words: description, selection: undefined, mode: "material", mask: { kind: r.kind === "image" ? "image" : "video", url: r.url, at: Date.now(), price: r.price } });
  }

  async function uploadOutline(sf: Surface, file: File | undefined) {
    if (!file) return;
    const started = source;
    setBusy(`mask:${sf.id}`); setProblem(null);
    try {
      if (file.type !== "image/png") throw new Error("Choose a PNG cut-out with transparency outside the selected area.");
      const image = await createImageBitmap(file);
      const canvas = document.createElement("canvas");
      canvas.width = 128; canvas.height = 128;
      const context = canvas.getContext("2d")!;
      context.drawImage(image, 0, 0, 128, 128); image.close();
      const pixels = context.getImageData(0, 0, 128, 128).data;
      let clear = false, visible = false;
      for (let i = 3; i < pixels.length; i += 4) { clear ||= pixels[i]! < 10; visible ||= pixels[i]! > 245; }
      if (!clear || !visible) throw new Error("The outline must contain the selected surface and transparent pixels outside it. A black-and-white mask is not a cut-out.");
      const result = await uploadFile(file);
      if (!result.ok) throw new Error(result.reason);
      accept(sf.id, started, { selection: undefined, mode: "material", mask: { kind: "image", url: result.url, at: Date.now(), price: "Prepared outline" } });
    } catch (e) { setProblem(e instanceof Error ? e.message : "Outline upload failed."); }
    finally { setBusy(null); }
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
      <h3>What do you want to replace?</h3>
      <p className="gs-soft">Choose an area → outline it → apply a reference. Only the selected area changes; the rest of the shot stays in place. {isVideo ? "The outline follows the video." : "Draw your own outline for free, or use AI detection."}</p>
      <div className="gs-row">
        {QUICK.map((q) => <button key={q} className="pill" disabled={!footageUrl} onClick={() => onChange(addSurface(scene, q))}>+ {q}</button>)}
      </div>
      {(scene.surfaces ?? []).map((sf) => (
        <div key={sf.id} className="gs-surf">
          <div className="gs-surf-head">
            <b>{sf.label} · {sf.texture && sf.mask ? "Ready to review" : sf.mask ? "Choose material" : "Find outline"}</b>
            <span className="gs-lact">
              <button aria-label={sf.hidden ? "Show" : "Hide"} title={sf.hidden ? "Show" : "Hide"} onClick={() => onChange(updateSurface(scene, sf.id, { hidden: !sf.hidden }))}>{sf.hidden ? "○" : "●"}</button>
              <button aria-label="Remove" title="Remove" onClick={() => onChange(removeSurface(scene, sf.id))}>×</button>
            </span>
          </div>
          <p className="gs-soft">1. Select the exact area you want to change.</p>
          {!isVideo && footageUrl && <button className="pill on" disabled={busy !== null} onClick={() => setSelecting({id:sf.id,source})}>{sf.selection ? "Redraw area" : "Draw area on photo"} <span className="cost">free</span></button>}
          <div className="gs-row">
            <input className="gs-name" type="text" maxLength={120} value={words[sf.id] ?? sf.words ?? ""} placeholder={surfaceWords(sf.label, "")} onChange={(e) => setWords({ ...words, [sf.id]: e.target.value })} aria-label={`Words to find the ${sf.label}`} />
            <button className="pill" disabled={busy !== null || !footageUrl} onClick={() => void find(sf)}>{busy === `find:${sf.id}` ? "Finding…" : sf.mask ? "Find again" : "Find it"} <span className="cost">GPU time</span></button>
          </div>
          {!isVideo && <label className="gs-field">Or upload a prepared outline (PNG)
            <input type="file" accept="image/png" disabled={busy !== null} onChange={e => { void uploadOutline(sf, e.target.files?.[0]); e.target.value = ""; }} />
            <small>Use the room photo at its original size, with everything outside this surface made transparent. This requires no AI generation.</small>
          </label>}
          {sf.mask && (
            <>
              <details><summary>Review selected area</summary>{sf.mask.kind === "image" ? <img className="gs-mask-review" src={sf.mask.url} alt={`${sf.label} detected area`} /> : <video className="gs-mask-review" src={sf.mask.url} controls muted playsInline loop />}</details>
              <label className="gs-field">2. How should this reference be used?
                <select value={sf.mode ?? "material"} onChange={e => onChange(updateSurface(live.current, sf.id, { mode: e.target.value as "material" | "replace" }))}>
                  <option value="material">Material finish · keep original shading</option>
                  <option value="replace" disabled={!sf.selection}>Replacement image · fit inside drawn area</option>
                </select>
              </label>
              <p className="gs-soft">{sf.mode === "replace" ? "The reference is cropped to fill your outline. Use a door, window or other object photographed from a similar angle. This is a flat composite." : "Use a close-up texture for paint, flooring or upholstery. Draw an area to enable a fitted replacement image."}</p>
              <div className="gs-reference-board" aria-label={`Material references for ${sf.label}`}>
                {references.filter(r => r.image).map(r => <button key={r.id} className="gs-place" disabled={busy !== null} aria-pressed={sf.texture?.url === r.image} onClick={() => onChange(updateSurface(live.current, sf.id, {texture: {url: r.image!, name: r.name, scale: 1}}))}><img src={r.image!} alt="" /><span>{r.name}</span></button>)}
              </div>
              <TextureControls sf={sf} busy={busy !== null} onUpload={(f) => void upload(sf, f)} onMake={(t) => void makeTexture(sf, t)} />
              {sf.texture && (
                <div className="gs-sliders">
                  <Slide label="Amount" min={0} max={1} step={0.01} value={sf.strength} onChange={(v) => onChange(updateSurface(scene, sf.id, { strength: v }))} />
                  {sf.mode !== "replace" && <Slide label="Pattern size" min={0.1} max={4} step={0.05} value={sf.texture.scale} onChange={(v) => onChange(updateSurface(scene, sf.id, { texture: { ...sf.texture!, scale: v } }))} />}
                </div>
              )}
            </>
          )}
        </div>
      ))}
      {selecting && selecting.source === source && footageUrl && <AreaSelector key={source} source={footageUrl} label={scene.surfaces?.find(s => s.id === selecting.id)?.label ?? "area"} onClose={() => setSelecting(null)} onSave={(url, selection) => accept(selecting.id, selecting.source, { selection, mask: { kind: "image", url, at: Date.now(), price: "Manual selection · free" } })} />}
      {problem && <p className="library-error" role="alert">{problem}</p>}
    </section>
  );
}

function TextureControls({ sf, busy, onUpload, onMake }: { sf: Surface; busy: boolean; onUpload: (f: File | undefined) => void; onMake: (words: string) => void }) {
  const pick = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  return (
    <div className="gs-tex">
      {sf.texture && <figure className="gs-material-card"><img src={sf.texture.url} alt={sf.texture.name} /><figcaption>{sf.texture.name}</figcaption></figure>}
      <div className="gs-row">
        <input className="gs-name" type="text" maxLength={200} value={text} placeholder="aged red brick" onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !busy && text.trim()) onMake(text); }} aria-label={`Material for the ${sf.label}`} />
        <button className="pill on" disabled={busy || !text.trim()} onClick={() => onMake(text)}>{busy ? "Making…" : "Make it"} <span className="cost">about ${editEstimate({ tool: "flux3", seconds: 0, resolution: "1K" }).toFixed(2)}</span></button>
      </div>
      <div className="gs-row">
        <button className="pill" disabled={busy} onClick={() => pick.current?.click()}>Upload material reference</button>
        {sf.texture && <span className="gs-soft">Using {sf.texture.name}</span>}
        <input ref={pick} type="file" accept="image/*" hidden onChange={(e) => { onUpload(e.target.files?.[0]); e.target.value = ""; }} />
      </div>
    </div>
  );
}
