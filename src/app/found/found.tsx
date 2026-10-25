"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { foundBoard, searchWords, type Found as Scene, type Pick } from "../../found/found";
import { defaultKv } from "../../story/kv";
import { createProjectStore } from "../../story/store";
import { findFootage, keepFootage } from "../found-actions";
import { Nav } from "../nav";
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

  async function search() {
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
    const chosen = (found ?? []).filter((f) => picked.includes(f.id));
    const kept: Pick[] = [];
    for (const [i, f] of chosen.entries()) {
      setBusy(`Keeping scene ${i + 1} of ${chosen.length}…`);
      const r = await keepFootage(f.id);
      if (!r.ok) { setBusy(null); return setProblem(`${f.title}: ${r.reason}`); }
      kept.push({ found: f, localUrl: r.url, seconds: r.seconds });
    }
    const project = foundBoard(brief.trim().slice(0, 50) || "Found footage", brief, kept);
    await store.save(project);
    setBusy(null);
    router.push(`/board/${project.id}/cut?b=${encodeURIComponent(project.boards![0]!.id)}`);
  }

  return (
    <div className="app">
      <Nav current="Video" />
      <div className="canvas">
        <div className="swap">
          <ModeTabs group="Video" current="/found" />
          <header className="swap-head">
            <h1>Found footage</h1>
            <p>Describe the film. haggs searches the Prelinger Archives, thousands of public-domain films from the Internet Archive, for scenes that fit. Keep the ones you like, then restyle them into your own look and cut them together. Searching is free.</p>
          </header>

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
                      <button onClick={() => setPicked((p) => (on ? p.filter((x) => x !== f.id) : [...p, f.id]))} aria-pressed={on}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={f.thumb} alt="" loading="lazy" />
                        <b>{f.title}</b>
                        <small>{f.year || "undated"}{f.about ? ` · ${f.about}` : ""}</small>
                        <span className="found-tick">{on ? "✓ In" : "Add"}</span>
                      </button>
                      <a href={f.page} target="_blank" rel="noreferrer">on archive.org</a>
                    </li>
                  );
                })}
              </ul>
              <div className="found-bar">
                <button className="fire" disabled={!picked.length || busy !== null} onClick={() => void make()}>{busy ?? `Make a board from ${picked.length || "your"} scene${picked.length === 1 ? "" : "s"}`}</button>
                <small>Scenes are saved to your media folder. Next: Restyle them in the editor, add a voice and music, render. Check each film’s licence on archive.org before you publish.</small>
              </div>
            </>
          )}
        </div>
        <SiteFooter />
      </div>
    </div>
  );
}
