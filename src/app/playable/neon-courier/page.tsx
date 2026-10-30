"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { idbKv } from "../../../story/kv";
import { saveNeonCourier } from "../../../playable/neon-courier";

export default function NeonCourierPage() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [run, setRun] = useState(0);
  const [document, setDocument] = useState<string>();
  useEffect(() => {
    let active = true;
    fetch("/playable/neon-courier/play.html").then(response => {
      if (!response.ok) throw new Error("The game could not load. Please reload to try again.");
      return response.text();
    }).then(html => { if (active) setDocument(html); }).catch(caught => { if (active) setError(String(caught.message)); });
    return () => { active = false; };
  }, []);
  async function edit() {
    setBusy(true);
    setError("");
    try {
      const save = () => saveNeonCourier(idbKv(), async () => {
        const response = await fetch("/playable/neon-courier/game.json");
        if (!response.ok) throw new Error("The game download failed. Please try again.");
        return response.json();
      });
      const game = navigator.locks ? await navigator.locks.request("neon-courier-import", save) : await save();
      router.push(`/playable/${game.id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Saving failed. You can still play here.");
      setBusy(false);
    }
  }
  return <main style={{ minHeight: "100dvh", background: "#08141e", color: "#e9fff9", padding: "16px", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
    <header style={{ width: "min(100%, 780px)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
      <Link href="/playable">← Playable</Link><h1 style={{ fontSize: 22, margin: 0 }}>Neon Courier</h1>
      <button className="pl-ghost" onClick={() => setRun(n => n + 1)}>Replay</button>
    </header>
    {document ? <iframe key={run} title="Neon Courier game" srcDoc={document} sandbox="allow-scripts" allow="autoplay; fullscreen" style={{ width: "min(100%, 780px)", height: "min(75dvh, 780px)", border: 0, borderRadius: 16 }} /> : <p>Loading Neon Courier…</p>}
    <p style={{ margin: 0 }}>Tap or press Space to switch rooftops. Collect crystals. Dodge drones.</p>
    <button className="pl-go" disabled={busy} onClick={() => void edit()}>{busy ? "Opening…" : "Save / open in my library"}</button>
    <small>Your editable save stays in this browser. This play link works on any device.</small>
    {error && <p role="alert">{error}</p>}
  </main>;
}
