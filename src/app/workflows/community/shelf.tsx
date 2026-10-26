"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { listApps, type CommunityApp } from "../../../community/community";
import { feeLabel } from "../../../community/fees";
import { dbOf } from "../../../community/supabase-db";
import { createAppStore } from "../../../story/apps";
import { defaultKv } from "../../../story/kv";
import { Nav } from "../../nav";
import { supabase, useSession } from "../../session";

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
        <h1>Community apps</h1>
        <p className="wf-small">Made by people using haggs. Free, or a creator fee of up to 12 credits a run, on top of what the run costs.</p>
        <p><Link className="plain" href="/workflows">← Workflows</Link></p>
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
