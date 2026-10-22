import { hashPrompt, promptFor } from "./assemble";
import { normalize, view } from "./boards";
import type { Project, Take } from "./model";
import { takesOf } from "./takes";

/**
 * Takes sent by Claude over MCP: renders made outside the app (a batch run,
 * another tool) dropped onto the shots they belong to. Each joins the shot's
 * takes, so nothing it had is lost, and by default goes on the shot.
 */

export type SentTake = { shot: string; url: string; kind: "image" | "video"; origin?: string; usd?: number; use?: boolean };
export type TakesProposal = { board: string; takes: SentTake[] };

const FILE = /^(\/api\/local\/|https:\/\/)/;

export function validateTakes(raw: unknown): TakesProposal {
  const p = raw as Partial<TakesProposal> | null;
  if (typeof p?.board !== "string" || !p.board) throw new Error("Say which board the takes are for.");
  if (!Array.isArray(p.takes) || p.takes.length < 1 || p.takes.length > 100) throw new Error("Send 1–100 takes at a time.");
  const takes = p.takes.map((t, i): SentTake => {
    if (typeof t?.shot !== "string" || !t.shot) throw new Error(`Take ${i + 1} needs the id of its shot.`);
    if (typeof t.url !== "string" || !FILE.test(t.url) || !["image", "video"].includes(t.kind)) throw new Error(`Take ${i + 1} must be an image or video on this machine or an https link.`);
    return {
      shot: t.shot,
      url: t.url,
      kind: t.kind,
      ...(t.origin ? { origin: String(t.origin).slice(0, 80) } : {}),
      ...(typeof t.usd === "number" && t.usd >= 0 ? { usd: t.usd } : {}),
      ...(t.use === false ? { use: false } : {}),
    };
  });
  return { board: p.board, takes };
}

export function applyTakes(project: Project, proposal: TakesProposal): { project: Project; added: number } {
  const base = normalize(project);
  const board = base.boards!.find((b) => b.id === proposal.board);
  if (!board) throw new Error("That board isn't in this project any more.");
  const seen = view(base, board.id);
  let added = 0;
  const shots = board.shots.map((s) => ({ ...s }));
  for (const sent of proposal.takes) {
    const at = shots.findIndex((s) => s.id === sent.shot);
    if (at < 0) throw new Error(`The board “${board.name}” has no shot ${sent.shot}.`);
    const shot = shots[at]!;
    const takes = takesOf(shot);
    if (takes.some((t) => t.url === sent.url)) continue;
    // Stamped with the prompt the shot has now, so a take that just arrived isn't stale.
    const take: Take = { id: "take-" + crypto.randomUUID().slice(0, 8), url: sent.url, kind: sent.kind, usd: sent.usd ?? null, promptHash: hashPrompt(promptFor(seen, at)), at: Date.now(), ...(sent.origin ? { origin: sent.origin } : {}) };
    shot.takes = [...takes, take];
    if (sent.use !== false) shot.render = { url: take.url, kind: take.kind, usd: take.usd, promptHash: take.promptHash, at: take.at };
    added++;
  }
  return { project: { ...base, boards: base.boards!.map((b) => (b.id === board.id ? { ...b, shots } : b)) }, added };
}
