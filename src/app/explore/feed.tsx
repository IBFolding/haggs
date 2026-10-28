"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { exploreMessage, toPost, type Post, type PublicProfile } from "../../community/explore";
import { SOCIALS } from "../../account/profile";
import { supabase } from "../session";

const HANDOFF_KEY = "haggs.handoff";
export const POST_FIELDS = "id,user_id,kind,url,prompt,model,credits,created_at,profiles(handle,name,picture,bio,links)";
const n = (v: number) => v.toLocaleString("en-US");

/** Posts newest first, all or one person's. Returns the posts or a sentence saying why there are none. */
export async function loadPosts(opts: { userId?: string; limit?: number } = {}): Promise<{ posts: Post[]; problem: string | null }> {
  const db = supabase();
  if (!db) return { posts: [], problem: "Explore isn't switched on here." };
  let q = db.from("posts").select(POST_FIELDS).order("created_at", { ascending: false }).limit(opts.limit ?? 60);
  if (opts.userId) q = q.eq("user_id", opts.userId);
  const { data, error } = await q;
  if (error) return { posts: [], problem: exploreMessage(error, "Explore couldn't be loaded. Try again in a moment.") };
  return { posts: (data ?? []).map((r) => toPost(r as Record<string, unknown>)).filter((p): p is Post => Boolean(p)), problem: null };
}

/** A person's face: their picture, or their initial. */
export function Face({ who, size = 28 }: { who: PublicProfile | null; size?: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  if (who?.picture) return <img className="ex-face" src={who.picture} alt="" style={{ width: size, height: size }} />;
  return <span className="ex-face ex-initial" style={{ width: size, height: size, fontSize: size * 0.45 }} aria-hidden>{(who?.name || who?.handle || "?").slice(0, 1).toUpperCase()}</span>;
}

/** Where a person can be found: their socials and website, opened in a new tab and never passed our page. */
export function SocialLinks({ who }: { who: PublicProfile }) {
  const all = [...SOCIALS.map((s) => [s.label, who.links[s.id]] as const), ["Website", who.links.website] as const].filter(([, url]) => url);
  if (!all.length) return null;
  return <div className="ex-socials">{all.map(([label, url]) => <a key={label} href={url!} target="_blank" rel="noopener noreferrer nofollow ugc">{label}</a>)}</div>;
}

export function PostGrid({ posts, onOpen, showBy = true }: { posts: Post[]; onOpen: (p: Post) => void; showBy?: boolean }) {
  return (
    <div className="ex-grid">
      {posts.map((p) => (
        <button key={p.id} className="ex-tile" onClick={() => onOpen(p)} aria-label={`Open ${p.kind === "video" ? "clip" : "picture"}${p.by ? ` by @${p.by.handle}` : ""}`}>
          {p.kind === "video"
            ? <video src={p.url} muted loop playsInline preload="metadata" onMouseEnter={(e) => void e.currentTarget.play().catch(() => undefined)} onMouseLeave={(e) => e.currentTarget.pause()} />
            // eslint-disable-next-line @next/next/no-img-element
            : <img src={p.url} alt={p.prompt.slice(0, 120)} loading="lazy" />}
          {p.kind === "video" && <i className="ex-kind">Clip</i>}
          {showBy && p.by && <span className="ex-by"><Face who={p.by} size={22} /><b>@{p.by.handle}</b></span>}
        </button>
      ))}
    </div>
  );
}

/** One post, large: who made it, the words and model, the price, and the way to make one like it. */
export function PostView({ post, mine, onClose, onRemove }: { post: Post; mine: boolean; onClose: () => void; onRemove: () => void }) {
  const router = useRouter();
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);

  function makeLike() {
    try { sessionStorage.setItem(HANDOFF_KEY, JSON.stringify({ url: "", to: post.kind === "video" ? "Video" : "Create", prompt: post.prompt })); } catch { /* private mode: open the page anyway */ }
    router.push(post.kind === "video" ? "/video" : "/photos");
  }

  return (
    <div className="vk-scrim" onClick={onClose}>
      <div className="ex-view" role="dialog" aria-modal="true" aria-label="Post" onClick={(e) => e.stopPropagation()}>
        <div className="ex-view-media">
          {post.kind === "video"
            ? <video src={post.url} controls autoPlay loop playsInline />
            // eslint-disable-next-line @next/next/no-img-element
            : <img src={post.url} alt={post.prompt.slice(0, 120)} />}
        </div>
        <aside className="ex-view-side">
          <button className="vk-x ex-close" aria-label="Close" onClick={onClose}>×</button>
          {post.by && (
            <Link className="ex-creator" href={`/u/${post.by.handle}`}>
              <Face who={post.by} size={40} />
              <span><b>{post.by.name || `@${post.by.handle}`}</b><small>@{post.by.handle}</small></span>
            </Link>
          )}
          <dl className="ex-facts">
            <div><dt>Made with</dt><dd>{post.model || "haggs"}</dd></div>
            <div><dt>Cost</dt><dd>{post.credits === null ? "Not recorded" : `${n(post.credits)} credits`}</dd></div>
            <div><dt>Shared</dt><dd>{new Date(post.at).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}</dd></div>
          </dl>
          {post.prompt && <div className="ex-prompt"><span className="eyebrow muted">Prompt</span><p>{post.prompt}</p></div>}
          <button className="fire" onClick={makeLike}>Make one like this <span className="cost">priced next</span></button>
          {post.prompt && <button className="pill" onClick={() => void navigator.clipboard?.writeText(post.prompt)}>Copy the prompt</button>}
          {mine && <button className="plain danger" onClick={onRemove}>Take this down</button>}
        </aside>
      </div>
    </div>
  );
}

/** Removes your own post. The database refuses anyone else's. */
export async function removePost(id: string): Promise<string | null> {
  const r = await supabase()?.from("posts").delete().eq("id", id);
  return r?.error ? exploreMessage(r.error, "It couldn't be taken down. Try again.") : null;
}
