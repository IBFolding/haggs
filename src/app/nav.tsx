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
import { CreditChip } from "./credit-chip";
import { setOpenOnly, setPro, usePrefs } from "./prefs";

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
  { label: "Playable", href: "/playable" },
] as const;

const TIPS = [
  "Draft on Fast, finish on Best.",
  "Change one thing per take.",
  "A still is cheaper than a clip: fix the picture first.",
  "Lock the light and every shot there matches.",
  "Hooks under ten words.",
  "Reshoot keeps the face. A remake rolls the dice.",
];

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
  const [tip, setTip] = useState(0);
  const { pro, openOnly } = usePrefs();
  const [explain, setExplain] = useState(false);

  useEffect(() => {
    void keysHeld().then(setHeld);
    // On a phone the page-level tabs scroll sideways: bring the current one into view.
    const here = document.querySelector<HTMLElement>(".modes [aria-current='page']");
    const row = here?.closest<HTMLElement>(".modes");
    if (here && row) row.scrollLeft = here.offsetLeft - (row.clientWidth - here.offsetWidth) / 2;
    const rotate = setInterval(() => setTip((n) => n + 1), 6000);
    const show = () => setOpen(true);
    window.addEventListener(OPEN_KEYS, show);
    return () => { clearInterval(rotate); window.removeEventListener(OPEN_KEYS, show); };
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
        <span className="nav-modes">
          <button className={`nav-open${openOnly ? " on" : ""}`} aria-pressed={openOnly} onClick={() => setOpenOnly(!openOnly)} title="No partner model is ever called">
            {openOnly ? "●" : "○"} Open weights only
          </button>
          <span className="nav-seg" role="group" aria-label="How much to show" title="Pro shows every model's seed, negative prompt and CFG. Nothing is hidden or removed in Simple.">
            <button aria-pressed={!pro} onClick={() => setPro(false)}>Simple</button>
            <button aria-pressed={pro} onClick={() => setPro(true)}>Pro</button>
          </span>
          <span className="nav-explain-wrap">
            <button className="nav-help" onClick={() => setExplain((v) => !v)} aria-expanded={explain} title="What do these do?" aria-label="What do Open weights only and Pro do?">?</button>
            {explain && (
              <span className="nav-explain" role="dialog" aria-label="The two switches">
                <b>Simple or Pro</b>
                <span>Pro adds the extra controls a model accepts: a seed to repeat a result, a negative prompt, and CFG. Simple keeps them at the model&rsquo;s defaults. Your runs are the same either way until you change one.</span>
                <b>Open weights only</b>
                <span>Nothing runs on a partner model. Photos and Video stop, and only open-weights workflows run: on your own GPU when it&rsquo;s connected (Keys → Connect my GPU), otherwise on Comfy Cloud.</span>
                <button className="plain" onClick={() => setExplain(false)}>Got it</button>
              </span>
            )}
          </span>
        </span>
        <span className="nav-right">
          <span className="nav-tip" aria-hidden><i>●</i><span key={tip}>{TIPS[tip % TIPS.length]}</span></span>
          <ActivityMenu />
          <CreditChip ownKey={held.comfy} />
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
      {openOnly && (
        <div className="nav-openbar" role="status">
          Open weights only · no partner model is called · runs on your GPU when connected, otherwise Comfy Cloud
          <button onClick={() => setOpenOnly(false)}>Turn off</button>
        </div>
      )}
      {open && <KeySheet held={held} onChange={setHeld} onClose={() => setOpen(false)} />}
      <Producer />
      <Tour />
      <CloudSync />
      <RunSync />
    </>
  );
}
