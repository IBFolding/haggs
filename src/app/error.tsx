"use client";

import Link from "next/link";
import { useEffect } from "react";

/** Anything that breaks on a page lands here instead of a blank screen, with a way forward. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Reported to Vercel's logs; the digest lets a report be matched to the server error.
    console.error("haggs page error", error.digest ?? "", error.message);
  }, [error]);
  return (
    <div className="app">
      <div className="canvas">
        <div className="au">
          <h1>That page hit a problem.</h1>
          <p className="wf-small">Your projects are safe in this browser. Try again, or go back to your projects.{error.digest ? ` (Reference ${error.digest}.)` : ""}</p>
          <p className="sheet-row"><button className="fire" onClick={reset}>Try again</button><Link className="plain" href="/library">Your projects</Link></p>
        </div>
      </div>
    </div>
  );
}
