"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { hashPrompt, promptFor } from "../../../../story/assemble";
import { commit, view } from "../../../../story/boards";
import { defaultKv } from "../../../../story/kv";
import type { Media, Project } from "../../../../story/model";
import { createProjectStore } from "../../../../story/store";
import { Nav } from "../../../nav";
import { ProjectTabs } from "../../../project-tabs";

/**
 * Everything the project is made of, laid out in board order: each shot with
 * the footage that belongs to it, then the cuts and references that belong to
 * no single shot. Putting a still or take on a shot is one click and costs
 * nothing; it never generates.
 */

const STATUSES: Media["status"][] = ["review", "approved", "rejected", "reference"];
const LABEL: Record<Media["status"], string> = { review: "To review", approved: "Approved", rejected: "Rejected", reference: "Reference" };
type Kind = "all" | "image" | "video";

function Thumb({ url, kind, name }: { url: string; kind: "image" | "video"; name: string }) {
  return kind === "video" ? (
    <video src={url} controls preload="metadata" muted playsInline aria-label={name} />
  ) : (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={name} loading="lazy" />
  );
}

export function MediaTab({ id, boardId }: { id: string; boardId?: string | undefined }) {
  const store = useMemo(() => createProjectStore(defaultKv()), []);
  const [project, setProject] = useState<Project | null>(null);
  const [missing, setMissing] = useState(false);
  const [kind, setKind] = useState<Kind>("all");
  const [hideRejected, setHideRejected] = useState(true);

  useEffect(() => {
    void store.load(id).then((found) => (found ? setProject(found) : setMissing(true)));
  }, [store, id]);

  const edit = useCallback(
    (change: (p: Project) => Project) => {
      setProject((current) => {
        if (!current) return current;
        const next = { ...change(current), updatedAt: Date.now() };
        void store.save(next);
        return next;
      });
    },
    [store],
  );

  if (missing) {
    return (
      <div className="app">
        <Nav current="Projects" />
        <div className="canvas"><div className="library"><div className="library-blank"><p>That project isn&rsquo;t here.</p></div></div></div>
      </div>
    );
  }
  if (!project) return <div className="app"><Nav current="Projects" /></div>;
  const full = project;
  const board = view(full, boardId);

  const media = project.media ?? [];
  const show = (m: Media) => (kind === "all" || m.kind === kind) && !(hideRejected && m.status === "rejected");
  // Media for shots on other boards is shown on those boards, not here.
  const everyShot = new Set((full.boards ?? []).flatMap((b) => b.shots.map((s) => s.id)));
  const loose = media.filter((m) => !m.shotId || !everyShot.has(m.shotId)).filter(show);
  const counts = { image: media.filter((m) => m.kind === "image").length, video: media.filter((m) => m.kind === "video").length };
  const covered = board.shots.filter((s) => s.render).length;

  const setStatus = (mediaId: string, status: Media["status"]) =>
    edit((p) => ({ ...p, media: (p.media ?? []).map((m) => (m.id === mediaId ? { ...m, status } : m)) }));
  const putOnShot = (m: Media, shotId: string) =>
    edit((p) => {
      const seen = view(p, boardId);
      const at = seen.shots.findIndex((s) => s.id === shotId);
      if (at < 0) return p;
      // Hashed against the prompt as it stands, so imported footage does not read as out of date the moment it lands.
      const render = { url: m.url, kind: m.kind, usd: null, promptHash: hashPrompt(promptFor(seen, at)), at: Date.now() };
      return commit(p, boardId, { ...seen, shots: seen.shots.map((s) => (s.id === shotId ? { ...s, render } : s)) });
    });

  return (
    <div className="app">
      <Nav current="Projects" />
      <ProjectTabs project={full} boardId={boardId} current="media" />
      <div className="canvas">
        <div className="md">
          <header className="md-head">
            <div>
              <h1>Media</h1>
              <p>{counts.image} stills · {counts.video} videos in the project · {covered} of {board.shots.length} shots on this board have footage</p>
            </div>
            <div className="md-filters" role="group" aria-label="Show">
              {(["all", "image", "video"] as const).map((k) => (
                <button key={k} className={`pill${kind === k ? " on" : ""}`} onClick={() => setKind(k)}>
                  {k === "all" ? "All" : k === "image" ? "Stills" : "Video"}
                </button>
              ))}
              <label className="md-toggle">
                <input type="checkbox" checked={hideRejected} onChange={(e) => setHideRejected(e.target.checked)} />
                Hide rejected
              </label>
            </div>
          </header>

          {media.length === 0 && board.shots.every((s) => !s.render) && (
            <div className="library-blank">
              <p>No media yet.</p>
              <p className="library-blank-sub">
                Footage you render on the <Link href={`/board/${id}`}>board</Link> shows up here under its shot, along with any stills, takes and cuts imported with the project.
              </p>
            </div>
          )}

          {board.shots.map((shot, i) => {
            const own = media.filter((m) => m.shotId === shot.id).filter(show);
            const renderIsMedia = shot.render && media.some((m) => m.url === shot.render!.url);
            if (!own.length && !shot.render) return null;
            return (
              <section key={shot.id} className="md-shot">
                <div className="md-shot-head">
                  <span className="sh-step">{i + 1}</span>
                  <b>{shot.heading || "Untitled shot"}</b>
                  <span className="sh-meta">{shot.beat.slice(0, 110)}{shot.beat.length > 110 && "…"}</span>
                </div>
                <div className="md-grid">
                  {shot.render && !renderIsMedia && (
                    <figure className="md-item on-shot">
                      <Thumb url={shot.render.url} kind={shot.render.kind} name={`Shot ${i + 1} render`} />
                      <figcaption><b>On the shot</b><span>Generated{shot.render.usd !== null ? ` · $${shot.render.usd.toFixed(3)}` : ""}</span></figcaption>
                    </figure>
                  )}
                  {own.map((m) => {
                    const onShot = shot.render?.url === m.url;
                    return (
                      <figure key={m.id} className={`md-item ${m.status}${onShot ? " on-shot" : ""}`}>
                        <Thumb url={m.url} kind={m.kind} name={m.name} />
                        <figcaption>
                          <b>{m.name}</b>
                          <span>{m.origin}{m.seconds ? ` · ${m.seconds.toFixed(1)}s` : ""}</span>
                          {m.note && <span className="md-note">{m.note}</span>}
                          <span className="md-actions">
                            <select aria-label={`Review status for ${m.name}`} value={m.status} onChange={(e) => setStatus(m.id, e.target.value as Media["status"])}>
                              {STATUSES.map((s) => <option key={s} value={s}>{LABEL[s]}</option>)}
                            </select>
                            {onShot ? <em>On the shot</em> : (
                              <button className="pill" disabled={m.status === "rejected"} onClick={() => putOnShot(m, shot.id)}>Use on shot</button>
                            )}
                          </span>
                        </figcaption>
                      </figure>
                    );
                  })}
                </div>
              </section>
            );
          })}

          {loose.length > 0 && (
            <section className="md-shot">
              <div className="md-shot-head"><b>Cuts and references</b><span className="sh-meta">Not tied to one shot</span></div>
              <div className="md-grid wide">
                {loose.map((m) => (
                  <figure key={m.id} className={`md-item ${m.status}`}>
                    <Thumb url={m.url} kind={m.kind} name={m.name} />
                    <figcaption>
                      <b>{m.name}</b>
                      <span>{m.origin}{m.seconds ? ` · ${m.seconds.toFixed(1)}s` : ""}</span>
                      {m.note && <span className="md-note">{m.note}</span>}
                      <span className="md-actions">
                        <select aria-label={`Review status for ${m.name}`} value={m.status} onChange={(e) => setStatus(m.id, e.target.value as Media["status"])}>
                          {STATUSES.map((s) => <option key={s} value={s}>{LABEL[s]}</option>)}
                        </select>
                      </span>
                    </figcaption>
                  </figure>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
