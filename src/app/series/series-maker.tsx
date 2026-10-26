"use client";

import { galleryAudio } from "../gallery-log";
import { ExtrasRow } from "../bank-picker";
import { allocateRefs, wordsOf, type BankItem } from "../../story/bank";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { createCharacterStore, identityLock, type Character } from "../../characters/character";
import { editEstimate, VOICES } from "../../providers/cloud-edits";
import { FORMATS, FORMAT_SAMPLES, PRESETS, buildSeries, pictureWords, type FormatId, type Series } from "../../series/series";
import { defaultKv } from "../../story/kv";
import { createProjectStore } from "../../story/store";
import { looksTooBig, shrinkAll } from "../shrink";
import { createTemplateStore, templateRules, MY_FORMAT, type CustomFormat } from "../../series/custom";
import { StyleMaker } from "../style-maker";
import { TemplateMaker } from "../template-maker";
import { useStyles } from "../use-styles";
import { run as runModel, speakLine } from "../actions";
import { Nav, openKeys } from "../nav";
import { BuildLink } from "../return-bar";
import { readPick } from "../../story/handoff";
import { draftSeries, makeStill } from "../series-actions";
import { ModeTabs } from "../mode-tabs";
import { galleryRun, galleryStill } from "../gallery-log";
import { SiteFooter } from "../site-footer";
import { creditsText } from "../../story/price-text";

/**
 * Series: a topic becomes a run of short vertical videos, and you watch it
 * become real on one page. Pick a format, who is in it and how it looks,
 * write it (Claude here, or over MCP), make the pictures right where you
 * read the words, then open it in the editor to animate and render.
 */

const PRICE = editEstimate({ tool: "flux3", seconds: 0, resolution: "1K" });
/** MiniMax H3 at 768P: $0.1287 a second, from Comfy's published price. */
const CLIP_RATE = 0.1287;
const money = (n: number) => creditsText(n);
type Sent = { id: string; summary: string; payload: { format: FormatId; series: Series } };

