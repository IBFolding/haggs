import Link from "next/link";

/**
 * A section to show the studio working: words on the left, a film made here on
 * the right, and what a shot costs under it. Laid out from the hero video
 * reference, but it sits below the hero rather than replacing it.
 */
export function ShowcaseReel() {
  return (
    <section className="lp-show" aria-label="See it run">
      <div className="lp-show-text">
        <h2 data-kicker="See it run">From the script to the screen, priced at every step.</h2>
        <p>Turn a script, a photo, a video or a workflow into a finished cut. Pictures, motion, voices and music in one studio, with the price on every button before you press it.</p>
        <div className="lp-cta">
          <Link className="fire" href="/library">Start a project →</Link>
          <Link className="lp-ghost" href="/photos">Make something now</Link>
        </div>
      </div>
      <div className="lp-show-media">
        <div className="lp-show-frame">
          <video src="/brand/hero.mp4" poster="/docs/hero.jpg" muted loop autoPlay playsInline preload="metadata" aria-label="A short film made in haggs" />
        </div>
        <div className="lp-show-chips">
          <div className="lp-chip"><small>Shot 04 · Picture</small><b>7 <i>credits</i></b></div>
          <div className="lp-chip on"><small>Open weights</small><b>0 cr · your GPU</b></div>
        </div>
      </div>
    </section>
  );
}
