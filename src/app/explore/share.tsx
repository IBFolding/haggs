"use client";

import Link from "next/link";
import { useState } from "react";

import { readProfile } from "../../account/profile";
import { cantShare, exploreMessage, profileRow, shareRow } from "../../community/explore";
import type { Run } from "../../story/runs";
import { supabase, useSession } from "../session";

/**
 * Share to Explore, under a Gallery item. It asks first, puts up your public profile (from your Account page) if it
 * isn't up yet, then the post. What it shares is said before you press: the picture or clip, the prompt, the model and
 * the price.
 */
export function ShareToExplore({ run }: { run: Run }) {
  const { session } = useSession();
  const [step, setStep] = useState<"idle" | "ask" | "busy" | "done">("idle");
  const [note, setNote] = useState<string | null>(null);
  const profile = session ? readProfile(session.user.user_metadata?.profile) : null;
  const why = session ? cantShare(run, profile) : "Sign in to share.";

  async function share() {
    if (!session || !profile || (run.kind !== "image" && run.kind !== "video")) return;
    setStep("busy"); setNote(null);
    const db = supabase();
    const row = profileRow(profile, session.user.id);
    if (!db || !row) { setStep("ask"); return setNote("Pick a handle on your Account page first."); }
    const up = await db.from("profiles").upsert(row, { onConflict: "user_id" });
    if (up.error) { setStep("ask"); return setNote(exploreMessage(up.error, "Your profile couldn't be put up.")); }
    const { error } = await db.from("posts").insert(shareRow({ url: run.url, kind: run.kind, prompt: run.prompt, modelName: run.modelName, usd: run.usd }, session.user.id));
    if (error && error.code !== "23505") { setStep("ask"); return setNote(exploreMessage(error, "It couldn't be shared. Try again.")); }
    setStep("done");
  }

  if (step === "done") return <p className="ex-shared">Shared. <Link href={`/u/${profile?.handle}`}>See it on your page</Link></p>;
  if (why) return <p className="ex-shared muted" title={why}>{why.includes("Account") ? <>To share, <Link href="/account">pick a handle</Link></> : null}</p>;
  if (step === "idle") return <button className="plain ex-share" onClick={() => setStep("ask")}>Share to Explore</button>;
  return (
    <div className="ex-ask" role="group" aria-label="Share to Explore">
      <p>Anyone can see this {run.kind === "video" ? "clip" : "picture"}, its prompt, model and price, under @{profile?.handle}.</p>
      <div className="cm-row">
        <button className="pill" disabled={step === "busy"} onClick={() => void share()}>{step === "busy" ? "Sharing…" : "Share it"}</button>
        <button className="plain" disabled={step === "busy"} onClick={() => { setStep("idle"); setNote(null); }}>Cancel</button>
      </div>
      {note && <small className="library-error" role="alert">{note}</small>}
    </div>
  );
}
