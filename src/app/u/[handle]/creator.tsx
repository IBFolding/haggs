"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { cleanHandle } from "../../../account/profile";
import { exploreMessage, toPublic, type Post, type PublicProfile } from "../../../community/explore";
import { Face, PostGrid, PostView, SocialLinks, loadPosts, removePost } from "../../explore/feed";
import { Nav } from "../../nav";
import { supabase, useSession } from "../../session";
import { SiteFooter } from "../../site-footer";

/** A creator's page: who they are, where to find them, and everything they've shared. */
export function Creator({ handle }: { handle: string }) {
  const { session } = useSession();
  const [who, setWho] = useState<PublicProfile | null | undefined>(undefined);
  const [posts, setPosts] = useState<Post[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const [open, setOpen] = useState<Post | null>(null);

  useEffect(() => {
    const h = cleanHandle(handle);
    const db = supabase();
    if (!h || !db) { setWho(null); return; }
    void db.from("profiles").select("user_id,handle,name,picture,bio,links").eq("handle", h).maybeSingle().then(async ({ data, error }) => {
      if (error) { setProblem(exploreMessage(error, "This page couldn't be loaded.")); setWho(null); return; }
      if (!data) { setWho(null); return; }
      const p = toPublic(data as Record<string, unknown>);
      setWho(p);
      const r = await loadPosts({ userId: p.userId, limit: 120 });
      setPosts(r.posts); setProblem(r.problem);
    });
  }, [handle]);

  const mine = Boolean(who && session?.user.id === who.userId);
  const spent = posts.reduce((s, p) => s + (p.credits ?? 0), 0);

  return (
    <div className="app">
      <Nav current="Explore" />
      <div className="canvas">
        <div className="ex">
          {who === undefined ? <p className="acct-muted">Loading…</p> : who === null ? (
            <div className="chars-sheet ex-empty"><div className="wf-result-wait">{problem ?? `There's no one called @${handle} here.`} <Link href="/explore">See Explore</Link></div></div>
          ) : (
            <>
              <header className="ex-profile">
                <Face who={who} size={104} />
                <div>
                  <h1>{who.name || `@${who.handle}`}</h1>
                  <p className="ex-handle">@{who.handle}</p>
                  {who.bio && <p className="ex-bio">{who.bio}</p>}
                  <SocialLinks who={who} />
                </div>
                <div className="ex-stats">
                  <span><b>{posts.length}</b><small>shared</small></span>
                  <span><b>{spent.toLocaleString("en-US")}</b><small>credits shown</small></span>
                  {mine && <Link className="pill" href="/account">Edit profile</Link>}
                </div>
              </header>
              {problem && <p className="library-error">{problem}</p>}
              {posts.length === 0 ? <div className="chars-sheet ex-empty"><div className="wf-result-wait">{mine ? "Nothing shared yet. Press Share to Explore on anything in your Gallery." : "Nothing shared yet."}</div></div> : <PostGrid posts={posts} onOpen={setOpen} showBy={false} />}
            </>
          )}
        </div>
        <SiteFooter />
      </div>
      {open && <PostView post={open} mine={mine} onClose={() => setOpen(null)} onRemove={() => void removePost(open.id).then((err) => { if (err) return setProblem(err); setPosts((all) => all.filter((p) => p.id !== open.id)); setOpen(null); })} />}
    </div>
  );
}