export function SeriesMaker() {
  const router = useRouter();
  const store = useMemo(() => createProjectStore(defaultKv()), []);
  const characters = useMemo(() => createCharacterStore(defaultKv()), []);
  const [format, setFormat] = useState<string>("what-if");
  const [category, setCategory] = useState<string>("Storytelling");
  const [mine, setMine] = useState<CustomFormat[]>([]);
  const [makingTemplate, setMakingTemplate] = useState<"new" | string | null>(null);
  const templates = useMemo(() => createTemplateStore(defaultKv()), []);
  const refreshTemplates = useCallback(() => void templates.list().then(setMine).catch(() => undefined), [templates]);
  useEffect(() => { refreshTemplates(); }, [refreshTemplates]);
  const ownFormat = format.startsWith(MY_FORMAT) ? (mine.find((t) => `${MY_FORMAT}${t.id}` === format) ?? null) : null;
  const formatLabel = ownFormat?.label ?? FORMATS.find((f) => f.id === format)?.label ?? "Series";
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
  // The latest of each, readable inside a long run where state would still be last render's.
  const pics = useRef<Record<string, string>>({});
  const clipsRef = useRef<Record<string, string>>({});
  const spokenRef = useRef<Record<string, string>>({});
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  useEffect(() => {
    void characters.list().then((all) => { setCast(all); const pick = readPick(window.location.search); if (pick?.kind === "character" && all.some((c) => c.id === pick.id)) setWho(pick.id); });
  }, [characters]);

  // What Claude has sent over MCP, waiting to be applied. The bridge only exists on your own computer.
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    let live = true;
    const look = () => fetch("/api/bridge/inbox?project=series").then((r) => (r.ok ? r.json() : null)).then((b: { items?: (Sent & { kind: string })[] } | null) => live && b?.items && setSent(b.items.filter((i) => i.kind === "series"))).catch(() => undefined);
    void look();
    const t = setInterval(look, 4000);
    return () => { live = false; clearInterval(t); };
  }, []);

  const person = cast.find((c) => c.id === who) ?? null;
  const looks = useStyles();
  const [makingLook, setMakingLook] = useState<"new" | string | null>(null);
  const style = looks.byId(lookId);
  const [extras, setExtras] = useState<BankItem[]>([]);
  const lock = [person ? identityLock(person.traits) : "", wordsOf(extras)].filter(Boolean).join(" ");
  const words = { ...(style ? { look: style.words } : {}), ...(lock ? { lock } : {}) };
  /** Pictures sent with every shot: who, then where, then what they wear, as many as the model takes. */
  const seriesRefs = () => allocateRefs({ characters: person?.sheet ? [person.sheet] : [], style: style?.sheet ? [style.sheet] : [], place: extras.filter((i) => i.kind === "place" && i.image).map((i) => i.image!), accessories: extras.filter((i) => i.kind === "accessory" && i.image).map((i) => i.image!) }, 4);

  /** Choosing a format loads its example into the form, unless you've already written your own idea. */
  function pickFormat(id: string) {
    setFormat(id);
    const own = id.startsWith(MY_FORMAT) ? mine.find((t) => `${MY_FORMAT}${t.id}` === id) : undefined;
    const sample = own ? { topic: own.topic, count: own.count } : FORMAT_SAMPLES[id as FormatId];
    const typed = topic.trim() && !Object.values(FORMAT_SAMPLES).some((x) => x.topic === topic.trim()) && !mine.some((t) => t.topic === topic.trim());
    if (typed || !sample.topic) return setNote(null);
    setTopic(sample.topic);
    setCount(sample.count);
    setNote(`Loaded an example for ${own?.label ?? FORMATS.find((f) => f.id === id)!.label}. Change the idea to your own whenever you like.`);
  }

  /** A ready idea: sets the format, the topic, the length, the look and the narrator in one click. */
  function usePreset(id: string) {
    const p = PRESETS.find((x) => x.id === id);
    if (!p) return;
    setFormat(p.format);
    setTopic(p.topic);
    setCount(p.count);
    setLookId(p.look ?? null);
    if (p.voice) setVoice(p.voice);
    setNote(`Loaded "${p.name}". Change anything, then write it.`);
  }

  async function write() {
    setBusy(true);
    setError(null);
    setNote(null);
    const r = await draftSeries(ownFormat ? { label: ownFormat.label, rules: templateRules(ownFormat.how) } : (format as FormatId), topic, count);
    setBusy(false);
    if (!r.ok) {
      if (r.needsKey) {
        // No Claude key needed: the connected Claude writes it over MCP and sends it here.
        const ask = `Use haggs_propose_series to write a ${formatLabel} series of ${count} short vertical video${count === 1 ? "" : "s"} for haggs about: ${topic.trim()}`;
        await navigator.clipboard?.writeText(ask).catch(() => undefined);
        return setNote("Copied a request. Paste it to Claude (the haggs MCP is connected) and the series lands here for you to apply.");
      }
      return setError(r.reason);
    }
    setSeries(r.series);
    setPictures({}); pics.current = {}; clipsRef.current = {}; spokenRef.current = {};
    setClips({});
    setSpoken({});
  }

  function applySent(i: Sent) {
    void fetch(`/api/bridge/inbox?project=series&id=${encodeURIComponent(i.id)}`, { method: "DELETE" }).catch(() => undefined);
    setSent((all) => all.filter((x) => x.id !== i.id));
    setFormat(i.payload.format);
    setSeries(i.payload.series);
    setPictures({}); pics.current = {}; clipsRef.current = {}; spokenRef.current = {};
  }

  async function picture(e: number, s: number): Promise<boolean> {
    const sh = series!.episodes[e]!.shots[s]!;
    const key = `${e}.${s}`;
    setMaking(key);
    const r = await makeStill(pictureWords(sh.picture, words), "9:16", await shrinkAll(seriesRefs())).catch((e: unknown) => ({ ok: false as const, reason: looksTooBig(e) ? "Those reference pictures were too big to send together. Try fewer of them." : e instanceof Error ? e.message : "The picture didn't finish.", needsKey: false }));
    galleryStill(sh.picture, "Series picture")(r);
    setMaking(null);
    if (!r.ok) {
      if (r.needsKey) openKeys();
      setError(r.reason);
      return false;
    }
    pics.current[key] = r.url;
    setPictures((p) => ({ ...p, [key]: r.url }));
    return true;
  }

  /** One picture becomes its clip, started from the picture itself. */
  async function animate(e: number, s: number): Promise<boolean> {
    const sh = series!.episodes[e]!.shots[s]!;
    const key = `${e}.${s}`;
    const still = pics.current[key];
    if (!still) return false;
    setMaking(`clip:${key}`);
    const r = await runModel("minimax/minimax-h3", `${sh.picture}. Gentle camera move, natural motion, the moment plays out.`, { resolution: "768P", ratio: "9:16", duration: Math.max(4, Math.round(sh.seconds)) }, [still], true);
    galleryRun(sh.picture, "minimax/minimax-h3", "Series clip")(r);
    setMaking(null);
    const first = r.ok ? r.shots[0] : undefined;
    if (!r.ok || !first) {
      if (!r.ok && r.needsKey) openKeys();
      setError(r.ok ? "The clip didn't come back." : r.reason);
      return false;
    }
    clipsRef.current[key] = first.url;
    setClips((c) => ({ ...c, [key]: first.url }));
    return true;
  }

  async function animateAll() {
    if (!series) return;
    stop.current = false;
    setError(null);
    for (const [e, ep] of series.episodes.entries()) {
      for (let s = 0; s < ep.shots.length; s++) {
        if (!pics.current[`${e}.${s}`] || clipsRef.current[`${e}.${s}`]) continue;
        if (stop.current || !(await animate(e, s))) return;
      }
    }
  }

  /** Everything, in order, stopping at the first problem: pictures, narration, clips, then the editor. */
  async function makeWholeVideo() {
    if (!series) return;
    stop.current = false;
    setError(null);
    for (const [e, ep] of series.episodes.entries()) for (let k = 0; k < ep.shots.length; k++) if (!pics.current[`${e}.${k}`]) { if (stop.current || !(await picture(e, k))) return; }
    if (hasNarration) await narrate();
    for (const [e, ep] of series.episodes.entries()) for (let k = 0; k < ep.shots.length; k++) if (!clipsRef.current[`${e}.${k}`]) { if (stop.current || !(await animate(e, k))) return; }
    setNote("All made. Opening it in the editor…");
    await sleep(600);
    await open();
  }

  async function all() {
    if (!series) return;
    stop.current = false;
    setError(null);
    for (const [e, ep] of series.episodes.entries()) {
      for (let s = 0; s < ep.shots.length; s++) {
        if (pics.current[`${e}.${s}`]) continue;
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
        if (!sh.narration.trim() || spokenRef.current[key]) continue;
        setMaking(`say:${key}`);
        const r = await speakLine(sh.narration, voice);
        setMaking(null);
        if (!r.ok) { if (r.needsKey) openKeys(); return setError(r.reason); }
        galleryAudio(r.url, sh.narration, "Narration", r.usd);
        spokenRef.current[key] = r.url;
        setSpoken((all) => ({ ...all, [key]: r.url }));
      }
    }
  }

  async function open() {
    if (!series) return;
    const project = buildSeries(series, format, { ...words, ...(seriesRefs().length ? { refs: seriesRefs() } : {}), pictures: pics.current, clips: clipsRef.current, voice, narrationUrls: spokenRef.current });
    await store.save(project);
    router.push(`/board/${project.id}/cut?b=${encodeURIComponent(project.boards![0]!.id)}`);
  }

  const change = (e: number, s: number, patch: Partial<Series["episodes"][number]["shots"][number]>) =>
    setSeries((cur) => cur && { ...cur, episodes: cur.episodes.map((ep, i) => (i === e ? { ...ep, shots: ep.shots.map((sh, k) => (k === s ? { ...sh, ...patch } : sh)) } : ep)) });
  const total = series?.episodes.reduce((n, e) => n + e.shots.length, 0) ?? 0;
  const done = Object.keys(pictures).length;
  const left = total - done;
  const unspoken = series?.episodes.flatMap((ep, e) => ep.shots.flatMap((sh, k) => (sh.narration.trim() && !spoken[`${e}.${k}`] ? [sh.narration] : []))) ?? [];
  const everything = left * PRICE + editEstimate({ tool: "speech", seconds: 0, characters: unspoken.reduce((n, l) => n + l.length, 0) }) + (series?.episodes.flatMap((ep, e) => ep.shots.map((sh, k) => (clips[`${e}.${k}`] ? 0 : Math.max(4, Math.round(sh.seconds)) * CLIP_RATE))).reduce((n, v) => n + v, 0) ?? 0);
  const secondsOf = (k: string) => { const [e, sIdx] = k.split(".").map(Number); return Math.max(4, Math.round(series?.episodes[e!]?.shots[sIdx!]?.seconds ?? 4)); };
  const toAnimate = Object.keys(pictures).filter((k) => !clips[k]);
  const animatePrice = toAnimate.reduce((n, k) => n + secondsOf(k) * CLIP_RATE, 0);
  const lines = series?.episodes.flatMap((ep, e) => ep.shots.flatMap((sh, k) => (sh.narration.trim() && !spoken[`${e}.${k}`] ? [sh.narration] : []))) ?? [];
  const hasNarration = (series?.episodes.some((ep) => ep.shots.some((sh) => sh.narration.trim())) ?? false);
  const sayPrice = editEstimate({ tool: "speech", seconds: 0, characters: lines.reduce((n, l) => n + l.length, 0) });

  return (
    <div className="app">
      <Nav current="Video" />
      {makingTemplate && <TemplateMaker {...(makingTemplate !== "new" && mine.find((t) => t.id === makingTemplate) ? { start: mine.find((t) => t.id === makingTemplate)! } : {})} onClose={() => setMakingTemplate(null)} onSaved={(t) => { setMakingTemplate(null); refreshTemplates(); setTopic(t.topic); setCount(t.count); setFormat(`${MY_FORMAT}${t.id}`); }} />}
      {makingLook && <StyleMaker {...(makingLook !== "new" && looks.custom.find((c) => c.id === makingLook) ? { start: looks.custom.find((c) => c.id === makingLook)! } : {})} onClose={() => setMakingLook(null)} onSaved={(c) => { setMakingLook(null); looks.refresh(); setLookId(`my-${c.id}`); }} />}
      <div className="canvas">
        <div className="swap">
          <ModeTabs group="Video" current="/series" />

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
              <div className="series-presets" aria-label="Start from a preset">
                <div className="quick-tabs" role="tablist">
                  {[...new Set(PRESETS.map((p) => p.category))].map((c) => (
                    <button key={c} role="tab" aria-selected={category === c} className={category === c ? "on" : ""} onClick={() => setCategory(c)}>{c}</button>
                  ))}
                </div>
                <div className="quick-row">
                  {PRESETS.filter((p) => p.category === category).map((p) => (
                    <button key={p.id} className="quick-card pic" onClick={() => usePreset(p.id)} title={p.topic}>
                      <span className="qc-pic" style={{ backgroundImage: `url(/formats/${p.format}-${1 + (PRESETS.indexOf(p) % 3)}.jpg)` }} role="img" aria-label={`A sample frame for ${p.name}`} />
                      <b>{p.name}</b>
                      <small>{p.count} {p.count === 1 ? "video" : "videos"}</small>
                    </button>
                  ))}
                </div>
              </div>
              <div className="series-formats" role="radiogroup" aria-label="Format">
                {FORMATS.map((f) => (
                  <button key={f.id} role="radio" aria-checked={format === f.id} className={format === f.id ? "on" : ""} onClick={() => pickFormat(f.id)}>
                    <span className="sf-strip" aria-label={`A sample ${f.label} series`}>
                      {[1, 2, 3].map((n) => (
                        <span key={n} className="sf-frame" style={{ backgroundImage: `url(/formats/${f.id}-${n}.jpg)` }}>
                          {n === 1 && <i>{FORMAT_SAMPLES[f.id].hook}</i>}
                        </span>
                      ))}
                    </span>
                    <b>{f.label}</b>
                    <span>{f.blurb}</span>
                  </button>
                ))}
                {mine.map((t) => (
                  <span key={t.id} className={`sf-own${format === `${MY_FORMAT}${t.id}` ? " on" : ""}`}>
                    <button role="radio" aria-checked={format === `${MY_FORMAT}${t.id}`} className={format === `${MY_FORMAT}${t.id}` ? "on" : ""} onClick={() => pickFormat(`${MY_FORMAT}${t.id}`)}>
                      <span className="sf-cover" aria-hidden="true"><i>{t.label}</i></span>
                      <b>{t.label}</b>
                      <span>{t.how.length > 90 ? `${t.how.slice(0, 88)}…` : t.how}</span>
                    </button>
                    <span className="sf-own-tools">
                      <button aria-label={`Edit ${t.label}`} title="Edit" onClick={() => setMakingTemplate(t.id)}>✎</button>
                      <button aria-label={`Delete ${t.label}`} title="Delete" onClick={async () => { await templates.remove(t.id); if (format === `${MY_FORMAT}${t.id}`) setFormat("what-if"); refreshTemplates(); }}>×</button>
                    </span>
                  </span>
                ))}
                <button className="sf-add" onClick={() => setMakingTemplate("new")}>
                  <span className="sf-plus" aria-hidden="true">+</span>
                  <b>Make your own template</b>
                  <span>Top ten, my favorite cars, a day in the life: describe the shape once and use it again.</span>
                </button>
              </div>

              <div className="series-pick">
                <b>Who is in it</b>
                <div className="series-chips">
                  <button className={!who ? "on" : ""} onClick={() => setWho(null)}>Nobody in particular</button>
                  {cast.map((c) => (
                    <button key={c.id} className={who === c.id ? "on" : ""} onClick={() => setWho(c.id)} title={c.traits.name}><img src={c.sheet} alt="" />{c.traits.name}</button>
                  ))}
                  <BuildLink href="/characters" className="plain" label="your series">+ Build a character</BuildLink>
                </div>
              </div>
              <div className="series-pick"><ExtrasRow items={extras} onChange={setExtras} label="your series" title="Where it happens and what they wear" /></div>
              <div className="series-pick">
                <b>How it looks</b>
                <div className="series-chips">
                  <button className={!lookId ? "on" : ""} onClick={() => setLookId(null)}>Natural</button>
                  {looks.all.map((st) => (
                    <span key={st.id} className={`look-chip${st.id.startsWith("my-") ? " mine" : ""}`}>
                      <button className={lookId === st.id ? "on" : ""} onClick={() => setLookId(st.id)} title={st.says}>{st.sheet && <img src={st.sheet} alt="" />}{st.name}</button>
                      {st.id.startsWith("my-") && <>
                        <button className="look-edit" aria-label={`Edit ${st.name}`} title="Edit" onClick={() => setMakingLook(st.id.slice(3))}>✎</button>
                        <button className="look-edit" aria-label={`Delete ${st.name}`} title="Delete" onClick={async () => { await looks.store.remove(st.id.slice(3)); if (lookId === st.id) setLookId(null); looks.refresh(); }}>×</button>
                      </>}
                    </span>
                  ))}
                  <button className="look-add" onClick={() => setMakingLook("new")}>+ Your own style</button>
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
                {!making && everything > 0.001 && <button className="fire" onClick={() => void makeWholeVideo()} title="Pictures, narration and clips in order, then the editor. Stops at the first problem.">Make the whole video · {money(everything)}</button>}
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
        <SiteFooter />
      </div>
    </div>
  );
}
