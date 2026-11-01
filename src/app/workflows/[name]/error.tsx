"use client";

import Link from "next/link";
import { WORKFLOW_CATALOG_DOWN } from "./workflow-route";

/**
 * The workflow page's own error boundary. A page where the catalog could not
 * answer is not a 404: this boundary re-renders on every request (no caching),
 * and says so, so a valid workflow name survives an outage.
 */
export default function WorkflowError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  if (error.digest === WORKFLOW_CATALOG_DOWN) {
    return (
      <div className="app">
        <div className="canvas">
          <div className="au">
            <h1>Workflows are temporarily unavailable</h1>
            <p className="wf-small">Your workflow library could not be reached right now, so haggs cannot say whether this workflow exists yet. Try again in a minute.</p>
            <p className="sheet-row"><button className="fire" onClick={retry}>Try again</button><Link className="plain" href="/workflows">Workflow library</Link></p>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="app">
      <div className="canvas">
        <div className="au">
          <h1>That page hit a problem.</h1>
          <p className="wf-small">Your projects are safe in this browser. Try again, or go back to your projects.{error.digest ? ` (Reference ${error.digest}.)` : ""}</p>
          <p className="sheet-row"><button className="fire" onClick={retry}>Try again</button><Link className="plain" href="/library">Your projects</Link></p>
        </div>
      </div>
    </div>
  );
}
