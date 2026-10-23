"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A whole film made, start to finish, played on a loop: the sentence that
 * starts it, the board of priced cards, the cut with its tracks, the render.
 * The pictures and the clip are the real output of Recreate an edit on
 * Comfy (FLUX 3 for the stills, MiniMax H3 for the clips), not stock.
 */

const STEPS = [
  { id: "write", tab: "Sheets", title: "Say what you want", says: "A sentence, a script or an edit you love. haggs fills the sheets: scenes, who is in them, where, and a shot list.", spent: "$0.00" },
  { id: "board", tab: "Board", title: "See every shot and its price", says: "Each shot is a card on a flow chart. Make the pictures, look, then animate the ones you want.", spent: "$2.92" },
  { id: "cut", tab: "Cut", title: "Cut it with real tracks", says: "Voice, effects and music on their own lanes. Fade, frame, title, mark, reshoot or fix part of a frame.", spent: "$2.92" },
  { id: "render", tab: "Cut", title: "Render and take it with you", says: "One button makes the MP4. Or export to Final Cut and Resolve, or an ffmpeg script.", spent: "$2.92" },
] as const;

const FRAMES = [0, 1, 2, 3, 4].map((i) => `/showcase/outfit-${i}.jpg`);
const SHOTS = ["Mirror reveal", "The collar", "The trousers", "The shoes", "The turn"];
const SECONDS = ["1.5s", "1.2s", "1.2s", "1.2s", "2s"];
const HOLD = 7000;

export function WorkflowDemo() {
  const [step, setStep] = useState(0);
  const [auto, setAuto] = useState(true);
  const [seen, setSeen] = useState(false);
  const root = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el || typeof IntersectionObserver === "undefined") return setSeen(true);
    const io = new IntersectionObserver(([e]) => setSeen(Boolean(e?.isIntersecting)), { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!auto || !seen || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setTimeout(() => setStep((s) => (s + 1) % STEPS.length), HOLD);
    return () => clearTimeout(t);
  }, [step, auto, seen]);

  const current = STEPS[step]!;
  return (
    <section className="wd" id="how" ref={root} aria-label="A whole film, start to finish">
      <h2>One sentence in, a finished film out</h2>
      <div className="wd-body">
        <ol className="wd-steps">
          {STEPS.map((s, i) => (
            <li key={s.id}>
              <button className={i === step ? "on" : i < step ? "done" : ""} onClick={() => { setAuto(false); setStep(i); }} aria-current={i === step}>
                <span className="wd-n">{i < step ? "✓" : i + 1}</span>
                <b>{s.title}</b>
                <small>{s.says}</small>
                {i === step && auto && seen && <i className="wd-bar" style={{ animationDuration: `${HOLD}ms` }} key={`bar-${step}`} />}
              </button>
            </li>
          ))}
        </ol>

        <div className="wd-window" aria-hidden="true">
          <div className="wd-chrome">
            <span className="wd-dots"><i /><i /><i /></span>
            <span className="wd-title">Outfit check · Ellis</span>
            <nav>{["Sheets", "Board", "Cut", "Media"].map((t) => <em key={t} className={t === current.tab ? "on" : ""}>{t}</em>)}</nav>
          </div>

          <div className="wd-stage" key={current.id}>
            {current.id === "write" && (
              <div className="wd-write">
                <p className="wd-prompt"><span>Recreate the outfit-check edit around Ellis: camel overcoat, cream knit, white sneakers, a rainy street.</span></p>
                <ul>
                  {SHOTS.map((s, i) => (
                    <li key={s} style={{ "--k": i } as React.CSSProperties}><b>{i + 1}</b>{s}<small>{SECONDS[i]}</small></li>
                  ))}
                </ul>
                <div className="wd-chips"><span>Cast · Ellis</span><span>9:16</span><span>Photoreal</span></div>
              </div>
            )}

            {current.id === "board" && (
              <div className="wd-board">
                {FRAMES.map((f, i) => (
                  <figure key={f} style={{ "--k": i } as React.CSSProperties}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={f} alt="" />
                    <figcaption>{SHOTS[i]}</figcaption>
                    <span className="wd-price a">$0.07</span>
                    <span className="wd-price b">$0.52</span>
                  </figure>
                ))}
                <svg className="wd-wire" viewBox="0 0 500 4" preserveAspectRatio="none"><path d="M0 2 H500" /></svg>
              </div>
            )}

            {current.id === "cut" && (
              <div className="wd-cut">
                <div className="wd-strip">
                  {FRAMES.map((f, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={f} src={f} alt="" style={{ "--k": i } as React.CSSProperties} />
                  ))}
                  <span className="wd-head" />
                  <span className="wd-flag">Cut on the turn</span>
                </div>
                <div className="wd-lane v"><b>Voice</b><i style={{ left: "8%", width: "26%" }}>“Tell me what I missed”</i></div>
                <div className="wd-lane f"><b>Effects</b><i style={{ left: "46%", width: "14%" }}>puddle</i></div>
                <div className="wd-lane m"><b>Music</b><i style={{ left: "0%", width: "100%" }}>Score</i></div>
                <div className="wd-lane t"><b>Titles</b><i style={{ left: "2%", width: "22%" }}>OUTFIT CHECK</i></div>
              </div>
            )}

            {current.id === "render" && (
              <div className="wd-render">
                <div className="wd-btn">Render MP4</div>
                <div className="wd-progress"><i /></div>
                <div className="wd-out">
                  <video src="/showcase/recreate-outfit-check.mp4" poster="/showcase/recreate-outfit-check.jpg" muted loop playsInline autoPlay preload="auto" />
                  <p><b>22 seconds</b> · 1080 × 1920<br />5 pictures + 5 clips on Comfy</p>
                </div>
              </div>
            )}
          </div>

          <div className="wd-foot"><span>Spent so far</span><b key={current.spent + current.id}>{current.spent}</b></div>
        </div>
      </div>
    </section>
  );
}
