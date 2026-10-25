import Link from "next/link";

/** The foot of every page you read or browse: where to learn the platform, the plans, the rules and the people behind it. */
export function SiteFooter() {
  return (
    <footer className="site-foot">
      <div className="sf-brand">
        <b>haggs.</b>
        <p>A studio for making pictures, video and series on Comfy. Open source, MIT licensed.</p>
        <p className="sf-small">haggsfield.studio</p>
      </div>
      <nav aria-label="Make">
        <b>Make</b>
        <Link href="/photos">Photos</Link>
        <Link href="/video">Video</Link>
        <Link href="/series">Series</Link>
        <Link href="/editor">Editor</Link>
        <Link href="/workflows">Workflows</Link>
      </nav>
      <nav aria-label="Learn">
        <b>Learn</b>
        <Link href="/docs">How haggs works</Link>
        <Link href="/academy">Academy</Link>
        <Link href="/gallery">Gallery</Link>
      </nav>
      <nav aria-label="Company">
        <b>haggs</b>
        <Link href="/pricing">Plans</Link>
        <Link href="/terms">Terms</Link>
        <Link href="/privacy">Privacy</Link>
        <a href="https://github.com/IBFolding/haggs" target="_blank" rel="noreferrer">GitHub</a>
        <a href="https://github.com/IBFolding/haggs/issues" target="_blank" rel="noreferrer">Report a problem</a>
      </nav>
      <nav aria-label="Follow">
        <b>Follow</b>
        <a href="https://x.com/HaggsField" target="_blank" rel="noreferrer">X, @HaggsField</a>
        <a href="https://www.instagram.com/haggsfieldstudio/" target="_blank" rel="noreferrer">Instagram, @haggsfieldstudio</a>
      </nav>
      <p className="sf-legal">Built on <a href="https://www.comfy.org" target="_blank" rel="noreferrer">Comfy</a>. You pay Comfy directly with your own key, or spend plan credits. haggs shows the price before every run.</p>
    </footer>
  );
}
