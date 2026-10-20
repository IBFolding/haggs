"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { keysHeld } from "./actions";
import { KeySheet } from "./key-sheet";

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
  { label: "Create", href: "/" },
  { label: "Video", href: "/video" },
  { label: "Edit", href: "/edit" },
  { label: "Gallery", href: "/gallery" },
] as const;

export type Place = (typeof ITEMS)[number]["label"];

const OPEN_KEYS = "haggs:open-keys";

/** Opens the key sheet from anywhere — a run that needs a key asks for one here. */
export function openKeys() {
  window.dispatchEvent(new Event(OPEN_KEYS));
}

export function Nav({ current }: { current: Place }) {
  const [held, setHeld] = useState({ comfy: false, fal: false, claude: false });
  const [open, setOpen] = useState(false);

  useEffect(() => {
    void keysHeld().then(setHeld);
    const show = () => setOpen(true);
    window.addEventListener(OPEN_KEYS, show);
    return () => window.removeEventListener(OPEN_KEYS, show);
  }, []);

  const names = [held.comfy && "Comfy", held.fal && "fal", held.claude && "Claude"].filter(Boolean);
  const label = names.length ? names.join(" + ") : "Add a key";

  return (
    <>
      <nav className="nav">
        <Link className="logo" href="/library" aria-label="haggs — projects">
          haggs<i>.</i>
        </Link>
        {ITEMS.map((item) => (
          <Link key={item.label} className="nav-item" href={item.href} aria-current={item.label === current}>
            {item.label}
          </Link>
        ))}
        <span className="nav-right">
          <button className="key-state" onClick={() => setOpen(true)} title="Provider keys">
            <span className={`lamp${held.comfy || held.fal ? " live" : ""}`} />
            {label}
          </button>
        </span>
      </nav>
      {open && <KeySheet held={held} onChange={setHeld} onClose={() => setOpen(false)} />}
    </>
  );
}
