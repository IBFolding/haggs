import type { Proposal, ProposalKind } from "../server/bridge";
const kinds = new Set<ProposalKind>(["draft", "breakdown", "fill", "edits", "board", "takes", "voices", "canvas", "series", "game"]);
export function proposalFromRow(value: unknown): Proposal {
  const r = value as Record<string, unknown> | null;
  if (!r || typeof r.id !== "string" || !kinds.has(r.kind as ProposalKind) || typeof r.summary !== "string" || typeof r.created_at !== "string" || !Number.isFinite(Date.parse(r.created_at)) || (r.board != null && typeof r.board !== "string") || (r.format_id != null && typeof r.format_id !== "string")) throw new Error("Invalid agent inbox row.");
  return { id: r.id, kind: r.kind as ProposalKind, summary: r.summary, payload: r.payload, at: Date.parse(r.created_at), ...(typeof r.board === "string" ? { boardId: r.board } : {}), ...(typeof r.format_id === "string" ? { formatId: r.format_id } : {}) };
}
