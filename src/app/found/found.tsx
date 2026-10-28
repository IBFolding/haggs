"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { appendFound, foundBoard, searchWords, type Found as Scene, type Pick } from "../../found/found";
import type { Project } from "../../story/model";
import { defaultKv, idbKv } from "../../story/kv";
import { createProjectStore } from "../../story/store";
import { findFootage, keepFootage } from "../found-actions";
import { Nav } from "../nav";
import { FOUND_SAMPLES } from "../../samples/starters";
import { ModeTabs } from "../mode-tabs";
import { SiteFooter } from "../site-footer";

/**
 * Found footage: say what the film is, find archive scenes that fit, keep the
 * ones you like. They arrive on a board as ordinary shots, so Restyle can
 * redraw them into your look and the Cut can join them with voice and music.
 */
export function Found() {
  const router = useRouter();
  const store = useMemo(() => createProjectStore(defaultKv()), []);
  const [brief, setBrief] = useState("");
  const [words, setWords] = useState("");
  const [found, setFound] = useState<Scene[] | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const [destinations, setDestinations] = useState<{id:string; board:string; label:string}[]>([]);
  const [destination, setDestination] = useState("");
  const importing = useRef(false);
  const pending = useRef<Project | null>(null);
  const [ready,setReady]=useState(false);
  const writes=useRef(Promise.resolve());
  useEffect(()=>{void idbKv().get<{brief:string;words:string;found:Scene[]|null;picked:string[];destination:string}>("found:draft:v1").then(d=>{if(d){setBrief(d.brief);setWords(d.words);setFound(d.found);setPicked(d.picked);setDestination(d.destination);}setReady(true);}).catch(()=>{setReady(true);setProblem("Could not restore the search draft. Keep this page open while working.");});},[]);
  useEffect(()=>{if(!ready)return;writes.current=writes.current.catch(()=>{}).then(()=>idbKv().set("found:draft:v1",{brief,words,found,picked,destination}));void writes.current.catch(()=>setProblem("Search changes could not be saved. Keep this page open and retry."));},[ready,brief,words,found,picked,destination]);
  useEffect(() => { void store.list().then(async (list) => {
    const projects = await Promise.all(list.map((p) => store.load(p.id)));
    setDestinations(projects.flatMap((p) => p ? (p.boards ?? []).map((b) => ({id:p.id, board:b.id, label:`${p.name} / ${b.name}`})) : []));
  }).catch(() => setProblem("Could not load edit destinations. Reload before importing.")); }, [store]);

  async function search() {
    pending.current = null;
    setBusy("Searching the archive…");
    setProblem(null);
    const r = await findFootage(words.split(/[\s,]+/).filter(Boolean)).catch(()=>({ok:false as const,reason:"The archive could not be reached. Your search and selections are kept; try again."}));
    setBusy(null);
    if (!r.ok) return setProblem(r.reason);
    setFound(r.found);
    setPicked([]);
    if (!r.found.length) setProblem("Nothing matched. Try fewer, simpler words.");
  }

  async function make() {
    if (importing.current || !destination) return;
    importing.current = true;
    setProblem(null);
    try {
      const chosen = (found ?? []).filter((f) => picked.includes(f.id));
      if (!chosen.length) return;
      const target = destinations.find((d) => `${d.id}:${d.board}` === destination);
      let project = pending.current;
      let boardId: string;
      if (!project) {
        const existing = target ? await store.load(target.id) : undefined;
        if (destination !== "new" && (!existing || !target)) throw new Error("That edit is no longer available. Choose a destination again.");
        const kept: Pick[] = [];
        for (const [i, f] of chosen.entries()) {
          setBusy(`Importing scene ${i + 1} of ${chosen.length}…`);
          const r = await keepFootage(f.id);
          if (!r.ok) throw new Error(`${f.title}: ${r.reason} Nothing was added to the edit.`);
          kept.push({ found: f, localUrl: r.url, seconds: r.seconds });
        }
        const imported = foundBoard(brief.trim().slice(0, 50) || "Found footage", brief, kept);
        project = existing && target ? appendFound(existing, target.board, imported) : imported;
        pending.current = project;
      }
      boardId = target?.board ?? project.boards![0]!.id;
      setBusy("Saving edit…");
      await store.save(project);
      const saved = await store.load(project.id);
      if (!saved?.boards?.some((b) => b.id === boardId)) throw new Error("The edit could not be verified. Retry to save the same edit.");
      router.push(`/board/${project.id}/cut?b=${encodeURIComponent(boardId)}`);
    } catch(e) { setProblem(e instanceof Error ? e.message : "Import failed. Your edit was not replaced. Retry when ready."); }
    finally { setBusy(null); importing.current = false; }
  }

  return (
    <div className="app">
      <Nav current="Video" />
      <div className="canvas">
        <div className="swap">
          <ModeTabs group="Video" current="/found" />
          <div className="cx">
            <aside className="cx-builder" aria-label="Find footage">
              <div className="cx-scroll">
                <span className="eyebrow">Found footage</span>
                <h1 className="cx-title">Cut a film from the archive.</h1>
                <p className="cx-lede">haggs searches the Prelinger Archives, thousands of public-domain films on the Internet Archive, for scenes that fit. Searching and importing are free; nothing is generated.</p>

                <section className="rx-step">
                  <b><i>1</i> What is the film?</b>
                  <textarea className="dw-prompt" rows={3} value={brief} maxLength={300} placeholder="A lonely night shift in a city that is closing down" aria-label="What is the film?" onChange={(e) => { setBrief(e.target.value); setWords(searchWords(e.target.value).join(" ")); }} />
                  <label className="wf-field"><span>Search words (change them if the results are off)</span>
                    <input value={words} onChange={(e) => setWords(e.target.value)} placeholder="city night diner" aria-label="Search words" />
                  </label>
                  {found && <button className="pill" disabled={!ready || busy !== null || words.trim().length < 3} onClick={() => void search()}>Search again <span className="cost">free</span></button>}
                </section>

                <section className="rx-step">
                  <b><i>2</i> Pick the scenes</b>
                  <p className="dw-hint">{!found ? "Search, then pick scenes on the right." : picked.length ? `${picked.length} of ${found.length} picked.` : `${found.length} found. Pick the ones you want.`}</p>
                </section>

                <section className="rx-step">
                  <b><i>3</i> Where they go</b>
                  <select className="fd-dest" aria-label="Destination edit" value={destination} disabled={busy !== null} onChange={(e) => { setDestination(e.target.value); pending.current = null; }}><option value="">Choose where to add footage</option><option value="new">Create a new edit</option>{destinations.map((d) => <option key={`${d.id}:${d.board}`} value={`${d.id}:${d.board}`}>{d.label}</option>)}</select>
                  <small className="dw-hint">Scenes arrive in the video editor as ordinary shots, with their source kept. Restyle them there if you want a new look (it shows its price first). Check each film&rsquo;s licence on archive.org before you publish.</small>
                </section>
                {problem && <p className="library-error" role="alert">{problem}</p>}
              </div>
              <div className="cx-foot">
                {!found ? (
                  <button className="fire" disabled={!ready || busy !== null || words.trim().length < 3} onClick={() => void search()}>{busy ?? "Find footage"} <span className="cost">free</span></button>
                ) : (
                  <button className="fire" disabled={!picked.length || !destination || busy !== null} onClick={() => void make()}>{busy ?? (!picked.length ? "Pick scenes on the right" : !destination ? "Choose where they go" : `Add ${picked.length} scene${picked.length === 1 ? "" : "s"} to the edit`)} <span className="cost">free</span></button>
                )}
              </div>
            </aside>

            <div className="cx-main">
              {found && found.length > 0 ? (
                <ul className="found-grid">
                  {found.map((f) => {
                    const on = picked.includes(f.id);
                    return (
                      <li key={f.id} className={on ? "on" : ""}>
                        <button disabled={busy !== null} onClick={() => { pending.current = null; setPicked((p) => (on ? p.filter((x) => x !== f.id) : [...p, f.id])); }} aria-pressed={on}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={f.thumb} alt="" loading="lazy" />
                          <b>{f.title}</b>
                          <small>{f.year || "undated"}{f.about ? ` · ${f.about}` : ""}</small>
                          <span className="found-tick">{on ? "✓ Picked" : "Pick"}</span>
                        </button>
                        <a href={f.page} target="_blank" rel="noreferrer">on archive.org</a>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="chars-sheet" aria-live="polite"><div className="wf-result-wait">{busy ?? "Describe the film and press Find footage. Scenes from the archive appear here to pick from."}</div></div>
              )}
              <section className="cx-gallery" aria-label="Samples">
                <span className="eyebrow muted">Start from a sample</span>
                <div className="cx-cards">
                  {FOUND_SAMPLES.map((s) => (
                    <button key={s.label} className={`cx-card${brief === s.brief ? " on" : ""}`} onClick={() => { setBrief(s.brief); setWords(searchWords(s.brief).join(" ")); setFound(null); setPicked([]); setProblem(null); }}>
                      <span className="cx-mono" aria-hidden>{s.label.replace(/^(A|The) /, "").slice(0, 1)}</span>
                      <span><b>{s.label}</b><small>{searchWords(s.brief).join(" ")}</small></span>
                    </button>
                  ))}
                </div>
              </section>
            </div>
          </div>
        </div>
        <SiteFooter />
      </div>
    </div>
  );
}
