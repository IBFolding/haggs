/**
 * The checks behind the Academy's practice labs. Each lab is free and runs in
 * the page; these are the rules it judges your attempt by, kept apart from the
 * drawing so they can be tested.
 */

/* Lesson 2: say it like a director */

const LIGHT = /\b(light|lit|sun|sunlight|golden|dusk|dawn|night|neon|shadow|backlit|overcast|window|lamp|glow|candle|fluorescent|moonlight|haze|rain)\b/i;
const CAMERA = /\b(push-in|push in|pull-out|dolly|pan|tilt|orbit|tracking|handheld|static|locked|zoom|crane|drone|close-up|close up|wide|low angle|high angle|over-the-shoulder|slow|steady)\b/i;
const PLACE = /\b(in|on|at|inside|outside|beside|under|over|across|along|through)\s+(a|an|the|her|his|their)\b/i;
const VAGUE = /\b(nice|cool|beautiful|amazing|epic|awesome|good|great|stunning|cinematic)\b/gi;

export type PromptScore = { score: number; has: { subject: boolean; place: boolean; light: boolean; camera: boolean }; tips: string[] };

/** How well a prompt names the four things a shot needs: who or what, where, the light, and the camera. */
export function scorePrompt(text: string): PromptScore {
  const t = text.trim();
  const words = t.split(/\s+/).filter(Boolean);
  const has = {
    subject: words.length >= 4,
    place: PLACE.test(t),
    light: LIGHT.test(t),
    camera: CAMERA.test(t),
  };
  const vague = (t.match(VAGUE) ?? []).length;
  let score = (has.subject ? 25 : 0) + (has.place ? 25 : 0) + (has.light ? 25 : 0) + (has.camera ? 25 : 0);
  score = Math.max(0, score - Math.min(20, vague * 10));
  if (words.length > 70) score = Math.max(0, score - 15);
  const tips: string[] = [];
  if (!has.subject) tips.push("Say who or what is in the shot, and what they are doing.");
  if (!has.place) tips.push("Say where it is: “in a …”, “on a …”.");
  if (!has.light) tips.push("Say what the light is doing: golden dusk, hard noon sun, a lamp.");
  if (!has.camera) tips.push("Say how the camera moves, or that it doesn’t: slow push-in, locked-off.");
  if (vague) tips.push("Swap words like “beautiful” or “epic” for things the camera could see.");
  if (words.length > 70) tips.push("Shorter is stronger. Keep it to a couple of sentences.");
  return { score, has, tips };
}

/* Lesson 1: pick the move that fits the mood */

export const MOVES = [
  { id: "push", name: "Slow push-in", says: "Closer to the person, closer to what they feel." },
  { id: "pull", name: "Pull-out", says: "Away from them: loneliness, or the bigger picture." },
  { id: "pan", name: "Pan across", says: "Follows the eye from one thing to the next." },
  { id: "orbit", name: "Orbit", says: "Circles the subject, so a product or person feels important." },
  { id: "still", name: "Locked-off", says: "Nothing moves but the subject. Calm, or tense." },
] as const;
export type MoveId = (typeof MOVES)[number]["id"];

export const MOODS: { id: string; scene: string; best: MoveId[]; why: string }[] = [
  { id: "quiet", scene: "A woman reads a letter alone, and slowly understands it.", best: ["push"], why: "Pushing in lets us watch her face change." },
  { id: "product", scene: "A new watch on a turntable, for an ad.", best: ["orbit"], why: "An orbit shows every side and makes it feel precious." },
  { id: "lonely", scene: "A man sits on an empty platform after the last train.", best: ["pull", "still"], why: "Moving away, or holding still, makes the space feel big." },
];

export const moodRight = (moodId: string, move: MoveId) => MOODS.find((m) => m.id === moodId)?.best.includes(move) ?? false;

/* Lesson 3: move the camera */

export type Angle = { name: string; at: string };
/** Where the camera is, as an angle round the subject (0 = in front) and how close (0 = tight, 1 = far). */
export function angleName(deg: number, distance: number): Angle {
  const a = ((Math.round(deg) % 360) + 360) % 360;
  const close = distance < 0.35;
  const far = distance > 0.7;
  const side = a <= 25 || a >= 335 ? "front" : a >= 155 && a <= 205 ? "behind" : a < 180 ? "right" : "left";
  if (side === "behind") return { name: far ? "Wide from behind" : close ? "Close over the shoulder" : "Reverse", at: "behind" };
  if (side === "front") return { name: close ? "Close-up" : far ? "Wide shot" : "Medium shot", at: "front" };
  return { name: close ? "Close profile" : far ? "Wide from the side" : "Profile", at: side };
}

/* Lesson 4: the same person every time */

export const TRAITS = [
  { id: "hair", label: "Hair", options: ["short grey wavy", "long dark braid", "shaved", "red curls"] },
  { id: "face", label: "Face", options: ["square jaw, short beard", "round, freckled", "angular, clean-shaven", "soft, high cheekbones"] },
  { id: "eyes", label: "Eyes", options: ["hazel", "dark brown", "pale blue", "green"] },
  { id: "age", label: "Age", options: ["twenties", "forties", "fifties", "seventies"] },
  { id: "wear", label: "Always wears", options: ["a worn plaid flannel", "a camel overcoat", "a green parka", "a white linen shirt"] },
  { id: "mark", label: "One mark", options: ["a scar through the eyebrow", "a silver chain", "ink on the left hand", "round glasses"] },
] as const;

export function characterLine(name: string, picks: Record<string, string>): string {
  const bits = TRAITS.map((t) => picks[t.id]).filter(Boolean);
  return `${name.trim() || "The character"}: ${bits.join(", ")}. Keep this person exactly the same in every shot.`;
}
export const locked = (picks: Record<string, string>) => TRAITS.filter((t) => picks[t.id]).length >= 5;

/* Lesson 5: a place you can walk around */

/** Which side of the place you are looking from, from 0–360. */
export const sideOf = (deg: number): "front" | "right" | "back" | "left" => {
  const a = ((Math.round(deg) % 360) + 360) % 360;
  return a < 45 || a >= 315 ? "front" : a < 135 ? "right" : a < 225 ? "back" : "left";
};

/* Lesson 6: a series in an afternoon */

export function hooks(topic: string): string[] {
  const t = topic.trim().replace(/[.!?]+$/, "") || "the thing nobody tells you";
  return [`Nobody tells you this about ${t}.`, `I tried ${t} for a week. Here is what happened.`, `Stop doing ${t} the way everyone does it.`, `The first 3 seconds of ${t}, explained.`, `What if ${t} was the other way round?`];
}

/* Lesson 7: cut it, sound it, render it */

export type Mix = { voice: number; music: number; fx: number };
/** Levels in dB. Speech has to sit clearly over the music, and effects under the voice. */
export function mixCheck(m: Mix): { ok: boolean; notes: string[] } {
  const notes: string[] = [];
  const gap = m.voice - m.music;
  if (gap < 6) notes.push("The voice is too close to the music. Bring the music down, or the voice up, so the words are never fought for.");
  if (gap > 18) notes.push("The music has almost disappeared. A film’s music should still be felt.");
  if (m.fx > m.voice) notes.push("An effect is louder than the voice. Keep effects under the words.");
  if (m.voice > -3) notes.push("The voice is near the top. Leave some room so nothing clips.");
  return { ok: notes.length === 0, notes };
}
