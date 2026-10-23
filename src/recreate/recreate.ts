import { createProject, newShot, type Project } from "../story/model";

/**
 * Recreate an edit: take a reference video (a viral edit, a trailer, an ad),
 * have a video model list its shots, and rebuild the same edit around your
 * own people and place: the same number of shots, the same lengths, the same
 * words on screen, the same camera moves.
 */

export type RefShot = { start: number; end: number; seconds: number; what: string; camera: string; text: string; transition: string };

export const ANALYSIS_PROMPT = `You are a film editor's assistant. Watch this video and list every shot in order as a JSON array and nothing else. Each item: {"start": seconds, "end": seconds, "what": what the camera sees (subject, action, framing, setting) in one plain sentence, "camera": the camera move ("static", "handheld push-in", "slow orbit"...), "text": any words shown on screen, exactly as written, or "", "transition": how it cuts into this shot ("cut", "whip", "flash", "dissolve", "glitch"...)}. Count every cut. Times are in seconds from the start. Do not describe the audio. Reply with the JSON array only.`;

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** Reads the model's reply into shots. Quick flickers are folded into the shot before; times are kept inside the video. */
export function parseShots(reply: string, duration: number): RefShot[] {
  const open = reply.indexOf("[");
  const close = reply.lastIndexOf("]");
  let raw: unknown;
  try {
    raw = open >= 0 && close > open ? JSON.parse(reply.slice(open, close + 1)) : null;
  } catch {
    raw = null;
  }
  const items = Array.isArray(raw) ? (raw as Record<string, unknown>[]) : [];
  const read = items.flatMap((i) => {
    const start = num(i?.start), end = num(i?.end);
    if (start === null || end === null || end <= start) return [];
    return [{ start: Math.max(0, start), end: Math.min(duration, end), what: String(i.what ?? "").trim().slice(0, 400), camera: String(i.camera ?? "").trim().slice(0, 80), text: String(i.text ?? "").trim().slice(0, 120), transition: String(i.transition ?? "cut").trim().slice(0, 30) }];
  }).sort((a, b) => a.start - b.start);
  const shots: RefShot[] = [];
  for (const s of read) {
    if (s.end - s.start < 0.3 && shots.length) {
      shots[shots.length - 1]!.end = Math.max(shots[shots.length - 1]!.end, s.end);
      continue;
    }
    shots.push({ ...s, seconds: 0 });
  }
  for (const s of shots) s.seconds = Math.round((s.end - s.start) * 100) / 100;
  if (!shots.length) throw new Error("The model couldn't find any shots in that video. Try a clip with clear cuts.");
  return shots.slice(0, 60);
}

/** One project, one board: a shot for each reference shot, built around your person. Pictures and clips are made afterwards, priced on the board. */
export function buildRecreation(name: string, shots: RefShot[], opts: { lock?: string; instructions?: string; refs?: string[]; aspect?: "16:9" | "9:16" } = {}): Project {
  const base = createProject(name);
  const board = {
    id: crypto.randomUUID(),
    name: "Recreated edit",
    kind: "reel" as const,
    notes: [],
    ...(opts.aspect === "9:16" ? { aspect: "9:16" as const } : {}),
    shots: shots.map((s) => ({
      ...newShot(),
      heading: "",
      beat: [opts.lock?.trim() ? `${opts.lock.trim().replace(/[.\s]+$/, "")}.` : "", `${s.what.replace(/[.\s]+$/, "")}.`, s.camera ? `Camera: ${s.camera}.` : "", opts.instructions?.trim() ? `${opts.instructions.trim().replace(/[.\s]+$/, "")}.` : ""].filter(Boolean).join(" "),
      seconds: Math.min(15, Math.max(0.5, Math.round(s.seconds * 10) / 10)),
      ...(s.text ? { caption: s.text } : {}),
      ...(opts.refs?.length ? { refs: [...opts.refs] } : {}),
      model: { id: "minimax/minimax-h3", settings: { resolution: "768P", ratio: opts.aspect === "9:16" ? "9:16" : "16:9" } },
    })),
  };
  return { ...base, boards: [board], source: { templateId: "recreate", name } };
}
