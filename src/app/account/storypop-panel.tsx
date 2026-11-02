"use client";

import { useEffect, useState } from "react";

import { authed, supabase } from "../session";

type Job = { reference: string; kind: string; status: string; input: Record<string, unknown>; created_at: string };

/** Connect StoryPop, and finish the jobs StoryPop has sent you. */
export function StoryPopPanel() {
  const [token, setToken] = useState<string | null>(null);
  const [linked, setLinked] = useState<boolean | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const db = supabase();
    if (!db) return;
    const { data: link } = await db.from("storypop_links").select("user_id").maybeSingle();
    setLinked(Boolean(link));
    const { data } = await db.from("storypop_jobs").select("reference,kind,status,input,created_at").in("status", ["queued", "running"]).order("created_at", { ascending: false }).limit(10);
    setJobs((data as Job[] | null) ?? []);
  };

  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get("storypop_link"));
    void load();
  }, []);

  const connect = async () => {
    setBusy(true);
    setNote("");
    const res = await authed("/api/storypop/link", { method: "POST", body: JSON.stringify({ token }) });
    const body = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
    setBusy(false);
    setNote(res.ok ? "Connected. You can close this and go back to StoryPop." : body?.error ?? "Could not connect.");
    if (res.ok) {
      setToken(null);
      void load();
    }
  };

  const disconnect = async () => {
    await authed("/api/storypop/link", { method: "DELETE" });
    void load();
  };

  const send = async (reference: string, status: "completed" | "failed", resultUrl?: string) => {
    const res = await authed("/api/storypop/jobs/finish", { method: "POST", body: JSON.stringify({ reference, status, resultUrl }) });
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    setNote(res.ok ? "Sent to StoryPop." : body?.error ?? "Could not send it.");
    void load();
  };

  if (linked === null && !token) return null;
  return (
    <section aria-label="StoryPop" style={{ marginTop: 24 }}>
      <h2>StoryPop</h2>
      {token && !linked ? (
        <>
          <p>StoryPop is asking to connect to your haggs account. You'll share one sign-in and one credit balance, and StoryPop can send you jobs to make. It can't spend your credits or see your projects.</p>
          <button type="button" onClick={connect} disabled={busy}>{busy ? "Connecting…" : "Connect to StoryPop"}</button>
        </>
      ) : linked ? (
        <>
          <p>Connected to StoryPop. <button type="button" onClick={disconnect}>Disconnect</button></p>
          {jobs.length === 0 ? <p>No jobs waiting.</p> : null}
          {jobs.map((job) => (
            <form key={job.reference} onSubmit={(e) => { e.preventDefault(); void send(job.reference, "completed", String(new FormData(e.currentTarget).get("url") ?? "")); }} style={{ margin: "12px 0" }}>
              <strong>{job.kind}</strong>: {String(job.input.prompt ?? job.input.sourceShow ?? job.reference)}
              <div>
                <input name="url" type="url" placeholder="https:// link to the finished video" required />
                <button type="submit">Send to StoryPop</button>
                <button type="button" onClick={() => void send(job.reference, "failed")}>It didn't work out</button>
              </div>
            </form>
          ))}
        </>
      ) : null}
      {note ? <p role="status">{note}</p> : null}
    </section>
  );
}
