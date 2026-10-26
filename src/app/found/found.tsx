"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { appendFound, foundBoard, searchWords, type Found as Scene, type Pick } from "../../found/found";
import type { Project } from "../../story/model";
import { defaultKv } from "../../story/kv";
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
  useEffect(() => { void store.list().then(async (list) => {
    const projects = await Promise.all(list.map((p) => store.load(p.id)));
    setDestinations(projects.flatMap((p) => p ? (p.boards ?? []).map((b) => ({id:p.id, board:b.id, label:`${p.name} / ${b.name}`})) : []));
  }).catch(() => setProblem("Could not load edit destinations. Reload before importing.")); }, [store]);

  async function search() {
    pending.current = null;
    setBusy("Searching the archive…");
    setProblem(null);
    const r = await findFootage(words.split(/[\s,]+/).filter(Boolean));
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
          <header className="swap-head">
            <h1>Found footage</h1>
            <p>Describe the film. haggs searches the Prelinger Archives, thousands of public-domain films from the Internet Archive, for scenes that fit. Select scenes, choose an edit, then import them for trimming, titles, voice and music. Searching is free; importing does not run AI generation.</p>
          </header>
          <div className="cm-row" aria-label="Samples">
            <span className="muted">Try a sample:</span>
            {FOUND_SAMPLES.map((s) => <button key={s.label} className="pill" onClick={() => { setBrief(s.brief); setWords(searchWords(s.brief).join(" ")); setFound(null); setProblem(null); }}>{s.label}</button>)}
          </div>

          <label className="wf-field"><span>What is the film?</span>
            <textarea rows={2} value={brief} maxLength={300} placeholder="A lonely night shift in a city that is closing down" onChange={(e) => { setBrief(e.target.value); setWords(searchWords(e.target.value).join(" ")); }} />
          </label>
          <label className="wf-field"><span>Search words (change them if the results are off)</span>
            <input value={words} onChange={(e) => setWords(e.target.value)} placeholder="city night diner" aria-label="Search words" />
          </label>
          <p><button className="fire" disabled={busy !== null || words.trim().length < 3} onClick={() => void search()}>{busy ?? "Find footage"} <span className="cost">free</span></button></p>
          {problem && <p className="library-error" role="alert">{problem}</p>}

          {found && found.length > 0 && (
            <>
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
                        <span className="found-tick">{on ? "✓ Selected" : "Select scene"}</span>
                      </button>
                      <a href={f.page} target="_blank" rel="noreferrer">on archive.org</a>
                    </li>
                  );
                })}
              </ul>
              <div className="found-bar">
                <label>Destination edit <select aria-label="Destination edit" value={destination} disabled={busy !== null} onChange={(e) => { setDestination(e.target.value); pending.current = null; }}><option value="">Choose where to add footage</option><option value="new">Create a new edit</option>{destinations.map((d) => <option key={`${d.id}:${d.board}`} value={`${d.id}:${d.board}`}>{d.label}</option>)}</select></label>
                <button className="fire" disabled={!picked.length || !destination || busy !== null} onClick={() => void make()}>{busy ?? `Add ${picked.length || "selected"} scene${picked.length === 1 ? "" : "s"} to edit`}</button>
                <small>Select only marks a scene. Add to edit downloads usable footage, saves it to the destination above and opens that video editor. It does not reskin or generate anything. For a new visual style, use the editor’s existing Restyle tool after importing; review its price before running it. Source attribution stays with each shot. Check each film’s licence on archive.org before publishing.</small>
              </div>
            </>
          )}
        </div>
        <SiteFooter />
      </div>
    </div>
  );
}
