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

/** Spoken voice-over lines sent by Claude (made outside the app), put on their shots. */
export type SentVoice = { shot: string; speaker: string; text: string; voice: string; url: string; offset?: number };
export type VoicesProposal = { board: string; lines: SentVoice[] };

export function validateVoices(raw: unknown): VoicesProposal {
  const p = raw as Partial<VoicesProposal> | null;
  if (typeof p?.board !== "string" || !p.board) throw new Error("Say which board the lines are for.");
  if (!Array.isArray(p.lines) || p.lines.length < 1 || p.lines.length > 100) throw new Error("Send 1–100 lines at a time.");
  return {
    board: p.board,
    lines: p.lines.map((l, i) => {
      if (typeof l?.shot !== "string" || typeof l.text !== "string" || !l.text.trim() || typeof l.url !== "string" || !/^\/api\/local\/.+\.(mp3|wav|m4a|flac)$/i.test(l.url)) throw new Error(`Line ${i + 1} needs a shot, its words and a sound file on this machine.`);
      return { shot: l.shot, speaker: String(l.speaker ?? "VOICE").toUpperCase().slice(0, 40), text: l.text.trim().slice(0, 2000), voice: String(l.voice ?? "").slice(0, 80), url: l.url, offset: Math.max(0, Number(l.offset) || 0) };
    }),
  };
}

export function applyVoices(project: Project, proposal: VoicesProposal): { project: Project; added: number } {
  const base = normalize(project);
  const board = base.boards!.find((b) => b.id === proposal.board);
  if (!board) throw new Error("That board isn't in this project any more.");
  let added = 0;
  const shots = board.shots.map((s) => ({ ...s }));
  for (const line of proposal.lines) {
    const shot = shots.find((s) => s.id === line.shot);
    if (!shot) throw new Error(`The board “${board.name}” has no shot ${line.shot}.`);
    if ((shot.voices ?? []).some((v) => v.url === line.url)) continue;
    shot.voices = [...(shot.voices ?? []), { id: "line-" + crypto.randomUUID().slice(0, 8), speaker: line.speaker, text: line.text, voice: line.voice, url: line.url, offset: line.offset ?? 0 }];
    added++;
  }
  return { project: { ...base, boards: base.boards!.map((b) => (b.id === board.id ? { ...b, shots } : b)) }, added };
}
