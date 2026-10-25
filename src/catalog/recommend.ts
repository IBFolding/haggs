/**
 * Which model to try for what you typed: plain rules, no model and no cost. It only ever names a model the page offers,
 * says why in a line, and the page shows it as a suggestion you can ignore.
 */

export type Candidate = { id: string; name: string; inputImages: number };
export type Recommendation = { id: string; name: string; why: string };
type Surface = "Create" | "Video" | "Edit";
type Rule = { when: RegExp; prefer: string[]; why: string; needsPicture?: boolean };

const IMAGE_RULES: Rule[] = [
  { when: /\b(poster|logo|sign|signage|text|headline|typograph\w*|lettering|label|menu|cover|title card|book cover)\b/i, prefer: ["flux-3-image", "nano-banana-2", "flux-2-pro"], why: "Draws words on the picture legibly." },
  { when: /\b(quick|draft|sketch|rough|idea|thumbnail|brainstorm)\b/i, prefer: ["flux/schnell", "z-image", "nano-banana-2-lite"], why: "Fast and cheap, good for seeing if the idea works." },
  { when: /\b(photo|photoreal\w*|realistic|portrait|headshot|product|macro|candid)\b/i, prefer: ["flux-3-image", "nano-banana-2", "flux-2-pro"], why: "Strongest at photographic detail." },
];
const VIDEO_RULES: Rule[] = [
  { when: /\b(says?|said|speaks?|talks?|talking|dialogue|whisper\w*|sings?|singing|voice|conversation|narrat\w*)\b/i, prefer: ["veo-3-1", "veo3.1", "minimax-h3"], why: "Makes the voice and sound together with the picture." },
  { when: /\b(quick|draft|rough|test|preview)\b/i, prefer: ["ltx-2-5-fast", "seedance-2-0-mini", "kling-3.0-turbo"], why: "The fastest way to see if the shot works." },
  { when: /\b(animate|bring (it |this )?to life|make (it |this )?move|come to life)\b/i, prefer: ["kling-v3", "kling/kling-v3", "kling-video"], why: "Keeps a still picture looking like itself when it moves.", needsPicture: true },
  { when: /\b(chase|fight|battle|explosion|crash|run(ning)?|jump\w*|dance|dancing|sport\w*|action|handheld|whip pan)\b/i, prefer: ["seedance-2-5", "seedance-2-0", "kling-v3"], why: "Strong at fast, physical movement." },
];

const find = (list: Candidate[], prefer: string[]) => {
  for (const p of prefer) {
    const hit = list.find((c) => c.id.includes(p));
    if (hit) return hit;
  }
  return undefined;
};

export function recommend(prompt: string, surface: Surface, available: Candidate[], held: number): Recommendation | null {
  const text = prompt.trim();
  if (!text || !available.length) return null;
  const pick = (c: Candidate | undefined, why: string): Recommendation | null => (c ? { id: c.id, name: c.name, why } : null);

  if (surface === "Edit") return pick(find(available, ["kontext", "nano-banana-2"]), "Changes what you ask for and keeps the rest of the picture.");

  const rules = surface === "Video" ? VIDEO_RULES : IMAGE_RULES;
  for (const rule of rules) {
    if (!rule.when.test(text)) continue;
    if (rule.needsPicture && held === 0) continue;
    const hit = pick(find(available, rule.prefer), rule.why);
    if (hit) return hit;
  }
  if (surface === "Video" && held > 0) {
    const hit = pick(find(available, ["kling-v3"]), "Keeps a still picture looking like itself when it moves.");
    if (hit) return hit;
  }
  return surface === "Video"
    ? pick(find(available, ["minimax-h3", "veo-3-1", "kling-v3"]) ?? available[0], "A dependable all-rounder for clips.")
    : pick(find(available, ["nano-banana-2", "flux-3-image"]) ?? available[0], "A dependable all-rounder for pictures.");
}
