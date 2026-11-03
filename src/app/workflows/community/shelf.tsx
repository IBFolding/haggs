"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { listApps, type CommunityApp } from "../../../community/community";
import { STUDIO_SAMPLES, THIRD_PARTY_WORKFLOWS, communityAppPath } from "../../../community/curated";
import { feeLabel } from "../../../community/fees";
import { dbOf } from "../../../community/supabase-db";
import { createAppStore } from "../../../story/apps";
import { defaultKv } from "../../../story/kv";
import { Nav } from "../../nav";
import { supabase, useSession } from "../../session";

const TALL = { aspectRatio: "auto", maxHeight: 420, objectFit: "contain" } as const;

/**
 * Apps other people published: free, or with a creator fee of up to 12¢ a
 * run. Adding one saves a copy in this browser; the fee is taken when you
 * run it, and given back if the run fails.
 */
export function Shelf() {
  const router = useRouter();
  const { session, ready } = useSession();
  const apps = useMemo(() => createAppStore(defaultKv()), []);
  const [list, setList] = useState<CommunityApp[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sb = supabase();

  useEffect(() => {
    if (!sb) return setList([]);
    void listApps(dbOf(sb)).then(setList).catch((e) => { setError(e instanceof Error ? e.message : "The shelf couldn't be loaded."); setList([]); });
  }, [sb]);

  async function add(a: CommunityApp) {
    const saved = await apps.save({
      name: a.name,
      description: a.description,
      workflow: a.workflow,
      ...(a.recipe ? { recipe: a.recipe as never } : {}),
      ...(a.cover ? { cover: a.cover } : {}),
      community: { id: a.id, feeCents: a.feeCents, creatorName: a.creatorName },
    });
    router.push(`/workflows/mine?id=${saved.id}`);
  }

  return (
    <div className="app">
      <Nav current="Workflows" />
      <div className="canvas"><div className="wf">
        <h1>Community</h1>
        <p><Link className="plain" href="/workflows">← Workflows</Link></p>
        <section aria-labelledby="studio-samples">
          <h2 id="studio-samples">Made with haggs</h2>
          <p className="wf-small">Sample outputs from the studio itself, each labelled with what made it.</p>
          <div className="wf-grid">
            {STUDIO_SAMPLES.map((s) => (
              <article key={s.id} className="community-card">
                {s.kind === "video" ? <video src={s.src} poster={s.poster} style={s.tall ? TALL : undefined} muted loop playsInline preload="none" /> : <img src={s.src} alt={s.title} style={s.tall ? TALL : undefined} loading="lazy" />}
                <h3><Link className="community-link" href={communityAppPath(s.id)}>{s.title}</Link></h3>
                <p>{s.note}</p>
                <small>Made with: {s.madeWith}</small>
                <span className="pill community-open" aria-hidden="true">Open app</span>
              </article>
            ))}
          </div>
        </section>
        {THIRD_PARTY_WORKFLOWS.length > 0 && <section aria-labelledby="third-party">
          <h2 id="third-party">Workflows from other creators</h2>
          <p className="wf-small">Links to work we did not make. haggs does not bundle, host or redistribute any of it.</p>
          <div className="wf-grid">
            {THIRD_PARTY_WORKFLOWS.map((w) => (
              <article key={w.id} className="community-card">
                <h3><Link className="community-link" href={communityAppPath(w.id)}>{w.name}</Link></h3>
                <p>{w.summary}</p>
                <small>By <a href={w.creator.url} target="_blank" rel="noopener noreferrer">@{w.creator.name}</a> · Licence {w.license}</small>
                <small>Needs: {w.requirements.join(" · ")}</small>
                <p>{w.notes}</p>
                <span className="pill community-open" aria-hidden="true">Open app</span>
              </article>
            ))}
          </div>
        </section>}
        <h2>Community apps</h2>
        <p className="wf-small">Made by people using haggs. Free, or a creator fee of up to 12 credits a run, on top of what the run costs.</p>
        {!sb && <p className="wf-note">Community apps need an account. This copy of haggs isn&rsquo;t connected to one yet.</p>}
        {ready && sb && !session && <p className="wf-note"><Link href="/signin">Sign in</Link> to run community apps.</p>}
        {error && <p className="library-error" role="alert">{error}</p>}
        {list && list.length === 0 && sb && !error && <p className="wf-note">Nothing is published yet. Open one of your apps and publish the first.</p>}
        <div className="wf-grid">
          {(list ?? []).map((a) => (
            <article key={a.id} className="community-card">
              {a.cover ? (a.cover.kind === "video" ? <video src={a.cover.url} muted loop playsInline autoPlay /> : <img src={a.cover.url} alt="" />) : <div className="community-bare" />}
              <h3>{a.name}</h3>
              <p>{a.description}</p>
              <small>{a.creatorName || "A haggs user"} · {a.runs} runs · {feeLabel(a.feeCents)}</small>
              <button className="pill" onClick={() => void add(a)}>Add to my apps</button>
            </article>
          ))}
        </div>
      </div></div>
    </div>
  );
}
