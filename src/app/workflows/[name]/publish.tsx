"use client";

import Link from "next/link";
import { useState } from "react";

import { shareDefinition } from "../../../community/share-definition";
import { publishApp } from "../../../community/community";
import { FEE_MAX_CENTS, split } from "../../../community/fees";
import { dbOf } from "../../../community/supabase-db";
import type { SavedApp } from "../../../story/apps";
import { supabase, useSession } from "../../session";

/** Share one of your apps on the Community shelf, free or for up to 12¢ a run. */
export function Publish({ app }: { app: SavedApp }) {
  const { session } = useSession();
  const [reviewed,setReviewed]=useState(false);
  const [cents, setCents] = useState(0);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sb = supabase();
  if (app.community) return null;
  const mine = split(cents);

  async function go() {
    if (!sb || !reviewed) return;
    setBusy(true);
    setError(null);
    try {
      const name = (session?.user.user_metadata?.full_name as string | undefined) ?? session?.user.email?.split("@")[0] ?? "";
      await publishApp(dbOf(sb), app, cents, name);
      setNote("Published. It's on the Community shelf.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The app couldn't be published.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="publish" aria-label="Publish to Community">
      <b>Share on Community</b>
      {!sb ? <p className="wf-small">Publishing needs an account, and this copy of haggs isn&rsquo;t connected to one.</p> : !session ? <p className="wf-small"><Link href="/signin">Sign in</Link> to publish.</p> : (
        <>
          <label className="wf-field">
            <span>Fee per run · {cents === 0 ? "free" : `${cents} credit${cents === 1 ? "" : "s"}`}</span>
            <input type="range" min={0} max={FEE_MAX_CENTS} value={cents} onChange={(e) => setCents(Number(e.target.value))} aria-valuetext={cents === 0 ? "free" : `${cents} credits`} />
          </label>
          <p className="wf-small">{cents === 0 ? "Anyone can run it for just what it costs to generate." : `Runners pay ${cents} credit${cents === 1 ? "" : "s"} on top of what it costs to generate. You earn ${mine.creator} credit${mine.creator === 1 ? "" : "s"} a run.`} Your own runs are free. Your name goes on it.</p>
          <p>Only the node graph and model settings are shared. Prompts, uploaded media, covers, private paths and supplied text inputs are cleared. Recipients supply their own inputs and keys.</p>
          <details><summary>Review the public workflow</summary><pre style={{maxHeight:240,overflow:"auto",whiteSpace:"pre-wrap"}}>{(()=>{try{return JSON.stringify(JSON.parse(shareDefinition(app.workflow)),null,2);}catch{return "This definition cannot be shared.";}})()}</pre></details>
          <label><input type="checkbox" checked={reviewed} onChange={e=>setReviewed(e.target.checked)}/> I reviewed this definition and have permission to share it, including its underlying workflow license.</label>
          <button className="pill" disabled={busy||!reviewed} onClick={() => void go()}>{busy ? "Publishing…" : "Publish"}</button>
          {note && <p className="wf-note" role="status">{note} <Link href="/workflows/community">See the shelf</Link></p>}
          {error && <p className="library-error" role="alert">{error}</p>}
        </>
      )}
    </section>
  );
}
