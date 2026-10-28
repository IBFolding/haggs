import Link from "next/link";

import { Nav } from "./nav";
import { SiteFooter } from "./site-footer";

/**
 * The Learn area: the Academy and the pages that explain haggs share one rail,
 * so how it works, what each model is for, what it costs and the terms are all
 * one click from a lesson.
 */

const ROOMS = [
  { href: "/academy", label: "Academy", says: "7 lessons" },
  { href: "/docs", label: "How it works", says: "every room" },
  { href: "/models", label: "Models", says: "what each is for" },
  { href: "/pricing", label: "Plans and prices", says: "credits and packs" },
  { href: "/terms", label: "Terms", says: "your rights" },
  { href: "/privacy", label: "Privacy", says: "your data" },
] as const;

const FOLLOW = [
  { href: "https://x.com/HaggsField", label: "X · @HaggsField" },
  { href: "https://www.instagram.com/haggsfieldstudio/", label: "Instagram · @haggsfieldstudio" },
  { href: "https://github.com/IBFolding/haggs", label: "GitHub · IBFolding/haggs" },
] as const;

export function LearnShell({ current, children }: { current: (typeof ROOMS)[number]["href"]; children: React.ReactNode }) {
  return (
    <div className="app">
      <Nav current="Academy" />
      <div className="canvas">
        <div className="learn">
          <aside className="learn-rail" aria-label="Learn">
            <span className="eyebrow">Learn</span>
            <nav>
              {ROOMS.map((r) => (
                <Link key={r.href} href={r.href} aria-current={r.href === current ? "page" : undefined}>
                  <b>{r.label}</b>
                  <small>{r.says}</small>
                </Link>
              ))}
            </nav>
            <div className="learn-follow" id="follow">
              <span className="eyebrow muted">Follow</span>
              {FOLLOW.map((f) => <a key={f.href} href={f.href} target="_blank" rel="noreferrer">{f.label}</a>)}
            </div>
          </aside>
          <div className="learn-main">{children}</div>
        </div>
        <SiteFooter />
      </div>
    </div>
  );
}
