"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { createCharacterStore, identityLock, type Character } from "../../characters/character";
import { LAYOUTS, LOOKS, MAX_STYLE_REFS, STARTERS, comicProject, emptyStyle, imageRatio, newPanel, panelPrompt, styleSheetPrompt, type LayoutId, type LookId, type Panel, type Shape, type StyleSheet } from "../../comic/comic";
import { readPick } from "../../story/handoff";
import { defaultKv } from "../../story/kv";
import { createProjectStore } from "../../story/store";
import { Nav, openKeys } from "../nav";
import { BuildLink } from "../return-bar";
import { makeStill } from "../series-actions";
import { drawComic } from "./draw";

const PRICE = 0.07;
const COMIC_FINISH = "Illustrated comic art, no text, no letters, no watermark.";

/**
 * Comic strip: write the panels, choose who is in them, pick a look, draw
 * every panel, and get a finished page with captions and speech bubbles.
 * Send the panels to a project to animate them into a motion comic.
 */
export function Comic() {
  const router = useRouter();
  const [panels, setPanels] = useState<Panel[]>(() => STARTERS[0]!.panels.map((p) => newPanel({ action: p.action, caption: p.caption ?? "", lines: p.lines ?? [], shape: p.shape ?? "wide" })));
  const [cast, setCast] = useState<Character[]>([]);
  const [inIt, setInIt] = useState<string[]>([]);
  const [look, setLook] = useState<LookId>("ink");
  const [layout, setLayout] = useState<LayoutId>("page");
  const [style, setStyle] = useState<StyleSheet>(emptyStyle);
  const [swatch, setSwatch] = useState("");
  const sheetFile = useRef<HTMLInputElement>(null);
  const [pictures, setPictures] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const stop = useRef(false);

  useEffect(() => {
    void createCharacterStore(defaultKv()).list().then((all) => {
      setCast(all);
      const pick = readPick(window.location.search);
      if (pick?.kind === "character" && all.some((c) => c.id === pick.id)) setInIt((cur) => (cur.includes(pick.id) ? cur : [...cur, pick.id]));
    }).catch(() => undefined);
  }, []);

  const locks = useMemo(() => cast.filter((c) => inIt.includes(c.id)).map((c) => identityLock(c.traits)), [cast, inIt]);
  const refs = useMemo(() => cast.filter((c) => inIt.includes(c.id)).map((c) => c.sheet).slice(0, 2), [cast, inIt]);
  const todo = panels.filter((p) => p.action.trim().length >= 6 && !pictures[p.id]);

  useEffect(() => {
    const c = canvas.current;
    if (c) void drawComic(c, panels, pictures, layout, 1).catch(() => undefined);
  }, [panels, pictures, layout]);

  const change = (id: string, patch: Partial<Panel>) => setPanels((all) => all.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  const move = (i: number, d: number) => setPanels((all) => { const n = [...all]; const j = i + d; if (j < 0 || j >= n.length) return all; [n[i], n[j]] = [n[j]!, n[i]!]; return n; });

  async function make(list: Panel[]) {
    stop.current = false;
    setProblem(null);
    for (const [i, p] of list.entries()) {
      if (stop.current) break;
      setBusy(`Drawing ${p.id === list[0]!.id && list.length === 1 ? "panel" : `panel ${i + 1} of ${list.length}`}…`);
      const names = p.who.length ? cast.filter((c) => p.who.includes(c.id)) : cast.filter((c) => inIt.includes(c.id));
      const r = await makeStill(panelPrompt(p, look, names.map((c) => identityLock(c.traits)), undefined, style), imageRatio(p.shape), [...names.map((c) => c.sheet).slice(0, 2), ...style.refs.slice(0, MAX_STYLE_REFS)], `${COMIC_FINISH}`);
      if (!r.ok) { if (r.needsKey) openKeys(); setProblem(r.reason); break; }
      setPictures((all) => ({ ...all, [p.id]: r.url }));
    }
    setBusy(null);
  }

  /** A picture you bring as the look to match, shrunk so it travels well. */
  async function addRef(file: File) {
    const bitmap = await createImageBitmap(file).catch(() => null);
    if (!bitmap) return setProblem("That picture couldn't be read.");
    const k = Math.min(1, 1024 / Math.max(bitmap.width, bitmap.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bitmap.width * k);
    c.height = Math.round(bitmap.height * k);
    c.getContext("2d")!.drawImage(bitmap, 0, 0, c.width, c.height);
    setStyle((st) => ({ ...st, refs: [...st.refs, c.toDataURL("image/jpeg", 0.9)].slice(-MAX_STYLE_REFS) }));
  }

  /** The look drawn once as a page: poses, swatches, line samples. Every panel after it is sent that page to match. */
  async function drawStyleSheet() {
    setProblem(null);
    setBusy("Drawing the style sheet…");
    const r = await makeStill(styleSheetPrompt(look, style, locks), "16:9", refs.slice(0, 2), COMIC_FINISH);
    setBusy(null);
    if (!r.ok) { if (r.needsKey) openKeys(); return setProblem(r.reason); }
    setStyle((st) => ({ ...st, refs: [...st.refs, r.url].slice(-MAX_STYLE_REFS) }));
  }

  async function download() {
    const c = document.createElement("canvas");
    await drawComic(c, panels, pictures, layout, 2);
    c.toBlob((b) => { if (!b) return; const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = "comic.png"; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); });
  }

  async function toProject() {
    try {
      const project = comicProject("Comic", panels, pictures);
      await createProjectStore(defaultKv()).save(project);
      router.push(`/board/${project.id}?b=${encodeURIComponent(project.boards![0]!.id)}`);
    } catch (e) { setProblem(e instanceof Error ? e.message : "That didn't work."); }
  }

  return (
    <div className="app">
      <Nav current="Photos" />
      <div className="canvas">
        <div className="swap comic">
          <nav className="modes" aria-label="Photos">
            <Link href="/photos">Make</Link>
            <Link href="/characters">Characters</Link>
            <Link href="/locations">Locations</Link>
            <Link href="/comic" aria-current="page">Comic strip</Link>
          </nav>
          <header className="swap-head">
            <h1>Comic strip</h1>
            <p>Write the panels, pick who is in them and a look, and haggs draws every panel with captions and speech bubbles. The same characters in every panel. Then send it to a project to bring it to life.</p>
          </header>

          <section className="cm-block" aria-label="Start from a story">
            <div className="cm-chips">
              <b>Start from</b>
              {STARTERS.map((s) => <button key={s.id} className="plain" title={s.says} onClick={() => { setPanels(s.panels.map((p) => newPanel({ action: p.action, caption: p.caption ?? "", lines: p.lines ?? [], shape: p.shape ?? "wide" }))); setPictures({}); }}>{s.name}</button>)}
              <button className="plain" onClick={() => { setPanels([newPanel()]); setPictures({}); }}>A blank page</button>
            </div>
          </section>

          <section className="cm-block" aria-label="Who is in it">
            <h2>Who is in it</h2>
            <div className="cm-cast">
              {cast.map((c) => (
                <button key={c.id} className={inIt.includes(c.id) ? "on" : ""} aria-pressed={inIt.includes(c.id)} onClick={() => setInIt((all) => (all.includes(c.id) ? all.filter((x) => x !== c.id) : [...all, c.id]))}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={c.sheet} alt="" /><span>{c.traits.name}</span>
                </button>
              ))}
              <BuildLink href="/characters" label="your comic" className="cm-add">+ Make a character</BuildLink>
            </div>
            {cast.length === 0 && <p className="wf-small">No characters yet. Make one and you come straight back here with them chosen. Without one, every panel invents its own faces.</p>}
          </section>

          <section className="cm-block" aria-label="Look and layout">
            <h2>The look</h2>
            <div className="cm-looks">{LOOKS.map((l) => <button key={l.id} className={look === l.id ? "on" : ""} onClick={() => { setLook(l.id); setPictures({}); }}><b>{l.name}</b><small>{l.says}</small></button>)}</div>
            <h2>The page</h2>
            <div className="lab-chips">{LAYOUTS.map((l) => <button key={l.id} className={layout === l.id ? "on" : ""} onClick={() => setLayout(l.id)} title={l.says}>{l.name}</button>)}</div>
          </section>

          <section className="cm-block" aria-label="Style sheet">
            <h2>Style sheet <small>how the art should look</small></h2>
            <textarea className="cm-notes" rows={2} value={style.notes} onChange={(e) => setStyle({ ...style, notes: e.target.value })} placeholder="In your words: heavy shadows, a rain-soaked city at night, big expressive eyes, lettering like old pulp comics…" aria-label="Art notes" maxLength={400} />
            <div className="cm-row">
              <span className="cm-lbl">Line</span>
              <div className="lab-chips small">{(["fine", "medium", "bold"] as const).map((l) => <button key={l} className={style.line === l ? "on" : ""} onClick={() => setStyle({ ...style, line: style.line === l ? "" : l })}>{l[0]!.toUpperCase() + l.slice(1)}</button>)}</div>
            </div>
            <div className="cm-row">
              <span className="cm-lbl">Palette</span>
              <div className="lab-chips small">
                {[["Electric storm", ["electric blue", "deep violet", "white", "black"]], ["Warm retro", ["mustard", "brick red", "cream", "teal"]], ["Noir", ["black", "white", "one red accent"]], ["Pastel", ["peach", "mint", "lavender", "sky blue"]]].map(([name, colours]) => (
                  <button key={name as string} className={style.palette.join() === (colours as string[]).join() ? "on" : ""} onClick={() => setStyle({ ...style, palette: style.palette.join() === (colours as string[]).join() ? [] : (colours as string[]) })}>{name as string}</button>
                ))}
              </div>
              <form className="cm-swatch" onSubmit={(e) => { e.preventDefault(); const v = swatch.trim(); if (v && style.palette.length < 8) setStyle({ ...style, palette: [...style.palette, v.slice(0, 24)] }); setSwatch(""); }}>
                <input value={swatch} onChange={(e) => setSwatch(e.target.value)} placeholder="Add a colour: teal, #ff3366" aria-label="Add a colour" maxLength={24} />
              </form>
            </div>
            {style.palette.length > 0 && <div className="lab-chips small">{style.palette.map((c) => <button key={c} onClick={() => setStyle({ ...style, palette: style.palette.filter((x) => x !== c) })} title="Remove">{c} ×</button>)}</div>}
            <div className="cm-refs">
              {style.refs.map((r, i) => (
                <figure key={i}>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={r} alt={`Style reference ${i + 1}`} /><button className="plain" onClick={() => setStyle({ ...style, refs: style.refs.filter((_, k) => k !== i) })}>Remove</button></figure>
              ))}
              {style.refs.length < MAX_STYLE_REFS && (
                <div className="cm-refadd">
                  <button className="pill" onClick={() => sheetFile.current?.click()}>Add a picture to match</button>
                  <button className="pill" disabled={busy !== null} onClick={() => void drawStyleSheet()}>Draw a style sheet from this look <span className="cost">about ${PRICE.toFixed(2)}</span></button>
                  <input ref={sheetFile} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void addRef(f); }} />
                </div>
              )}
            </div>
            <small className="wf-small">The notes, palette and line go into every panel. Pictures here are sent with every panel too, so the whole comic is drawn in one hand.</small>
          </section>

          <section className="cm-block" aria-label="Panels">
            <h2>The panels</h2>
            <ol className="cm-panels">
              {panels.map((p, i) => (
                <li key={p.id}>
                  <div className="cm-pic">
                    {pictures[p.id] ? <img src={pictures[p.id]} alt={`Panel ${i + 1}`} /> : <span>{i + 1}</span>}
                  </div>
                  <div className="cm-fields">
                    <textarea rows={2} value={p.action} onChange={(e) => change(p.id, { action: e.target.value })} placeholder="What the panel shows: who, where, what is happening, the angle." aria-label={`Panel ${i + 1}: what it shows`} />
                    <div className="cm-row">
                      <input value={p.caption} onChange={(e) => change(p.id, { caption: e.target.value })} placeholder="Caption (optional): KANSAS. 6:42 PM." aria-label={`Panel ${i + 1}: caption`} maxLength={80} />
                      <select value={p.shape} onChange={(e) => change(p.id, { shape: e.target.value as Shape })} aria-label={`Panel ${i + 1}: shape`}><option value="wide">Wide</option><option value="square">Square</option><option value="tall">Tall</option></select>
                    </div>
                    {[0, 1].map((k) => (
                      <input key={k} value={p.lines[k]?.text ?? ""} onChange={(e) => change(p.id, { lines: [0, 1].map((j) => (j === k ? { who: p.lines[j]?.who ?? "", text: e.target.value } : (p.lines[j] ?? { who: "", text: "" }))).filter((l, j, a) => l.text || a.slice(j + 1).some((x) => x.text)) })} placeholder={k === 0 ? "Speech bubble" : "A second bubble (optional)"} aria-label={`Panel ${i + 1}: speech ${k + 1}`} maxLength={90} />
                    ))}
                    <div className="cm-row">
                      <button className="pill" disabled={busy !== null || p.action.trim().length < 6} onClick={() => void make([p])}>{pictures[p.id] ? "Draw again" : "Draw this panel"} <span className="cost">about ${PRICE.toFixed(2)}</span></button>
                      <button className="plain" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">↑</button>
                      <button className="plain" onClick={() => move(i, 1)} disabled={i === panels.length - 1} aria-label="Move down">↓</button>
                      <button className="plain danger" onClick={() => setPanels((all) => (all.length > 1 ? all.filter((x) => x.id !== p.id) : all))} aria-label="Remove panel">Remove</button>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
            <button className="plain" onClick={() => setPanels((all) => [...all, newPanel()])} disabled={panels.length >= 12}>+ Add a panel</button>
          </section>

          <div className="cm-make">
            <button className="fire" disabled={busy !== null || todo.length === 0} onClick={() => void make(todo)}>{busy ?? `Draw ${todo.length} panel${todo.length === 1 ? "" : "s"}`} <span className="cost">about ${(todo.length * PRICE).toFixed(2)}</span></button>
            {busy && <button className="plain" onClick={() => { stop.current = true; }}>Stop after this one</button>}
            {refs.length > 0 && <small>{refs.length} character sheet{refs.length === 1 ? "" : "s"} sent with every panel, so they look the same.</small>}
          </div>
          {problem && <p className="library-error" role="alert">{problem}</p>}

          <section className="cm-block" aria-label="The page">
            <h2>Your page</h2>
            <canvas ref={canvas} className="cm-page" aria-label="The comic page so far" />
            <div className="cm-row">
              <button className="fire" onClick={() => void download()} disabled={Object.keys(pictures).length === 0}>Download the page</button>
              <button className="pill" onClick={() => void toProject()} disabled={Object.keys(pictures).length === 0}>Send to a project</button>
            </div>
            <small className="wf-small">In a project you can animate each panel, add voices and music, and cut it as a motion comic.</small>
          </section>
        </div>
      </div>
    </div>
  );
}
