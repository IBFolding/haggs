import type { Kv } from "../story/kv";

/**
 * Characters: built from traits you can read and change, optionally from
 * photos of a real likeness, and kept as a sheet (front, three-quarter and
 * profile). A character is then a face for a project's sheets, a reference
 * for any workflow, and the person to swap into a video.
 */

export type Traits = {
  name: string;
  age: number;
  gender: string;
  build: string;
  height: string;
  skin: string;
  hairStyle: string;
  hairLength: string;
  hairColor: string;
  eyes: string;
  face: string;
  facialHair: string;
  glasses: string;
  wardrobe: string;
  marks: string;
  look: string;
};

export type TraitRow = { id: keyof Traits & string; label: string; options: string[]; group: "who" | "body" | "face" | "style" };

export const TRAIT_ROWS: TraitRow[] = [
  { id: "gender", label: "Presents as", options: ["woman", "man", "non-binary person", "girl", "boy"], group: "who" },
  { id: "build", label: "Build", options: ["very slim", "slim", "athletic", "average", "broad", "stocky", "heavy", "very heavy"], group: "body" },
  { id: "height", label: "Height", options: ["short", "below average height", "average height", "tall", "very tall"], group: "body" },
  { id: "skin", label: "Skin", options: ["very fair", "fair", "light olive", "medium olive", "tan", "brown", "dark brown", "deep"], group: "body" },
  { id: "hairStyle", label: "Hair", options: ["straight", "wavy", "curly", "coily", "braided", "buzzed", "bald", "ponytail", "bun", "afro"], group: "face" },
  { id: "hairLength", label: "Length", options: ["very short", "short", "chin-length", "shoulder-length", "long", "very long"], group: "face" },
  { id: "hairColor", label: "Hair colour", options: ["black", "dark brown", "brown", "auburn", "red", "ginger", "blonde", "platinum", "grey", "silver", "white", "blue", "pink"], group: "face" },
  { id: "eyes", label: "Eyes", options: ["dark brown", "brown", "hazel", "green", "blue", "grey", "amber"], group: "face" },
  { id: "face", label: "Face shape", options: ["oval", "round", "square", "heart-shaped", "long", "angular"], group: "face" },
  { id: "facialHair", label: "Facial hair", options: ["none", "stubble", "short beard", "full beard", "moustache", "goatee"], group: "face" },
  { id: "glasses", label: "Glasses", options: ["none", "round wire-rim", "thick black frames", "aviator", "cat-eye", "rimless"], group: "face" },
  { id: "look", label: "Rendered as", options: ["photoreal", "cinematic film still", "stylised 3D", "illustrated", "anime"], group: "style" },
];

export function blank(): Traits {
  return { name: "New character", age: 30, gender: "woman", build: "average", height: "average height", skin: "light olive", hairStyle: "wavy", hairLength: "shoulder-length", hairColor: "dark brown", eyes: "brown", face: "oval", facialHair: "none", glasses: "none", wardrobe: "a plain grey t-shirt and dark jeans", marks: "", look: "photoreal" };
}

const none = (v: string) => !v.trim() || v === "none";

/** The person in plain words, as the sheet prompt and the identity lock both use them. */
function describe(t: Traits): string {
  const hair = t.hairStyle === "bald" ? "a shaved head" : `${t.hairColor} ${t.hairStyle} ${t.hairLength} hair`;
  const parts = [
    `a ${t.age}-year-old ${t.gender}`,
    `${t.build} build, ${t.height}`,
    `${t.skin} skin`,
    hair,
    `${t.eyes} eyes`,
    `a ${t.face} face`,
    none(t.facialHair) ? "" : t.facialHair,
    none(t.glasses) ? "" : `${t.glasses} glasses`,
    t.marks.trim(),
  ];
  return parts.filter(Boolean).join(", ");
}

/** The prompt for the character sheet. With a likeness, the photos decide the face and the traits change everything else. */
export function characterPrompt(t: Traits, likeness: boolean): string {
  const who = likeness
    ? `The person in the reference photos, keep their face and identity exactly as in the photos, but with these changes: ${describe(t)}.`
    : `${describe(t)}.`;
  const style = t.look === "photoreal" ? "Photorealistic" : t.look === "cinematic film still" ? "Cinematic film still" : t.look === "stylised 3D" ? "Stylised 3D render" : t.look === "illustrated" ? "Illustrated" : "Anime style";
  return `Character reference sheet. ${style}. ${who} Wearing ${t.wardrobe.trim() || "a plain grey t-shirt and dark jeans"}. Three full-body views side by side on a plain grey background: front, three-quarter and profile, standing relaxed, identical person, outfit and proportions in every view, even soft studio light, no text.`;
}

/** The sentence that goes into every shot the character is in, so they stay the same person. */
export function identityLock(t: Traits): string {
  return `${t.name.trim() || "The character"}: ${describe(t)}; wearing ${t.wardrobe.trim() || "plain clothes"}. Keep this person exactly the same in every shot.`;
}

const LABEL: Record<string, string> = { age: "age", gender: "presents as", build: "build", height: "height", skin: "skin", hairStyle: "hair", hairLength: "hair length", hairColor: "hair colour", eyes: "eyes", face: "face shape", facialHair: "facial hair", glasses: "glasses", wardrobe: "wardrobe", marks: "marks", look: "rendered as" };

/** What changed between two versions, as a note: "hair colour: silver, build: heavy". */
export function changeNote(before: Traits, after: Traits): string {
  return (Object.keys(LABEL) as (keyof Traits)[]).filter((k) => before[k] !== after[k]).map((k) => `${LABEL[k]}: ${String(after[k]) || "none"}`).join(", ");
}

/** `words` is a hand-written description that stands in for the traits when a character came from a picture or a sheet rather than the builder. */
export type Character = { id: string; traits: Traits; sheet: string; likeness: string[]; words?: string; createdAt: number; updatedAt: number };
export type NewCharacter = Omit<Character, "id" | "createdAt" | "updatedAt"> & Partial<Pick<Character, "id" | "createdAt">>;

const INDEX = "characters/index";
const key = (id: string) => `characters/${id}`;

export function createCharacterStore(kv: Kv) {
  return {
    async list(): Promise<Character[]> {
      const ids = (await kv.get<string[]>(INDEX)) ?? [];
      return (await Promise.all(ids.map((id) => kv.get<Character>(key(id))))).filter((c): c is Character => Boolean(c)).sort((a, b) => b.updatedAt - a.updatedAt);
    },
    load: (id: string) => kv.get<Character>(key(id)),
    async save(c: NewCharacter): Promise<Character> {
      const ids = (await kv.get<string[]>(INDEX)) ?? [];
      const latest = Math.max(0, ...(await Promise.all(ids.map((i) => kv.get<Character>(key(i))))).map((x) => x?.updatedAt ?? 0));
      const now = Date.now();
      const saved: Character = { ...c, id: c.id ?? crypto.randomUUID(), createdAt: c.createdAt ?? now, updatedAt: Math.max(now, latest + 1) };
      await kv.set(key(saved.id), saved);
      if (!ids.includes(saved.id)) await kv.set(INDEX, [...ids, saved.id]);
      return saved;
    },
    async remove(id: string) {
      await kv.remove(key(id));
      await kv.set(INDEX, ((await kv.get<string[]>(INDEX)) ?? []).filter((x) => x !== id));
    },
  };
}
