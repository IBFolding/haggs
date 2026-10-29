"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { importSheets, type Sheets } from "../../sheets/sheets";
import { shelf } from "../../sheets/shelf";
import { defaultKv } from "../../story/kv";
import type { Project } from "../../story/model";
import { createProjectStore } from "../../story/store";

const clock = (s: number) => (s < 120 ? `${Math.round(s)}s` : `${Math.round(s / 60)} min`);
const when = (at: number) => new Date(at).toLocaleDateString(undefined, { month: "short", day: "numeric" });

/** Every script on this device, one card a project: open it on its sheets, or go to its board. */
export function ScriptShelf({ query }: { query: string }) {
  const [entries, setEntries] = useState<{ project: Project; sheets: Sheets | null }[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  useEffect(() => {
    const kv = defaultKv();
    const store = createProjectStore(kv);
    void (async () => {
      const projects = (await Promise.all((await store.list()).map((p) => store.load(p.id)))).filter((p): p is Project => Boolean(p));
      setEntries(
        await Promise.all(
          projects.map(async (project) => {
            const raw = await kv.get<string>(`sheets/${project.id}`);
            try {
              return { project, sheets: raw ? importSheets(raw) : null };
            } catch {
              return { project, sheets: null };
            }
          }),
        ),
      );
    })().catch(() => setProblem("Your projects couldn't be read in this browser."));
  }, []);
  const cards = useMemo(() => shelf(entries ?? [], query), [entries, query]);

  if (problem) return <p className="library-error" role="alert">{problem}</p>;
  if (!entries) return null;
  if (!cards.length) {
    return (
      <div className="library-blank">
        <p>{query.trim() ? `No script matches “${query.trim()}”.` : "No scripts yet."}</p>
        <p className="library-blank-sub">Write one with Claude, upload a PDF, Final Draft or Fountain file, or lay out a format&rsquo;s beats. Every script lands here.</p>
        <div className="cm-row"><Link className="pill" href="/library">Start a script</Link></div>
      </div>
    );
  }
  return (
    <div className="gl-scripts">
      {cards.map((c) => (
        <article key={c.project} className="gl-script">
          <Link className="gl-script-pic" href={`/board/${c.project}/sheets`} aria-label={`Open ${c.title}`}>
            {c.picture ? <img src={c.picture} alt="" loading="lazy" /> : <img src="/start/upload.webp" alt="" loading="lazy" className="stock" />}
            <span>{c.format}</span>
          </Link>
          <div className="gl-script-body">
            <b>{c.title}</b>
            {c.name !== c.title && <small>in {c.name}</small>}
            {c.logline && <p>{c.logline}</p>}
            <p className="gl-script-meta">
              {c.episodes > 1 ? `${c.episodes} episodes · ` : ""}{c.scenes} scene{c.scenes === 1 ? "" : "s"} · {c.characters} cast · {c.places} place{c.places === 1 ? "" : "s"}
              <br />
              {c.beats} beat{c.beats === 1 ? "" : "s"} · {c.shots} shot{c.shots === 1 ? "" : "s"} · {clock(c.seconds)} of {clock(c.target)} · {when(c.updatedAt)}
            </p>
            <div className="cm-row">
              <Link className="pill on" href={`/board/${c.project}/sheets`}>Open the script</Link>
              <Link className="pill" href={`/board/${c.project}`}>Board</Link>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
