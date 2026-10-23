"use client";

import { ExtrasRow } from "../bank-picker";
import { wordsOf, type BankItem } from "../../story/bank";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { createCharacterStore, identityLock, type Character } from "../../characters/character";
import { EDIT_PRESETS, buildRecreation, presetShots, type RefShot } from "../../recreate/recreate";
import { defaultKv } from "../../story/kv";
import { createProjectStore } from "../../story/store";
import { Nav, openKeys } from "../nav";
import { uploadFile } from "../upload-client";
import { BuildLink } from "../return-bar";
import { readPick } from "../../story/handoff";
import { analyzeEdit } from "../recreate-actions";

/**
 * Recreate an edit: drop a reference video (an edit you love), say who is in
 * yours and where it happens, and haggs rebuilds it shot for shot: the same
 * count, the same lengths, the same words on screen, the same camera moves.
 * A video model reads the reference first (a few cents); the pictures and
 * clips are made afterwards on the board, each priced first.
 */

const PICTURE = 0.0686;
const CLIP = 0.1287;
const money = (n: number) => `$${n.toFixed(2)}`;

export function Recreate() {
  const router = useRouter();
  const store = useMemo(() => createProjectStore(defaultKv()), []);
  const file = useRef<HTMLInputElement>(null);
  const [video, setVideo] = useState<{ url: string; seconds: number; vertical: boolean } | null>(null);
  const [shots, setShots] = useState<RefShot[] | null>(null);
  const [cast, setCast] = useState<Character[]>([]);
  const [who, setWho] = useState<string | null>(null);
  const [instructions, setInstructions] = useState("");
  const [extras, setExtras] = useState<BankItem[]>([]);
  const [vertical, setVertical] = useState(false);
  const [mine, setMine] = useState<{ id: string; name: string; vertical: boolean; shots: RefShot[] }[]>([]);
  const [presetName, setPresetName] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void createCharacterStore(defaultKv()).list().then((all) => { setCast(all); const pick = readPick(window.location.search); if (pick?.kind === "character" && all.some((c) => c.id === pick.id)) setWho(pick.id); }).catch(() => undefined);
    void defaultKv().get<typeof mine>("recreate/presets").then((p) => setMine(p ?? [])).catch(() => undefined);
  }, []);

  async function savePreset() {
    if (!shots || !presetName.trim()) return;
    const next = [{ id: crypto.randomUUID(), name: presetName.trim().slice(0, 60), vertical, shots }, ...mine].slice(0, 30);
    await defaultKv().set("recreate/presets", next);
    setMine(next);
    setPresetName("");
  }

  async function dropPreset(id: string) {
    const next = mine.filter((m) => m.id !== id);
    await defaultKv().set("recreate/presets", next);
    setMine(next);
  }

  async function add(f: File) {
    setError(null);
    setShots(null);
    setBusy("Adding the video…");
    try {
      const added = await uploadFile(f);
      if (!added.ok) throw new Error(added.reason);
      const body = { url: added.url };
      const meta = await new Promise<{ seconds: number; vertical: boolean }>((resolve) => {
        const el = document.createElement("video");
        el.preload = "metadata";
        el.onloadedmetadata = () => resolve({ seconds: Math.round(el.duration * 10) / 10 || 10, vertical: el.videoHeight > el.videoWidth });
        el.onerror = () => resolve({ seconds: 10, vertical: false });
        el.src = body.url!;
      });
      setVideo({ url: body.url, ...meta });
      setVertical(meta.vertical);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The video couldn't be added.");
    } finally {
      setBusy(null);
    }
  }

  async function read() {
    if (!video) return;
    setBusy("A video model is watching it…");
    setError(null);
    const r = await analyzeEdit(video.url, video.seconds);
    setBusy(null);
    if (!r.ok) {
      if (r.needsKey) openKeys();
      return setError(r.reason);
    }
    setShots(r.shots);
  }

  async function make() {
    if (!shots) return;
    const person = cast.find((c) => c.id === who);
    const project = buildRecreation(`Edit recreation · ${shots.length} shots`, shots, { ...(person ? { lock: identityLock(person.traits), refs: [person.sheet] } : {}), instructions: [instructions.trim(), wordsOf(extras)].filter(Boolean).join(" "), aspect: vertical ? "9:16" : "16:9" });
    await store.save(project);
    router.push(`/board/${project.id}?b=${encodeURIComponent(project.boards![0]!.id)}`);
  }

  const change = (i: number, patch: Partial<RefShot>) => setShots((all) => all && all.map((s, k) => (k === i ? { ...s, ...patch } : s)));
  const total = shots?.reduce((n, s) => n + s.seconds, 0) ?? 0;

  return (
    <div className="app">
      <Nav current="Video" />
      <div className="canvas">
        <div className="swap">
          <nav className="modes" aria-label="Video">
            <Link href="/video">Make a clip</Link>
            <Link href="/series">Series</Link>
            <Link href="/recreate" aria-current="page">Recreate an edit</Link>
            <Link href="/found">Found footage</Link>
          </nav>
          <header className="swap-head">
            <h1>Recreate an edit</h1>
            <p>Drop an edit you love: a trailer, an ad, a viral cut. haggs finds every shot, then rebuilds the same edit around your character and your place.</p>
          </header>

          {!video && !shots && (
            <div className="recreate-presets">
              <b>Start from a structure</b>
              <div className="quick-row">
                {EDIT_PRESETS.map((p) => (
                  <button key={p.id} className="quick-card" onClick={() => { setShots(presetShots(p)); setVertical(p.vertical); setError(null); }} title={p.says}>
                    <b>{p.name}</b>
                    <small>{p.shots.length} shots · {p.vertical ? "vertical" : "landscape"}</small>
                  </button>
                ))}
                {mine.map((p) => (
                  <span key={p.id} className="quick-card mine">
                    <button className="plain" onClick={() => { setShots(p.shots); setVertical(p.vertical); setError(null); }}><b>{p.name}</b><small>Yours · {p.shots.length} shots</small></button>
                    <button className="plain danger" aria-label={`Remove ${p.name}`} onClick={() => void dropPreset(p.id)}>×</button>
                  </span>
                ))}
              </div>
              <b>Or copy an edit you love</b>
            </div>
          )}
          {!video && !shots ? (
            <div className="recreate-drop">
              <button className="fire" onClick={() => file.current?.click()} disabled={busy !== null}>{busy ?? "Add the reference video"}</button>
              <input ref={file} type="file" accept="video/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void add(f); }} />
              <p className="wf-small">Up to three minutes. It stays on this computer; only a few seconds of reading go to Comfy.</p>
            </div>
          ) : (
            <div className="recreate-body">
              {video && <video className="recreate-ref" src={video.url} controls muted playsInline />}
              <div className="recreate-side">
                <p className="wf-small">{video ? `${video.seconds}s · ${video.vertical ? "vertical" : "landscape"}. ` : "A starting structure. "}<button className="plain" onClick={() => { setVideo(null); setShots(null); }}>{video ? "Use a different one" : "Pick another"}</button></p>
                {!shots ? (
                  <button className="fire" disabled={busy !== null} onClick={() => void read()}>{busy ?? "Find the shots"} <span className="cost">about $0.03</span></button>
                ) : (
                  <>
                    <div className="series-pick">
                      <b>Who is in yours</b>
                      <div className="series-chips">
                        <button className={!who ? "on" : ""} onClick={() => setWho(null)}>Nobody in particular</button>
                        {cast.map((c) => <button key={c.id} className={who === c.id ? "on" : ""} onClick={() => setWho(c.id)}><img src={c.sheet} alt="" />{c.traits.name}</button>)}
                        <BuildLink className="plain" href="/characters" label="Recreate an edit">+ Build a character</BuildLink>
                      </div>
                    </div>
                    <ExtrasRow items={extras} onChange={setExtras} label="Recreate an edit" title="Where it is set and what they wear" />
                    <label className="wf-field"><span>Anything else to change (mood, time of day)</span><textarea rows={2} value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="Set it in Tokyo at night. She wears a red coat." maxLength={500} /></label>
                    {video && (
                      <form className="cast-add" onSubmit={(e) => { e.preventDefault(); void savePreset(); }}>
                        <input value={presetName} onChange={(e) => setPresetName(e.target.value)} placeholder="Save this edit as a preset: name it" aria-label="Preset name" maxLength={60} />
                        <button className="pill" disabled={!presetName.trim()}>Save</button>
                      </form>
                    )}
                    <button className="fire" onClick={() => void make()}>Make the board · {shots.length} shots, {total.toFixed(1)}s</button>
                    <p className="wf-small">Then on the board: pictures about {money(shots.length * PICTURE)}, clips about {money(shots.reduce((n, s) => n + Math.max(4, Math.round(s.seconds)) * CLIP, 0))}. Each priced before you press it.</p>
                  </>
                )}
                {error && <p className="library-error" role="alert">{error}</p>}
              </div>
            </div>
          )}
          {error && !video && !shots && <p className="library-error" role="alert">{error}</p>}

          {shots && (
            <ol className="recreate-shots">
              {shots.map((s, i) => (
                <li key={i}>
                  <header><b>{i + 1}</b><span>{s.start.toFixed(1)}–{s.end.toFixed(1)}s</span><small>{s.transition}{s.camera ? ` · ${s.camera}` : ""}</small></header>
                  <textarea rows={2} value={s.what} aria-label={`Shot ${i + 1}: what the camera sees`} onChange={(e) => change(i, { what: e.target.value })} />
                  <input value={s.text} placeholder="On-screen words" aria-label={`Shot ${i + 1}: on-screen words`} onChange={(e) => change(i, { text: e.target.value })} />
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}
