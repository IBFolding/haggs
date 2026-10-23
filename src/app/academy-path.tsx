"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type { Lesson } from "../academy/lessons";

/** The seven lessons as a road you walk: pick a stop to see what you will have made by the end of it. */

export const MADE: Record<string, string> = {
  "first-video": "/templates/poster-animate-still.webp",
  prompting: "/templates/poster-dolly-zoom.webp",
  camera: "/templates/storyboard-frame.webp",
  characters: "/templates/character-sheet.webp",
  locations: "/templates/location-plate.webp",
  series: "/templates/poster-ugc-talking.webp",
  finish: "/showcase/recreate-outfit-check.jpg",
};

export function AcademyPath({ lessons }: { lessons: Lesson[] }) {
  const [at, setAt] = useState(0);
  const [auto, setAuto] = useState(true);
  useEffect(() => {
    if (!auto || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setAt((n) => (n + 1) % lessons.length), 3600);
    return () => clearInterval(t);
  }, [auto, lessons.length]);
  const lesson = lessons[at]!;
  const total = lessons.reduce((n, l) => n + l.minutes, 0);

  return (
    <div className="ap">
      <ol className="ap-road" onMouseEnter={() => setAuto(false)}>
        {lessons.map((l, i) => (
          <li key={l.id} className={i === at ? "on" : i < at ? "done" : ""}>
            <button onClick={() => { setAuto(false); setAt(i); }} aria-current={i === at}>
              <span className="ap-dot">{i < at ? "✓" : i + 1}</span>
              <b>{l.title}</b>
              <small>{l.minutes} min</small>
            </button>
          </li>
        ))}
      </ol>
      <article className="ap-card" key={lesson.id}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={MADE[lesson.id] ?? "/templates/key-art.webp"} alt="" />
        <div>
          <small>Lesson {at + 1} of {lessons.length} · {lesson.minutes} min</small>
          <h3>{lesson.title}</h3>
          <p>{lesson.goal}</p>
          <p className="ap-make"><b>You make</b> {lesson.homework}</p>
          <Link className="fire" href={`/academy/learn/${lesson.id}`}>{at === 0 ? "Start lesson one" : `Open lesson ${at + 1}`}</Link>
        </div>
      </article>
      <p className="ap-total">{total} minutes in all. Finish all seven for a certificate.</p>
    </div>
  );
}
