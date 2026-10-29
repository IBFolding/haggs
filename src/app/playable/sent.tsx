"use client";

import { useState } from "react";

import { useAgentInbox } from "../agent-inbox";
import { readSent, type SentGame } from "../../playable/claude";

/**
 * Games Claude has sent over MCP (haggs_propose_game), waiting to be applied.
 * Uses the shared inbox transport; standalone live destinations need synced projects.
 */
export function useSentGames(): { sent: SentGame[]; drop: (id: string) => void } {
  const { items, drop } = useAgentInbox("playable");
  return { sent: readSent(items), drop: (id) => { void drop(id); } };
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
