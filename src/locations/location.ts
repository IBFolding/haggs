import type { Kv } from "../story/kv";

/**
 * Locations: built from traits you can read and change, or from a picture of
 * a real place, and kept as an empty plate plus extra views from other
 * cameras. A place becomes a project's reference for every shot set there.
 */

export type Place = {
  name: string;
  setting: string;
  where: string;
  timeOfDay: string;
  weather: string;
  season: string;
  era: string;
  mood: string;
  style: string;
  details: string;
};

export type PlaceRow = { id: keyof Place & string; label: string; options: string[] };

export const PLACE_ROWS: PlaceRow[] = [
  { id: "where", label: "Inside or out", options: ["interior", "exterior"] },
  { id: "setting", label: "Kind of place", options: ["kitchen", "bedroom", "living room", "office", "bar", "restaurant", "diner", "hospital", "school", "church", "warehouse", "street", "alley", "rooftop", "park", "beach", "forest", "mountain", "desert", "farm", "harbour", "station", "spaceship corridor", "castle hall", "market"] },
  { id: "timeOfDay", label: "Time of day", options: ["dawn", "morning", "midday", "afternoon", "golden hour", "dusk", "blue hour", "night", "late night"] },
  { id: "weather", label: "Weather", options: ["clear", "overcast", "fog", "rain outside", "heavy rain", "snow", "storm clouds", "windy", "heat haze"] },
  { id: "season", label: "Season", options: ["spring", "summer", "autumn", "winter"] },
  { id: "era", label: "Era", options: ["present day", "1950s", "1970s", "1980s", "1990s", "Victorian", "medieval", "near future", "far future", "post-apocalyptic"] },
  { id: "mood", label: "Mood", options: ["warm and lived-in", "melancholy", "tense", "dreamlike", "cold and clinical", "cosy", "ominous", "joyful", "lonely", "grand"] },
];

export function blankPlace(): Place {
  return { name: "New place", setting: "kitchen", where: "interior", timeOfDay: "morning", weather: "clear", season: "autumn", era: "present day", mood: "warm and lived-in", style: "", details: "" };
}

const place = (p: Place) => `${p.where === "interior" ? "the interior of" : "the exterior of"} ${/^[aeiou]/.test(p.setting) ? "an" : "a"} ${p.setting}`;

function describe(p: Place): string {
  return [
    place(p),
    `${p.timeOfDay}`,
    p.weather === "clear" ? "" : p.weather,
    p.season,
    p.era === "present day" ? "" : p.era,
    `${p.mood} mood`,
    p.style.trim() ? `${p.style.trim()}` : "",
    p.details.trim(),
  ].filter(Boolean).join(", ");
}

/** The prompt for an empty establishing plate. With a picture, the place in it is kept and only the traits change. */
export function placePrompt(p: Place, fromPicture: boolean): string {
  const base = fromPicture ? `The place in the reference picture, keep its layout and architecture, but with these changes: ${describe(p)}.` : `A cinematic establishing shot of ${describe(p)}.`;
  return `${base} A wide, empty plate for a film: no people, no text, natural light, rich realistic detail, the look of a feature film.`;
}

/** The sentence that goes into every shot set here, so the place stays the same place. */
export function placeLock(p: Place): string {
  return `${p.name.trim() || "The place"}: ${describe(p)}. Keep this place exactly the same in every shot set here.`;
}

export type SavedPlace = { id: string; traits: Place; plate: string; views: string[]; reference: string | null; createdAt: number; updatedAt: number };
export type NewPlace = Omit<SavedPlace, "id" | "createdAt" | "updatedAt"> & Partial<Pick<SavedPlace, "id" | "createdAt">>;

const INDEX = "places/index";
const key = (id: string) => `places/${id}`;

export function createPlaceStore(kv: Kv) {
  return {
    async list(): Promise<SavedPlace[]> {
      const ids = (await kv.get<string[]>(INDEX)) ?? [];
      return (await Promise.all(ids.map((id) => kv.get<SavedPlace>(key(id))))).filter((c): c is SavedPlace => Boolean(c)).sort((a, b) => b.updatedAt - a.updatedAt);
    },
    load: (id: string) => kv.get<SavedPlace>(key(id)),
    async save(c: NewPlace): Promise<SavedPlace> {
      const ids = (await kv.get<string[]>(INDEX)) ?? [];
      const latest = Math.max(0, ...(await Promise.all(ids.map((i) => kv.get<SavedPlace>(key(i))))).map((x) => x?.updatedAt ?? 0));
      const now = Date.now();
      const saved: SavedPlace = { ...c, id: c.id ?? crypto.randomUUID(), createdAt: c.createdAt ?? now, updatedAt: Math.max(now, latest + 1) };
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
