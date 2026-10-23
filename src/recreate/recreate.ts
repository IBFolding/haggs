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

/** A starting structure: the shots of a familiar kind of edit, ready to be built around your own person. */
export type EditPreset = { id: string; name: string; says: string; vertical: boolean; shots: { what: string; camera: string; text?: string; seconds: number }[] };

export const EDIT_PRESETS: EditPreset[] = [
  { id: "outfit-check", name: "Outfit check", says: "A mirror reveal, then the pieces.", vertical: true, shots: [
    { what: "The character stands in front of a full-length mirror, phone raised, framed from head to toe", camera: "static", text: "OUTFIT CHECK", seconds: 1.5 },
    { what: "A close shot of the top, the character adjusting the collar", camera: "slow push-in", text: "TOP", seconds: 1.2 },
    { what: "A low shot of the trousers and the walk toward camera", camera: "low tracking", text: "BOTTOMS", seconds: 1.2 },
    { what: "A tight shot of the shoes stepping onto a wet pavement", camera: "static", text: "SHOES", seconds: 1.2 },
    { what: "The character turns once in the street, full length, golden light", camera: "handheld orbit", text: "THE FIT", seconds: 2 } ] },
  { id: "product-reveal", name: "Product reveal", says: "Hide it, reveal it, show the detail.", vertical: true, shots: [
    { what: "A shape under a dark cloth on a clean table, a hand reaching for it", camera: "static", text: "WAIT FOR IT", seconds: 1.5 },
    { what: "The cloth pulled away to show the product, light catching its edge", camera: "fast push-in", seconds: 1.2 },
    { what: "A macro shot of the product's finest detail, droplets or texture", camera: "slow slide", seconds: 1.8 },
    { what: "The product held by the character, looking straight into camera, smiling", camera: "static", text: "AVAILABLE NOW", seconds: 2 } ] },
  { id: "day-in-the-life", name: "A day in the life", says: "Morning to night in six beats.", vertical: true, shots: [
    { what: "The character wakes in a sunlit bedroom and stretches", camera: "static", text: "6AM", seconds: 1.5 },
    { what: "The character pours coffee in a bright kitchen", camera: "close handheld", text: "8AM", seconds: 1.3 },
    { what: "The character walks through a busy street with headphones on", camera: "tracking", text: "10AM", seconds: 1.5 },
    { what: "The character at work, laughing with a colleague at a desk", camera: "handheld", text: "1PM", seconds: 1.5 },
    { what: "The character on a rooftop at sunset, city behind", camera: "slow push-in", text: "6PM", seconds: 1.8 },
    { what: "The character reading in bed by a lamp, relaxed", camera: "static", text: "11PM", seconds: 1.8 } ] },
  { id: "walk-and-talk", name: "Walk and talk", says: "One person, one street, four angles.", vertical: false, shots: [
    { what: "The character walks toward camera down a city street, talking", camera: "backwards tracking", seconds: 2 },
    { what: "Side view of the character walking, gesturing with one hand", camera: "tracking", seconds: 2 },
    { what: "Over the shoulder of the character as the street opens ahead", camera: "handheld", seconds: 1.8 },
    { what: "Close on the character's face, a small smile as they stop", camera: "slow push-in", seconds: 1.7 } ] },
  { id: "before-after", name: "Before and after", says: "The change, in three shots.", vertical: true, shots: [
    { what: "The character in the starting state: tired, plain, ordinary light", camera: "static", text: "BEFORE", seconds: 1.8 },
    { what: "A fast transition shot: hands, motion, the work in progress", camera: "whip pan", seconds: 1 },
    { what: "The character after the change: confident, glowing, same angle as the first shot", camera: "static", text: "AFTER", seconds: 2 } ] },
  { id: "trailer-open", name: "Trailer cold open", says: "A hook, three glimpses, a title.", vertical: false, shots: [
    { what: "A wide, silent landscape at dawn, a lone figure small in the frame", camera: "slow drone push", seconds: 2.5 },
    { what: "Close on the character's eyes, wide and still", camera: "static", seconds: 1.2 },
    { what: "A burst of motion: the character running through smoke and light", camera: "handheld", seconds: 1 },
    { what: "The character reaching a hand toward something glowing", camera: "slow push-in", seconds: 1.8 },
    { what: "Black. The title appears in plain white letters", camera: "static", text: "TITLE", seconds: 2.5 } ] },
];

/** A preset as the shots the analysis would have found, so both go the same way from here. */
export function presetShots(p: EditPreset): RefShot[] {
  let t = 0;
  return p.shots.map((s) => {
    const start = Math.round(t * 100) / 100;
    t += s.seconds;
    return { start, end: Math.round(t * 100) / 100, seconds: s.seconds, what: s.what, camera: s.camera, text: s.text ?? "", transition: "cut" };
  });
}
