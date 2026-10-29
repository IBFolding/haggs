"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type { Post } from "../../community/explore";
import { Nav } from "../nav";
import { useSession } from "../session";
import { SiteFooter } from "../site-footer";
import { PostGrid, PostView, loadPosts, removePost } from "./feed";

/**
 * Explore: what people make with haggs, newest first. Every post shows who made it, the words and model, and what it
 * cost, and opens on the page that makes one like it. Only things people chose to share from their Gallery are here.
 */
export function Explore() {
  const { session } = useSession();
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [kind, setKind] = useState<"all" | "image" | "video">("all");
  const [open, setOpen] = useState<Post | null>(null);

  useEffect(() => { void loadPosts().then((r) => { setPosts(r.posts); setProblem(r.problem); }); }, []);

  const shown = (posts ?? []).filter((p) => kind === "all" || p.kind === kind);
  const creators = new Set((posts ?? []).map((p) => p.userId)).size;

  return (
    <div className="app">
      <Nav current="Explore" />
      <div className="canvas">
        <div className="ex">
          <header className="ex-head">
            <div>
              <span className="eyebrow">Explore</span>
              <h1>Made with haggs.</h1>
              <p>Pictures and clips people chose to share, each with its prompt, its model and what it cost. Open one to make your own like it.</p>
            </div>
            <div className="ex-head-side">
              {posts && posts.length > 0 && <small>{posts.length} shared by {creators} {creators === 1 ? "person" : "people"}</small>}
              <Link className="pill" href="/gallery">{session ? "Share from your Gallery" : "Sign in to share"}</Link>
            </div>
          </header>

          <div className="rx-filter" role="tablist" aria-label="Kind">
            {(["all", "image", "video"] as const).map((k) => <button key={k} role="tab" aria-selected={kind === k} onClick={() => setKind(k)}>{k === "all" ? "All" : k === "image" ? "Pictures" : "Clips"}</button>)}
          </div>

          {posts === null ? <p className="acct-muted">Loading…</p>
            : problem ? <div className="chars-sheet ex-empty"><div className="wf-result-wait">{problem}</div></div>
            : shown.length === 0 ? (
              <div className="chars-sheet ex-empty"><div className="wf-result-wait">Nothing {kind === "all" ? "" : kind === "image" ? "pictures " : "clips "}shared yet. Make something, then press Share to Explore on it in your Gallery.</div></div>
            ) : <PostGrid posts={shown} onOpen={setOpen} />}
        </div>
        <SiteFooter />
      </div>
      {open && (
        <PostView
          post={open}
          mine={session?.user.id === open.userId}
          onClose={() => setOpen(null)}
          onRemove={() => void removePost(open.id).then((err) => { if (err) return setProblem(err); setPosts((all) => (all ?? []).filter((p) => p.id !== open.id)); setOpen(null); })}
        />
      )}
    </div>
  );
}
