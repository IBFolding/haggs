"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { normalize } from "../../story/boards";
import { defaultKv } from "../../story/kv";
import type { Project } from "../../story/model";
import { createProjectStore } from "../../story/store";
import { Nav } from "../nav";
import { LAST_BOARD } from "../project-tabs";
import { SiteFooter } from "../site-footer";

/**
 * The editor in the header: the cut of the board you last worked on, or a
 * choice of boards when there isn't one. The editor itself is each board's
 * Cut tab.
 */
export function EditorHome() {
  const router = useRouter();
  const store = useMemo(() => createProjectStore(defaultKv()), []);
  const [error,setError]=useState<string|null>(null);
  const [projects, setProjects] = useState<Project[] | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const last = JSON.parse(localStorage.getItem(LAST_BOARD) ?? "null") as { project: string; board: string } | null;
        if (last) { const found=await store.load(last.project); if(found && normalize(found).boards?.some(b=>b.id===last.board)) return router.replace(`/board/${last.project}/cut?b=${encodeURIComponent(last.board)}`); }
      } catch {
        // Nothing remembered.
      }
      const list = await store.list();
      const loaded = (await Promise.all(list.map((p) => store.load(p.id)))).filter((p): p is Project => Boolean(p));
      setProjects(loaded.map(normalize));
    })().catch(()=>setError("Your projects could not be opened. Reload to retry, or return to Projects."));
  }, [store, router]);

  return (
    <div className="app">
      <Nav current="Editor" />
      <div className="canvas">
        <div className="wf">
          <header className="wf-head"><div><h1>Editor</h1><p>Choose a project to arrange clips, add titles and sound, review the sequence, and export. Each board has its own edit (Cut).</p></div></header>
          {error ? <p role="alert">{error} <button className="pill" onClick={()=>window.location.reload()}>Retry</button> <Link href="/library">Back to Projects</Link></p> : !projects ? (
            <p className="wf-note" role="status">Opening your last cut…</p>
          ) : !projects.length ? (
            <p className="wf-note">No projects yet. <Link href="/library">Start one in Projects</Link>, then its Cut opens here.</p>
          ) : (
            <ul className="ed-list">
              {projects.flatMap((p) =>
                p.boards!.map((b) => (
                  <li key={`${p.id}/${b.id}`}>
                    <Link href={`/board/${p.id}/cut?b=${encodeURIComponent(b.id)}`}>
                      <b>{b.name}</b>
                      <span>{p.name} · {b.shots.length} shot{b.shots.length === 1 ? "" : "s"}</span>
                    </Link>
                  </li>
                )),
              )}
            </ul>
          )}
        </div>
        <SiteFooter />
      </div>
    </div>
  );
}
