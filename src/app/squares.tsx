"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type { Template } from "../catalog/templates";
import type { Entry } from "../server/comfy-library";
import { listWorkflows } from "./workflow-actions";

/**
 * The squares: what you can start from, shown by what it makes. haggs's own
 * templates fill the composer; Comfy workflows open as apps with their own
 * example results. Always there above your runs, and folds away.
 */

const SHOWN = "haggs.squares.shown";
const FOR: Record<string, (e: Entry) => boolean> = {
  Create: (e) => e.kind === "image" && ["Image", "Product & Ads", "Character & Fashion", "Brand & Design"].includes(e.category),
  Video: (e) => e.kind === "video" || (e.category === "Character & Fashion" && e.tags.some((t) => /video/i.test(t))),
};
const FIRST: Record<string, string[]> = {
  Video: ["api_higgsfield_genjutsu_motion_transfer", "template_seedance2_0_viral_videos_character_swap", "video_minimax_h3_r2v", "api_bria_video_replace_background"],
  Create: [],
};

const isVideo = (url: string) => /\.(mp4|webm)$/i.test(url);

export function Squares({ surface, templates, onPick }: { surface: string; templates: Template[]; onPick: (t: Template) => void }) {
  const [comfy, setComfy] = useState<Entry[]>([]);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    try {
      setOpen(localStorage.getItem(SHOWN) !== "no");
    } catch {
      // Storage blocked: keep them showing.
    }
    const pick = FOR[surface];
    if (!pick) return;
    let live = true;
    void listWorkflows()
      .then((l) => {
        if (!live) return;
        const fits = l.entries.filter(pick);
        const first = (FIRST[surface] ?? []).map((n) => fits.find((e) => e.name === n)).filter((e): e is Entry => Boolean(e));
        const rest = fits.filter((e) => !first.includes(e)).sort((a, b) => b.usage - a.usage);
        setComfy([...first, ...rest].slice(0, 8));
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [surface]);

  const toggle = () =>
    setOpen((was) => {
      try {
        localStorage.setItem(SHOWN, was ? "no" : "yes");
      } catch {
        // Remembering is a convenience.
      }
      return !was;
    });

  if (!templates.length && !comfy.length) return null;
  return (
    <section className="squares" aria-label="Start from a template">
      <header>
        <b>Start from a template</b>
        <Link className="plain" href="/workflows">All Comfy workflows</Link>
        <button className="plain" aria-expanded={open} onClick={toggle}>{open ? "Hide" : "Show"}</button>
      </header>
      {open && (
        <div className="squares-grid">
          {templates.map((t) => (
            <button key={t.id} className={`square${t.sample ? "" : " bare"}`} onClick={() => onPick(t)}>
              {t.sample && (isVideo(t.sample) ? <video src={t.sample} muted loop autoPlay playsInline /> : <img src={t.sample} alt="" loading="lazy" />)}
              <span className="square-face">
                <b>{t.name}</b>
                <small>{t.fromPicture ? "Starts from your picture" : t.blurb}</small>
              </span>
            </button>
          ))}
          {comfy.map((e) => (
            <Link key={e.name} className="square" href={`/workflows/${encodeURIComponent(e.name)}`}>
              <img src={e.thumb} alt="" loading="lazy" />
              <span className="square-tag">Comfy workflow</span>
              <span className="square-face">
                <b>{e.title}</b>
                <small>{e.models.slice(0, 2).join(", ")}</small>
              </span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
