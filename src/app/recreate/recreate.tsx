"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { createCharacterStore, identityLock, type Character } from "../../characters/character";
import { buildRecreation, type RefShot } from "../../recreate/recreate";
import { defaultKv } from "../../story/kv";
import { createProjectStore } from "../../story/store";
import { Nav, openKeys } from "../nav";
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
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void createCharacterStore(defaultKv()).list().then(setCast).catch(() => undefined);
  }, []);

  async function add(f: File) {
    setError(null);
    setShots(null);
    setBusy("Adding the video…");
    try {
      const form = new FormData();
      form.append("file", f);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const body = (await res.json()) as { ok?: boolean; url?: string; reason?: string };
      if (!body.ok || !body.url) throw new Error(body.reason ?? "The video couldn't be added.");
      const meta = await new Promise<{ seconds: number; vertical: boolean }>((resolve) => {
        const el = document.createElement("video");
        el.preload = "metadata";
        el.onloadedmetadata = () => resolve({ seconds: Math.round(el.duration * 10) / 10 || 10, vertical: el.videoHeight > el.videoWidth });
        el.onerror = () => resolve({ seconds: 10, vertical: false });
        el.src = body.url!;
      });
      setVideo({ url: body.url, ...meta });
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
    if (!shots || !video) return;
    const person = cast.find((c) => c.id === who);
    const project = buildRecreation(`Edit recreation · ${shots.length} shots`, shots, { ...(person ? { lock: identityLock(person.traits), refs: [person.sheet] } : {}), instructions, aspect: video.vertical ? "9:16" : "16:9" });
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
          </nav>
          <header className="swap-head">
            <h1>Recreate an edit</h1>
            <p>Drop an edit you love: a trailer, an ad, a viral cut. haggs finds every shot, then rebuilds the same edit around your character and your place.</p>
          </header>

          {!video ? (
            <div className="recreate-drop">
              <button className="fire" onClick={() => file.current?.click()} disabled={busy !== null}>{busy ?? "Add the reference video"}</button>
              <input ref={file} type="file" accept="video/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void add(f); }} />
              <p className="wf-small">Up to three minutes. It stays on this computer; only a few seconds of reading go to Comfy.</p>
            </div>
          ) : (
            <div className="recreate-body">
              <video className="recreate-ref" src={video.url} controls muted playsInline />
              <div className="recreate-side">
                <p className="wf-small">{video.seconds}s · {video.vertical ? "vertical" : "landscape"}. <button className="plain" onClick={() => { setVideo(null); setShots(null); }}>Use a different one</button></p>
                {!shots ? (
                  <button className="fire" disabled={busy !== null} onClick={() => void read()}>{busy ?? "Find the shots"} <span className="cost">about $0.03</span></button>
                ) : (
                  <>
                    <div className="series-pick">
                      <b>Who is in yours</b>
                      <div className="series-chips">
                        <button className={!who ? "on" : ""} onClick={() => setWho(null)}>Nobody in particular</button>
                        {cast.map((c) => <button key={c.id} className={who === c.id ? "on" : ""} onClick={() => setWho(c.id)}><img src={c.sheet} alt="" />{c.traits.name}</button>)}
                        <Link className="plain" href="/characters">+ Build a character</Link>
                      </div>
                    </div>
                    <label className="wf-field"><span>Anything to change (place, outfit, mood)</span><textarea rows={2} value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="Set it in Tokyo at night. She wears a red coat." maxLength={500} /></label>
                    <button className="fire" onClick={() => void make()}>Make the board · {shots.length} shots, {total.toFixed(1)}s</button>
                    <p className="wf-small">Then on the board: pictures about {money(shots.length * PICTURE)}, clips about {money(shots.reduce((n, s) => n + Math.max(4, Math.round(s.seconds)) * CLIP, 0))}. Each priced before you press it.</p>
                  </>
                )}
                {error && <p className="library-error" role="alert">{error}</p>}
              </div>
            </div>
          )}
          {error && !video && <p className="library-error" role="alert">{error}</p>}

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
