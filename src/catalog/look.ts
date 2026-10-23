/**
 * The studio's look controls: camera, framing, light, film, look and grade.
 * Each choice adds plain words to the prompt — no hidden prompt — so what
 * is sent is always what you can read under the composer.
 */

export type LookOption = { id: string; label: string; words: string; swatch?: string[] };
export type LookRow = { id: "camera" | "framing" | "light" | "film" | "look" | "grade"; label: string; options: LookOption[] };

export const LOOK_ROWS: LookRow[] = [
  { id: "camera", label: "Camera", options: [
    { id: "large-format", label: "Large format", words: "shot on a large-format camera, shallow depth of field, rich detail" },
    { id: "super-35", label: "Super 35", words: "shot on a Super 35 cinema camera" },
    { id: "16mm", label: "16mm film", words: "shot on 16mm film, visible grain, soft halation" },
    { id: "handheld", label: "Handheld doc", words: "handheld documentary camera, natural movement" },
    { id: "phone", label: "Phone", words: "shot on a phone camera, natural and unpolished" },
    { id: "drone", label: "Drone", words: "aerial drone camera" },
  ] },
  { id: "framing", label: "Framing", options: [
    { id: "extreme-wide", label: "Extreme wide", words: "extreme wide shot, the figure small in the landscape" },
    { id: "wide", label: "Wide", words: "wide shot" },
    { id: "full", label: "Full", words: "full shot, head to toe" },
    { id: "medium", label: "Medium", words: "medium shot, waist up" },
    { id: "close-up", label: "Close-up", words: "close-up on the face" },
    { id: "extreme-close-up", label: "Extreme close-up", words: "extreme close-up detail" },
    { id: "over-shoulder", label: "Over the shoulder", words: "over-the-shoulder shot" },
    { id: "low-angle", label: "Low angle", words: "low-angle shot looking up" },
    { id: "top-down", label: "Top-down", words: "top-down overhead shot" },
  ] },
  { id: "light", label: "Light", options: [
    { id: "golden-hour", label: "Golden hour", words: "golden hour sunlight, long warm shadows" },
    { id: "blue-hour", label: "Blue hour", words: "blue hour twilight, cool ambient light" },
    { id: "overcast", label: "Overcast soft", words: "soft overcast daylight" },
    { id: "hard-sun", label: "Hard noon sun", words: "hard midday sun, crisp shadows" },
    { id: "practical-night", label: "Practical night", words: "night lit by practical lamps and windows" },
    { id: "neon-night", label: "Neon night", words: "night lit by neon signs, wet reflections" },
    { id: "candle", label: "Candlelight", words: "warm candlelight, deep shadows" },
    { id: "studio", label: "Studio soft", words: "soft studio key light with a gentle rim" },
    { id: "silhouette", label: "Silhouette", words: "backlit silhouette against a bright sky" },
  ] },
  { id: "film", label: "Film", options: [
    { id: "vision3-250d", label: "Vision3 250D", words: "Kodak Vision3 250D film stock look, natural daylight colour" },
    { id: "tungsten-500t", label: "Tungsten 500T", words: "tungsten-balanced 500T film stock look, cool shadows, warm practicals" },
    { id: "portra", label: "Portra 400", words: "Portra 400 look, soft skin tones" },
    { id: "ektachrome", label: "Ektachrome", words: "Ektachrome slide film look, saturated and crisp" },
    { id: "tri-x", label: "Tri-X black and white", words: "black and white Tri-X film look, deep contrast" },
    { id: "digital", label: "Clean digital", words: "clean modern digital look" },
    { id: "vhs", label: "VHS", words: "VHS tape look, scan lines and colour bleed" },
  ] },
  { id: "look", label: "Look", options: [
    { id: "neo-noir", label: "Neo-noir", words: "neo-noir mood, rain-slick streets, hard shadows" },
    { id: "western", label: "Western", words: "western mood, dust and wide horizons" },
    { id: "sci-fi", label: "Sci-fi", words: "grounded science-fiction mood" },
    { id: "period", label: "Period drama", words: "period drama, careful costume and production design" },
    { id: "documentary", label: "Documentary", words: "observational documentary feel" },
    { id: "commercial", label: "Commercial", words: "polished commercial look, everything immaculate" },
    { id: "music-video", label: "Music video", words: "bold music-video styling" },
    { id: "fantasy", label: "Fantasy", words: "storybook fantasy mood" },
    { id: "anime", label: "Anime", words: "anime style, cel-shaded" },
  ] },
  { id: "grade", label: "Grade", options: [
    { id: "teal-orange", label: "Teal and orange", words: "teal and orange colour grade", swatch: ["#123c44", "#3f7b84", "#d8a36a", "#f0c48a"] },
    { id: "bleach-bypass", label: "Bleach bypass", words: "bleach bypass grade, desaturated and contrasty", swatch: ["#2a2c2c", "#6d716f", "#a8aaa4", "#d9d8d0"] },
    { id: "warm-sepia", label: "Warm sepia", words: "warm sepia grade", swatch: ["#3b2414", "#7a4e2c", "#c08a55", "#ead2a8"] },
    { id: "moonlight", label: "Cool moonlight", words: "cool moonlight blue grade", swatch: ["#0d1830", "#24406d", "#5a7fae", "#a9c3e0"] },
    { id: "pastel", label: "Pastel", words: "soft pastel grade", swatch: ["#e8b4bc", "#f3d9c4", "#bfe0d8", "#c9c4ea"] },
    { id: "monochrome", label: "Monochrome", words: "black and white", swatch: ["#111111", "#555555", "#aaaaaa", "#eeeeee"] },
    { id: "neon", label: "Neon magenta", words: "magenta and cyan neon grade", swatch: ["#1a0b2e", "#7b1fa2", "#e91e8c", "#21d4fd"] },
    { id: "natural", label: "Natural", words: "natural true-to-life colour", swatch: ["#3d4a2f", "#8a9a5b", "#d9c8a0", "#f4efe2"] },
  ] },
];

export type LookChoice = Partial<Record<LookRow["id"], string>> & { lens?: "spherical" | "anamorphic"; focal?: number; aperture?: number };

export const FOCALS = [18, 24, 35, 50, 85, 135];
export const APERTURES = [1.4, 2, 2.8, 4, 5.6, 11];

/** The chosen look as one sentence of plain words. */
export function lookPhrase(choice: LookChoice): string {
  const parts: string[] = [];
  for (const row of LOOK_ROWS) {
    const o = row.options.find((x) => x.id === choice[row.id]);
    if (o) parts.push(o.words);
    if (row.id === "camera" && (choice.lens || choice.focal || choice.aperture)) {
      const lens = [choice.lens === "anamorphic" ? "anamorphic" : choice.lens === "spherical" ? "spherical" : "", choice.focal ? `${choice.focal}mm` : "", "lens"].filter(Boolean).join(" ");
      parts.push(choice.aperture ? `${lens} at f/${choice.aperture}` : lens);
    }
  }
  if (!parts.length) return "";
  const s = parts.join(", ");
  return s.charAt(0).toUpperCase() + s.slice(1) + ".";
}

export function withLook(prompt: string, choice: LookChoice): string {
  const words = lookPhrase(choice);
  return words ? `${prompt.trim().replace(/[.\s]+$/, "")}. ${words}` : prompt;
}
