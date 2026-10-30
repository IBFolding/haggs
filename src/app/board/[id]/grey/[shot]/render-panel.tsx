"use client";

import { useRef, useState } from "react";

import { track } from "../../../../../activity/activity";
import { editEstimate } from "../../../../../providers/cloud-edits";
import type { BankItem } from "../../../../../story/bank";
import { atmosphere, describeLighting, describeScene, sceneIsEmpty, type GreyScene } from "../../../../../story/grey-scene";
import type { Project, Shot } from "../../../../../story/model";
import { runEdit } from "../../../../actions";
import { openKeys } from "../../../../nav";
import { uploadFile } from "../../../../upload-client";
import { creditsText } from "../../../../../story/price-text";

const money = (n: number) => creditsText(n);
type Candidate = { kind: "draft" | "relit" | "real" | "blender"; url: string; usd: number; origin: string; from: string | null };

/**
 * The Render step. Each pass makes a candidate you look at first; only
 * "Keep as a take" puts it on the shot, and the take that was there stays.
 *   1. Draft: the same composite you see, free, made on this computer.
 *   2. Relight: an AI pass that matches the actor's light to the lights you placed.
 *   3. Make it real: an AI pass that blends everything into one filmed picture.
 */
export function RenderPanel({ scene, project, shot, places, onTake }: { scene: GreyScene; project: Project; shot: Shot; places: BankItem[]; onTake: (url: string, usd: number, origin: string) => void }) {
  const [busy, setBusy] = useState<Candidate["kind"] | "export" | null>(null);
  const [blenderNotes, setBlenderNotes] = useState<string[]>([]);
  const pickRender = useRef<HTMLInputElement>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [notes, setNotes] = useState<string[]>([]);
  const [draft, setDraft] = useState<string | null>(null);
  const [relit, setRelit] = useState<string | null>(null);
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [kept, setKept] = useState<string | null>(null);
  const source = scene.source ?? shot.render;
  const seconds = shot.seconds ?? 4;
  const relightCost = editEstimate({ tool: "aleph", seconds });
  const realCost = editEstimate({ tool: "kling", seconds, resolution: "720p" });
  const place = places.find((p) => p.id === scene.place)?.name ?? scene.backdrop?.name;
  const empty = sceneIsEmpty(scene);
  const lighting = describeLighting(scene);
  const href = () => window.location.pathname + window.location.search;

  const items: [string, string][] = [
    ["Actor", scene.matte ? "cut out" : "not cut out yet"],
    ["Place", place ?? "none"],
    ["Surfaces", String((scene.surfaces ?? []).filter((s) => s.mask && s.texture && !s.hidden).length)],
    ["Props", String((scene.props ?? []).filter((p) => !p.hidden).length)],
    ["Lights", String(scene.lights?.length ?? 0)],
    ["Air", atmosphere(scene).map((a) => a.kind).join(", ") || "none"],
  ];

  async function makeDraft() {
    if (!source) return;
    setBusy("draft");
    setProblem(null);
    setKept(null);
    setCandidate(null);
    const r = await track(
      { label: "Draft render of the set", href: href(), failure: (x) => (x.ok ? null : (x.reason ?? "The draft didn't finish.")), result: (x) => (x.ok && x.url ? { url: x.url } : null) },
      async () => {
        const res = await fetch("/api/grey/render", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ scene: { ...scene, source: { url: source!.url, kind: source!.kind } }, footage: source!.url, seconds, aspect: project.aspect ?? "16:9", name: shot.heading || project.name }) }).catch(() => null);
        return ((await res?.json().catch(() => null)) ?? { ok: false, reason: "The render did not return a result. Check your connection and sign-in, then try again." }) as { ok: boolean; url?: string; reason?: string; notes?: string[] };
      },
    ).catch((e: unknown) => ({ ok: false, reason: e instanceof Error ? e.message : "The draft didn't finish.", url: undefined, notes: undefined }));
    setBusy(null);
    if (!r.ok || !r.url) return setProblem(r.reason ?? "The draft didn't finish.");
    setDraft(r.url);
    setRelit(null);
    setNotes(r.notes ?? []);
    setCandidate({ kind: "draft", url: r.url, usd: 0, origin: "Grey Room draft", from: source.url });
  }

  /** An AI pass over a video: look at it first, keep it or not. */
  async function pass(kind: "relit" | "real", source: string, tool: "aleph" | "kling", prompt: string, label: string) {
    setBusy(kind);
    setProblem(null);
    setKept(null);
    const r = await track(
      { label, href: href(), failure: (x) => (x.ok ? null : x.reason) },
      () => runEdit(tool === "aleph" ? { tool, video: source, seconds, prompt } : { tool, video: source, seconds, prompt, resolution: "720p" }),
    ).catch((e: unknown) => ({ ok: false as const, reason: e instanceof Error ? e.message : "The pass didn't run.", needsKey: false }));
    setBusy(null);
    if (!r.ok) {
      if ("needsKey" in r && r.needsKey) openKeys();
      return setProblem(r.reason);
    }
    if (kind === "relit") setRelit(r.url);
    setCandidate({ kind, url: r.url, usd: r.usd, origin: r.origin || (kind === "relit" ? "Grey Room, relit" : "Grey Room, made real"), from: source });
  }

  const relight = () => draft && pass("relit", draft, "aleph", `Relight the people in this shot so their lighting matches the set: ${lighting || "keep the light natural and consistent with the room"}. Keep their faces, expressions, skin tone, clothing and movement exactly as they are. Change only the light on them.`, "Relighting the actor");
  const makeReal = () => {
    const source = relit ?? draft;
    if (!source) return;
    const words = describeScene(scene, place);
    return pass("real", source, "kling", `Make this composite look like one filmed shot: match the light and colour across the actor, the set and the props, add natural contact shadows and reflections. Keep the actor's face, performance and movement exactly as they are. ${words ? `The scene is ${words}.` : ""}`.trim(), "Making the set look real");
  };

  /** The set as a folder Blender can build. */
  async function exportBlender() {
    if (!source) return;
    setBusy("export");
    setProblem(null);
    const res = await fetch("/api/grey/blender", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ scene, ...(shot.grey ? { grey: shot.grey } : {}), footage: source.url, footageKind: source.kind, seconds, aspect: project.aspect ?? "16:9", name: shot.heading || project.name }) }).catch(() => null);
    setBusy(null);
    if (!res?.ok) {
      const body = (await res?.json().catch(() => null)) as { reason?: string } | null;
      return setProblem(body?.reason ?? "The Blender set needs this app running on your own computer.");
    }
    try { setBlenderNotes(JSON.parse(decodeURIComponent(res.headers.get("x-haggs-notes") ?? "[]")) as string[]); } catch { setBlenderNotes([]); }
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "")?.[1] ?? "Haggs-Grey-Room.zip";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
  }

  /** A render made in Blender comes back as a candidate; the shot's own sound goes back under it. */
  async function bringBack(file: File | undefined) {
    if (!file || !source) return;
    setBusy("blender");
    setProblem(null);
    setKept(null);
    const up = await uploadFile(file);
    if (!up.ok || up.kind !== "video") { setBusy(null); return setProblem(up.ok ? "Choose the mp4 Blender made." : up.reason); }
    const res = await fetch("/api/grey/mux", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ video: up.url, sound: source.url }) }).catch(() => null);
    const body = (await res?.json().catch(() => null)) as { ok?: boolean; url?: string; reason?: string } | null;
    setBusy(null);
    if (!body?.ok || !body.url) return setProblem(body?.reason ?? "The render couldn't be brought in.");
    setCandidate({ kind: "blender", url: body.url, usd: 0, origin: "Blender render", from: null });
  }

  function keep() {
    if (!candidate) return;
    onTake(candidate.url, candidate.usd, candidate.origin);
    setKept(candidate.origin);
    setCandidate(null);
  }

  return (
    <div className="gs-panel">
      <section className="gs-sec">
        <h3>What's in the set</h3>
        <dl className="gs-sum">{items.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
        {empty && <p className="gs-soft">Nothing built yet. Cut the actor out and choose a place first.</p>}
      </section>

      <section className="gs-sec">
        <h3>1. Draft</h3>
        <p className="gs-soft">Render the current composition to a video preview. No generation credits. Review it before keeping a new take.</p>
        <button className="fire" disabled={busy !== null || empty || !source} onClick={() => void makeDraft()}>{busy === "draft" ? "Making the draft…" : draft ? "Make the draft again" : "Make a draft"} <span className="cost">free</span></button>
        {notes.map((n) => <p key={n} className="gs-soft">{n}</p>)}
      </section>

      <section className="gs-sec">
        <h3>2. Relight the actor <span className="gs-soft">(optional)</span></h3>
        <p className="gs-soft">An AI pass so the light on the people matches the lights you placed{lighting ? `: ${lighting}` : ""}. It can change skin and expression slightly, which is why you look before you keep it.</p>
        <button className="pill on" disabled={busy !== null || !draft} onClick={() => void relight()}>{busy === "relit" ? "Relighting…" : relit ? "Relight again" : "Relight"} <span className="cost">about {money(relightCost)}</span></button>
        {!draft && <p className="gs-soft">Make a draft first.</p>}
      </section>

      <section className="gs-sec">
        <h3>3. Make it real</h3>
        <p className="gs-soft">A video model blends the actor, set and props into one filmed picture, keeping the performance. It starts from {relit ? "your relit version" : "your draft"}.</p>
        <button className="fire" disabled={busy !== null || !draft} onClick={() => void makeReal()}>{busy === "real" ? "Working…" : "Make it real"} <span className="cost">about {money(realCost)}</span></button>
      </section>

      <section className="gs-sec">
        <h3>Blender <span className="gs-soft">(optional)</span></h3>
        <p className="gs-soft">For a shot that needs real 3D light or a finer render: take the set into Blender, finish it there, and bring the video back as a take.</p>
        <div className="gs-row">
          <button className="pill" disabled={busy !== null || empty || !source} onClick={() => void exportBlender()}>{busy === "export" ? "Gathering…" : "Export a Blender set"}</button>
          <button className="pill" disabled={busy !== null || !source} onClick={() => pickRender.current?.click()}>{busy === "blender" ? "Bringing it in…" : "Bring in a Blender render"}</button>
          <input ref={pickRender} type="file" accept="video/mp4,video/*" hidden onChange={(e) => { void bringBack(e.target.files?.[0]); e.target.value = ""; }} />
        </div>
        <ol className="gs-steps-list">
          <li>Export the set. It's a zip: open it, and read README.txt.</li>
          <li>In Blender, run build_scene.py, adjust anything, then Render Animation.</li>
          <li>Bring the mp4 back here. Your shot's sound is put back under it.</li>
        </ol>
        {blenderNotes.map((n) => <p key={n} className="gs-soft">{n}</p>)}
      </section>

      {candidate && (
        <section className="gs-sec gs-review" aria-label="Look before you keep it">
          <h3>{candidate.kind === "draft" ? "Your draft" : candidate.kind === "blender" ? "Your Blender render" : candidate.kind === "relit" ? "Relit: look at the faces" : "Made real: look at the faces"}</h3>
          <div className="gs-pair">
            {candidate.from && <figure>{candidate.from === source?.url && source.kind === "image" ? <img src={candidate.from} alt="Original room" /> : <video src={candidate.from} controls playsInline muted loop />}<figcaption>Before</figcaption></figure>}
            <figure><video src={candidate.url} controls playsInline muted loop autoPlay /><figcaption>{candidate.from ? "After" : "Draft"}</figcaption></figure>
          </div>
          <div className="gs-row">
            <button className="fire" onClick={keep}>Keep as a take {candidate.usd > 0 && <span className="cost">{money(candidate.usd)} spent</span>}</button>
            <button className="plain" onClick={() => setCandidate(null)}>Not this one</button>
          </div>
        </section>
      )}
      {kept && <p className="gs-done" role="status"><b>{kept}</b> is now a take on this shot. Your original take is still there; choose between them in the editor.</p>}
      {problem && <p className="library-error" role="alert">{problem}</p>}
    </div>
  );
}
