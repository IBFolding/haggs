"use client";

import Link from "next/link";

import { openProducer, Producer } from "./agent";
import { useEffect, useState } from "react";

import { keysHeld } from "./actions";
import { useSession } from "./session";
import { KeySheet } from "./key-sheet";
import { ActivityMenu } from "./activity-menu";
import { CloudSync } from "./cloud-sync";
import { RunSync } from "./run-sync";
import { TOUR_EVENT, Tour } from "./tour";

/**
 * The one header. Every page shows exactly this — the same five places and
 * the same key state on the right — so it never changes shape under you.
 * Anything a page needs to do lives in the page, not up here.
 *
 * There is no Explore. Higgsfield's Explore is a feed of other people's work,
 * and there is no community to put in one; Gallery shows your own runs and
 * what they cost instead.
 */

const ITEMS = [
  { label: "Projects", href: "/library" },
  { label: "Photos", href: "/photos" },
  { label: "Video", href: "/video" },
  { label: "Editor", href: "/editor" },
  { label: "Workflows", href: "/workflows" },
  { label: "Gallery", href: "/gallery" },
  { label: "Academy", href: "/academy" },
] as const;

export type Place = (typeof ITEMS)[number]["label"] | "Home" | "Account";

const OPEN_KEYS = "haggs:open-keys";

/** Opens the key sheet from anywhere — a run that needs a key asks for one here. */
export function openKeys() {
  window.dispatchEvent(new Event(OPEN_KEYS));
}

export function Nav({ current }: { current: Place }) {
  const [held, setHeld] = useState({ comfy: false, fal: false, claude: false });
  const { session } = useSession();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    void keysHeld().then(setHeld);
    // On a phone the page-level tabs scroll sideways: bring the current one into view.
    const here = document.querySelector<HTMLElement>(".modes [aria-current='page']");
    const row = here?.closest<HTMLElement>(".modes");
    if (here && row) row.scrollLeft = here.offsetLeft - (row.clientWidth - here.offsetWidth) / 2;
    const show = () => setOpen(true);
    window.addEventListener(OPEN_KEYS, show);
    return () => window.removeEventListener(OPEN_KEYS, show);
  }, []);

  const names = [held.comfy && "Comfy", held.fal && "fal", held.claude && "Claude"].filter(Boolean);
  const label = names.length ? names.join(" + ") : "Add a key";

  return (
    <>
      <nav className="nav">
        <Link className="logo" href="/" aria-label="haggs — home">
          haggs<i>.</i>
        </Link>
        <div className="nav-items">
          {ITEMS.map((item) => (
            <Link key={item.label} className="nav-item" href={item.href} aria-current={item.label === current} data-tour={item.label}>
              {item.label}
            </Link>
          ))}
        </div>
        <span className="nav-right">
          <ActivityMenu />
          <button className="nav-ask" onClick={() => openProducer()} data-tour="ask">Ask Haggy</button>
          <button className="key-state" onClick={() => setOpen(true)} title="Provider keys" data-tour="keys">
            <span className={`lamp${held.comfy || held.fal ? " live" : ""}`} />
            {label}
          </button>
          <button className="nav-help" onClick={() => window.dispatchEvent(new Event(TOUR_EVENT))} title="Take the tour" aria-label="Take the tour">?</button>
          {session ? (
            <Link className="nav-account" href="/account" aria-current={current === "Account"} title={session.user.email ?? "Account"}>
              {(session.user.email ?? "?").slice(0, 1).toUpperCase()}
            </Link>
          ) : (
            <Link className="nav-signin" href="/signin">Sign in</Link>
          )}
        </span>
      </nav>
      {open && <KeySheet held={held} onChange={setHeld} onClose={() => setOpen(false)} />}
      <Producer />
      <Tour />
      <CloudSync />
      <RunSync />
    </>
  );
}
