"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { createCharacterStore, identityLock, type Character } from "../../characters/character";
import { editEstimate, VOICES } from "../../providers/cloud-edits";
import { FORMATS, buildSeries, pictureWords, type FormatId, type Series } from "../../series/series";
import { defaultKv } from "../../story/kv";
import { createProjectStore } from "../../story/store";
import { STYLES } from "../../styles/style";
import { run as runModel, speakLine } from "../actions";
import { Nav, openKeys } from "../nav";
import { draftSeries, makeStill } from "../series-actions";

/**
 * Series: a topic becomes a run of short vertical videos, and you watch it
 * become real on one page. Pick a format, who is in it and how it looks,
 * write it (Claude here, or over MCP), make the pictures right where you
 * read the words, then open it in the editor to animate and render.
 */

const PRICE = editEstimate({ tool: "flux3", seconds: 0, resolution: "1K" });
/** MiniMax H3 at 768P: $0.1287 a second, from Comfy's published price. */
const CLIP_RATE = 0.1287;
const money = (n: number) => `$${n.toFixed(2)}`;

type Sent = { id: string; summary: string; payload: { format: FormatId; series: Series } };

export function SeriesMaker() {
  const router = useRouter();
  const store = useMemo(() => createProjectStore(defaultKv()), []);
  const characters = useMemo(() => createCharacterStore(defaultKv()), []);
  const [format, setFormat] = useState<FormatId>("what-if");
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState(3);
  const [cast, setCast] = useState<Character[]>([]);
  const [who, setWho] = useState<string | null>(null);
  const [lookId, setLookId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [series, setSeries] = useState<Series | null>(null);
  const [pictures, setPictures] = useState<Record<string, string>>({});
  const [clips, setClips] = useState<Record<string, string>>({});
  const [making, setMaking] = useState<string | null>(null);
  const [voice, setVoice] = useState<string>("Matilda (female, american)");
  const [spoken, setSpoken] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [sent, setSent] = useState<Sent[]>([]);
  const stop = useRef(false);

  useEffect(() => {
    void characters.list().then(setCast);
  }, [characters]);

  // What Claude has sent over MCP, waiting to be applied.
  useEffect(() => {
    let live = true;
    const look = () => fetch("/api/bridge/inbox?project=series").then((r) => (r.ok ? r.json() : null)).then((b: { items?: (Sent & { kind: string })[] } | null) => live && b?.items && setSent(b.items.filter((i) => i.kind === "series"))).catch(() => undefined);
    void look();
    const t = setInterval(look, 4000);
    return () => { live = false; clearInterval(t); };
  }, []);

  const person = cast.find((c) => c.id === who) ?? null;
  const style = STYLES.find((s) => s.id === lookId) ?? null;
  const words = { ...(style ? { look: style.words } : {}), ...(person ? { lock: identityLock(person.traits) } : {}) };

  async function write() {
    setBusy(true);
    setError(null);
    setNote(null);
    const r = await draftSeries(format, topic, count);
    setBusy(false);
    if (!r.ok) {
      if (r.needsKey) {
        // No Claude key needed: the connected Claude writes it over MCP and sends it here.
        const ask = `Use haggs_propose_series to write a ${FORMATS.find((f) => f.id === format)!.label} series of ${count} short vertical video${count === 1 ? "" : "s"} for haggs about: ${topic.trim()}`;
        await navigator.clipboard?.writeText(ask).catch(() => undefined);
        return setNote("Copied a request. Paste it to Claude (the haggs MCP is connected) and the series lands here for you to apply.");
      }
      return setError(r.reason);
    }
    setSeries(r.series);
    setPictures({});
    setClips({});
    setSpoken({});
  }

  function applySent(i: Sent) {
    void fetch(`/api/bridge/inbox?project=series&id=${encodeURIComponent(i.id)}`, { method: "DELETE" }).catch(() => undefined);
    setSent((all) => all.filter((x) => x.id !== i.id));
    setFormat(i.payload.format);
    setSeries(i.payload.series);
    setPictures({});
  }

  async function picture(e: number, s: number): Promise<boolean> {
    const sh = series!.episodes[e]!.shots[s]!;
    const key = `${e}.${s}`;
    setMaking(key);
    const r = await makeStill(pictureWords(sh.picture, words), "9:16", person?.sheet ? [person.sheet] : []);
    setMaking(null);
    if (!r.ok) {
      if (r.needsKey) openKeys();
      setError(r.reason);
      return false;
    }
    setPictures((p) => ({ ...p, [key]: r.url }));
    return true;
  }

  /** One picture becomes its clip, started from the picture itself. */
  async function animate(e: number, s: number): Promise<boolean> {
    const sh = series!.episodes[e]!.shots[s]!;
    const key = `${e}.${s}`;
    const still = pictures[key];
    if (!still) return false;
    setMaking(`clip:${key}`);
    const r = await runModel("minimax/minimax-h3", `${sh.picture}. Gentle camera move, natural motion, the moment plays out.`, { resolution: "768P", ratio: "9:16", duration: Math.max(4, Math.round(sh.seconds)) }, [still], true);
    setMaking(null);
    const first = r.ok ? r.shots[0] : undefined;
    if (!r.ok || !first) {
      if (!r.ok && r.needsKey) openKeys();
      setError(r.ok ? "The clip didn't come back." : r.reason);
      return false;
    }
    setClips((c) => ({ ...c, [key]: first.url }));
    return true;
  }

  async function animateAll() {
    if (!series) return;
    stop.current = false;
    setError(null);
    for (const [e, ep] of series.episodes.entries()) {
      for (let s = 0; s < ep.shots.length; s++) {
        if (!pictures[`${e}.${s}`] || clips[`${e}.${s}`]) continue;
        if (stop.current || !(await animate(e, s))) return;
      }
    }
  }

  async function all() {
    if (!series) return;
    stop.current = false;
    setError(null);
    for (const [e, ep] of series.episodes.entries()) {
      for (let s = 0; s < ep.shots.length; s++) {
        if (pictures[`${e}.${s}`]) continue;
        if (stop.current || !(await picture(e, s))) return;
      }
    }
  }

  async function narrate() {
    if (!series) return;
    setError(null);
    for (const [e, ep] of series.episodes.entries()) {
      for (const [k, sh] of ep.shots.entries()) {
        const key = `${e}.${k}`;
        if (!sh.narration.trim() || spoken[key]) continue;
        setMaking(`say:${key}`);
        const r = await speakLine(sh.narration, voice);
        setMaking(null);
        if (!r.ok) { if (r.needsKey) openKeys(); return setError(r.reason); }
        setSpoken((all) => ({ ...all, [key]: r.url }));
      }
    }
  }

  async function open() {
    if (!series) return;
    const project = buildSeries(series, format, { ...words, ...(person?.sheet ? { refs: [person.sheet] } : {}), pictures, clips, voice, narrationUrls: spoken });
    await store.save(project);
    router.push(`/board/${project.id}/cut?b=${encodeURIComponent(project.boards![0]!.id)}`);
  }

  const change = (e: number, s: number, patch: Partial<Series["episodes"][number]["shots"][number]>) =>
    setSeries((cur) => cur && { ...cur, episodes: cur.episodes.map((ep, i) => (i === e ? { ...ep, shots: ep.shots.map((sh, k) => (k === s ? { ...sh, ...patch } : sh)) } : ep)) });
  const total = series?.episodes.reduce((n, e) => n + e.shots.length, 0) ?? 0;
  const done = Object.keys(pictures).length;
  const left = total - done;
  const secondsOf = (k: string) => { const [e, sIdx] = k.split(".").map(Number); return Math.max(4, Math.round(series?.episodes[e!]?.shots[sIdx!]?.seconds ?? 4)); };
  const toAnimate = Object.keys(pictures).filter((k) => !clips[k]);
  const animatePrice = toAnimate.reduce((n, k) => n + secondsOf(k) * CLIP_RATE, 0);
  const lines = series?.episodes.flatMap((ep, e) => ep.shots.flatMap((sh, k) => (sh.narration.trim() && !spoken[`${e}.${k}`] ? [sh.narration] : []))) ?? [];
  const hasNarration = (series?.episodes.some((ep) => ep.shots.some((sh) => sh.narration.trim())) ?? false);
  const sayPrice = editEstimate({ tool: "speech", seconds: 0, characters: lines.reduce((n, l) => n + l.length, 0) });

  return (
    <div className="app">
      <Nav current="Video" />
      <div className="canvas">
        <div className="swap">
          <nav className="modes" aria-label="Video">
            <Link href="/video">Make a clip</Link>
            <Link href="/series" aria-current="page">Series</Link>
          </nav>

          {sent.length > 0 && (
            <div className="cv-sent series-sent" role="status">
              {sent.map((i) => (
                <div key={i.id}>
                  <b>Claude sent a series</b> <span>{i.summary}</span>
                  <button className="pill on" onClick={() => applySent(i)}>Apply</button>
                </div>
              ))}
            </div>
          )}

          {!series ? (
            <div className="series-form">
              <header className="swap-head">
                <h1>Make a series</h1>
                <p>Pick the kind, who is in it and how it looks. Then watch it turn into pictures on this page.</p>
              </header>
              <div className="series-formats" role="radiogroup" aria-label="Format">
                {FORMATS.map((f) => (
                  <button key={f.id} role="radio" aria-checked={format === f.id} className={format === f.id ? "on" : ""} onClick={() => setFormat(f.id)}>
                    <b>{f.label}</b>
                    <span>{f.blurb}</span>
                  </button>
                ))}
              </div>

              <div className="series-pick">
                <b>Who is in it</b>
                <div className="series-chips">
                  <button className={!who ? "on" : ""} onClick={() => setWho(null)}>Nobody in particular</button>
                  {cast.map((c) => (
                    <button key={c.id} className={who === c.id ? "on" : ""} onClick={() => setWho(c.id)} title={c.traits.name}><img src={c.sheet} alt="" />{c.traits.name}</button>
                  ))}
                  <Link href="/characters" className="plain">+ Build a character</Link>
                </div>
              </div>
              <div className="series-pick">
                <b>How it looks</b>
                <div className="series-chips">
                  <button className={!lookId ? "on" : ""} onClick={() => setLookId(null)}>Natural</button>
                  {STYLES.map((st) => <button key={st.id} className={lookId === st.id ? "on" : ""} onClick={() => setLookId(st.id)} title={st.says}>{st.name}</button>)}
                </div>
              </div>

              <label className="wf-field">
                <span>What is it about?</span>
                <textarea rows={3} value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={1000} placeholder="Strange things that would happen if your body kept doing one thing forever" />
              </label>
              <label className="wf-field wf-field-inline">
                <span>How many videos</span>
                <input type="number" min={1} max={8} value={count} onChange={(e) => setCount(Math.min(8, Math.max(1, Number(e.target.value) || 1)))} />
              </label>
              {error && <p className="library-error" role="alert">{error}</p>}
              {note && <p className="wf-note" role="status">{note}</p>}
              <button className="fire wf-run" disabled={busy || topic.trim().length < 4} onClick={() => void write()}>
                {busy ? "Writing…" : "Write the series"}
              </button>
              <p className="wf-small">Written on your Claude key, or by Claude over MCP if you have none. Nothing is made yet, so nothing is spent.</p>
            </div>
          ) : (
            <div className="series-draft">
              <header className="series-bar">
                <input value={series.title} maxLength={80} aria-label="Series name" onChange={(e) => setSeries({ ...series, title: e.target.value })} />
                <span>{done}/{total} pictures</span>
                {making ? <button className="pill" onClick={() => { stop.current = true; }}>Stop after this one</button> : <button className="fire" disabled={left === 0} onClick={() => void all()}>{left === 0 ? "All pictures made" : `Make ${left} picture${left === 1 ? "" : "s"} · ${money(left * PRICE)}`}</button>}
                {hasNarration && (
                  <>
                    <select value={voice} onChange={(e) => setVoice(e.target.value)} aria-label="Narrator voice">{VOICES.map((v) => <option key={v}>{v}</option>)}</select>
                    <button className="pill" disabled={making !== null || lines.length === 0} onClick={() => void narrate()}>{lines.length === 0 ? "Narrated" : `Narrate it · ${money(sayPrice)}`}</button>
                  </>
                )}
                {done > 0 && !making && <button className="pill" disabled={toAnimate.length === 0} onClick={() => void animateAll()}>{toAnimate.length === 0 ? "All animated" : `Animate ${toAnimate.length} · ${money(animatePrice)}`}</button>}
                <button className="pill on" onClick={() => void open()}>Open in the editor</button>
                <button className="plain" onClick={() => setSeries(null)}>Start again</button>
              </header>
              {error && <p className="library-error" role="alert">{error}</p>}
              {series.episodes.map((ep, e) => (
                <section key={e} className="series-ep">
                  <h2><span>{e + 1}</span>{ep.hook || `Video ${e + 1}`}</h2>
                  <div className="series-row">
                    {ep.shots.map((sh, s) => {
                      const key = `${e}.${s}`;
                      return (
                        <figure key={s} className="series-card">
                          <div className={`series-frame${making === key || making === `clip:${key}` ? " working" : ""}`}>
                            {clips[key] ? <video src={clips[key]} muted loop playsInline autoPlay /> : pictures[key] ? <img src={pictures[key]} alt={sh.picture} /> : <p>{sh.picture}</p>}
                            {sh.caption && <span className="series-cap">{sh.caption}</span>}
                          </div>
                          {sh.narration && <textarea rows={3} value={sh.narration} aria-label={`Video ${e + 1}, shot ${s + 1}: narration`} onChange={(ev) => change(e, s, { narration: ev.target.value })} />}
                          <input value={sh.caption} placeholder="On-screen words" aria-label={`Video ${e + 1}, shot ${s + 1}: on-screen words`} maxLength={120} onChange={(ev) => change(e, s, { caption: ev.target.value })} />
                          <figcaption>
                            <small>{sh.seconds}s</small>
                            <span>
                              <button className="plain" disabled={making !== null} onClick={() => void picture(e, s)}>{pictures[key] ? "Remake" : "Make"} · {money(PRICE)}</button>
                              {pictures[key] && !clips[key] && <button className="plain" disabled={making !== null} onClick={() => void animate(e, s)}>Animate · {money(sh.seconds * CLIP_RATE)}</button>}
                            </span>
                          </figcaption>
                        </figure>
                      );
                    })}
                  </div>
                </section>
              ))}
              <p className="wf-small">Animate turns each picture into its clip right here. In the editor you add music and effects, trim, and Render MP4 burns the words in.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
