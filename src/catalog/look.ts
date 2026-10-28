/**
 * The studio's look controls: camera, framing, light, film, look and grade.
 * Each choice adds plain words to the prompt — no hidden prompt — so what
 * is sent is always what you can read under the composer.
 */

export type LookOption = { id: string; label: string; words: string; swatch?: string[] };
export type LookRow = { id: "camera" | "framing" | "move" | "light" | "film" | "era" | "look" | "grade"; label: string; says: string; videoOnly?: true; options: LookOption[] };

export const LOOK_ROWS: LookRow[] = [
  { id: "camera", label: "Camera", says: "The body, the lens and how much is in focus", options: [
    { id: "large-format", label: "Large format", words: "shot on a large-format camera, shallow depth of field, rich detail" },
    { id: "super-35", label: "Super 35", words: "shot on a Super 35 cinema camera" },
    { id: "16mm", label: "16mm film", words: "shot on 16mm film, visible grain, soft halation" },
    { id: "handheld", label: "Handheld doc", words: "handheld documentary camera, natural movement" },
    { id: "phone", label: "Phone", words: "shot on a phone camera, natural and unpolished" },
    { id: "drone", label: "Drone", words: "aerial drone camera" },
  ] },
  { id: "framing", label: "Framing", says: "How much of the person the frame holds", options: [
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
  { id: "move", label: "Move", says: "What the camera does during the shot", videoOnly: true, options: [
    { id: "static", label: "Locked off", words: "locked-off static camera" },
    { id: "push-in", label: "Push in", words: "slow push in toward the subject" },
    { id: "pull-out", label: "Pull out", words: "slow pull back revealing the scene" },
    { id: "pan-left", label: "Pan left", words: "camera pans left" },
    { id: "pan-right", label: "Pan right", words: "camera pans right" },
    { id: "tilt-up", label: "Tilt up", words: "camera tilts up" },
    { id: "tilt-down", label: "Tilt down", words: "camera tilts down" },
    { id: "crane-up", label: "Crane up", words: "crane shot rising up and over the scene" },
    { id: "orbit", label: "Orbit", words: "camera orbits around the subject" },
    { id: "handheld-follow", label: "Handheld follow", words: "handheld camera following the subject" },
    { id: "dolly-zoom", label: "Dolly zoom", words: "dolly zoom, the background stretching behind the subject" },
  ] },
  { id: "light", label: "Light", says: "Where the light comes from and what it feels like", options: [
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
  { id: "film", label: "Film", says: "The stock it looks shot on", options: [
    { id: "vision3-250d", label: "Vision3 250D", words: "Kodak Vision3 250D film stock look, natural daylight colour" },
    { id: "tungsten-500t", label: "Tungsten 500T", words: "tungsten-balanced 500T film stock look, cool shadows, warm practicals" },
    { id: "portra", label: "Portra 400", words: "Portra 400 look, soft skin tones" },
    { id: "ektachrome", label: "Ektachrome", words: "Ektachrome slide film look, saturated and crisp" },
    { id: "tri-x", label: "Tri-X black and white", words: "black and white Tri-X film look, deep contrast" },
    { id: "digital", label: "Clean digital", words: "clean modern digital look" },
    { id: "vhs", label: "VHS", words: "VHS tape look, scan lines and colour bleed" },
  ] },
  { id: "era", label: "Era", says: "The period the film looks made in", options: [
    { id: "1920s", label: "1920s", words: "looks like a 1920s silent film, black and white, soft vignette" },
    { id: "1950s", label: "1950s", words: "looks like a 1950s Technicolor film, rich saturated colour" },
    { id: "1960s", label: "1960s", words: "looks like a 1960s film, soft colour and gentle grain" },
    { id: "1970s", label: "1970s", words: "looks like a 1970s film, warm faded colour, heavy grain" },
    { id: "1980s", label: "1980s", words: "looks like a 1980s film, punchy colour, haze and neon accents" },
    { id: "1990s", label: "1990s", words: "looks like a 1990s film, muted 35mm colour" },
    { id: "2000s", label: "2000s", words: "looks like a 2000s film, early digital grade, cool greens" },
    { id: "today", label: "Today", words: "looks like a film made today, clean modern colour" },
  ] },
  { id: "look", label: "Look", says: "The genre the picture belongs to", options: [
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
  { id: "grade", label: "Grade", says: "The colours the grade follows", options: [
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

/** The rows a surface offers: a camera move only means something in a video. */
export const rowsFor = (video: boolean): LookRow[] => LOOK_ROWS.filter((r) => video || !r.videoOnly);

/** The chosen look as one sentence of plain words. A move is left out of a still. */
export function lookPhrase(choice: LookChoice, video = true): string {
  const parts: string[] = [];
  for (const row of rowsFor(video)) {
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

export function withLook(prompt: string, choice: LookChoice, video = true): string {
  const words = lookPhrase(choice, video);
  return words ? `${prompt.trim().replace(/[.\s]+$/, "")}. ${words}` : prompt;
}
