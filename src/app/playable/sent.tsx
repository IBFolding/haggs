"use client";

import { useCallback, useEffect, useState } from "react";

import { readSent, type SentGame } from "../../playable/claude";

/**
 * Games Claude has sent over MCP (haggs_propose_game), waiting to be applied.
 * The bridge only exists on your own computer, in development.
 */
export function useSentGames(): { sent: SentGame[]; drop: (id: string) => void } {
  const [sent, setSent] = useState<SentGame[]>([]);
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    let live = true;
    const look = () =>
      fetch("/api/bridge/inbox?project=playable")
        .then((r) => (r.ok ? r.json() : null))
        .then((b: { items?: unknown } | null) => { if (live && b) setSent(readSent(b.items)); })
        .catch(() => undefined);
    void look();
    const t = setInterval(look, 4000);
    return () => { live = false; clearInterval(t); };
  }, []);
  const drop = useCallback((id: string) => {
    setSent((all) => all.filter((x) => x.id !== id));
    void fetch(`/api/bridge/inbox?project=playable&id=${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => undefined);
  }, []);
  return { sent, drop };
}

/** With no Claude key on your own computer: the request to paste to Claude where the haggs MCP is connected. */
export function McpAsk({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="pl-ask">
      <span>No key needed here: paste this to Claude where the haggs MCP is connected, and what it sends shows up on this page to apply.</span>
      <textarea readOnly value={text} rows={3} aria-label="Request for Claude" onFocus={(e) => e.currentTarget.select()} />
      <button className="pl-ghost pl-small" onClick={() => void navigator.clipboard?.writeText(text).then(() => setCopied(true), () => undefined)}>{copied ? "Copied" : "Copy"}</button>
    </div>
  );
}
