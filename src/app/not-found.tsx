import Link from "next/link";

export default function NotFound() {
  return (
    <div className="app">
      <div className="canvas">
        <div className="au">
          <h1>There is nothing here.</h1>
          <p className="wf-small">The page may have moved. Start from the beginning, or open your projects.</p>
          <p className="sheet-row"><Link className="fire" href="/">Home</Link><Link className="plain" href="/library">Your projects</Link></p>
        </div>
      </div>
    </div>
  );
}
