import { createProject, newShot, type Project } from "../story/model";
import type { DraftRequest } from "../writer/draft";

/**
 * Series: a topic becomes several short vertical videos — a hook line on
 * screen, then a few picture-led shots — each its own board in one project.
 * Claude writes it; pictures and clips are made afterwards, priced first.
 */

export type FormatId = "what-if" | "pov" | "story" | "influencer";
export const FORMATS: { id: FormatId; label: string; blurb: string; rules: string }[] = [
  { id: "what-if", label: "What if…", blurb: "A wild question, answered in pictures. Each video opens on the question.", rules: "Each video asks one \"What if…\" question as its hook, then shows the consequences escalating shot by shot, absurd but visual. Stylised 3D-cartoon or hyper-real pictures, bold on-screen text." },
  { id: "pov", label: "POV", blurb: "First-person moments people recognise and share.", rules: "Each video is a first-person POV moment (\"POV: …\") that plays on something relatable and a little unhinged. Handheld phone-camera feel, close faces, natural light, a clear reaction by the last shot." },
  { id: "story", label: "Story series", blurb: "One story told in parts, each ending on a reason to watch the next.", rules: "The videos are consecutive parts of one story, numbered in order. Each opens with a recap hook, moves the story, and ends on a cliffhanger. Keep the same characters and places throughout." },
  { id: "influencer", label: "Influencer", blurb: "One consistent person talking to camera, in different places.", rules: "One recurring influencer character speaks to camera in every video, in a different everyday place each time. Each opens on their direct hook line. Keep their look identical in every picture description." },
];

const str = { type: "string" } as const;
const obj = (properties: Record<string, unknown>) => ({ type: "object", properties, required: Object.keys(properties), additionalProperties: false });
export const SERIES_SCHEMA = obj({
  title: str,
  episodes: { type: "array", items: obj({ hook: str, shots: { type: "array", items: obj({ picture: str, seconds: { type: "number" }, caption: str }) } }) },
});

export type Series = { title: string; episodes: { hook: string; shots: { picture: string; seconds: number; caption: string }[] }[] };

export function seriesRequest(format: FormatId, topic: string, count: number): DraftRequest {
  const f = FORMATS.find((x) => x.id === format);
  if (!f) throw new Error("Pick a format for the series.");
  if (!topic.trim()) throw new Error("Say what the series is about: a topic or a theme.");
  if (!Number.isInteger(count) || count < 1 || count > 8) throw new Error("A series is 1–8 videos.");
  return {
    system: `You write series of short vertical social videos (9:16, 12–20 seconds each) for a film studio that turns each shot into a still picture and then a 4-second clip. ${f.rules}\nEach video has 3 to 5 shots of 3 to 5 seconds. For every shot, "picture" describes exactly what the camera sees, concretely and visually, ready to give a picture model: subject, place, light, framing, and the same character details every time a character returns. "caption" is the short on-screen text for that shot (under 80 characters, may be empty). Never put text, logos or words inside the pictures themselves. Keep each video's hook under 90 characters.`,
    user: `Format: ${f.label}. Topic: ${topic.trim()}. Write ${count} video${count === 1 ? "" : "s"}, ${count} in all (${count} videos), and a title for the series.`,
    maxTokens: 8000,
  };
}

export function validateSeries(raw: unknown): Series {
  const r = raw as Partial<Series> | null;
  if (!r || !Array.isArray(r.episodes) || !r.episodes.length) throw new Error("The writer's reply had no episodes.");
  return {
    title: String(r.title ?? "Series").trim().slice(0, 80) || "Series",
    episodes: r.episodes.slice(0, 8).map((e, i) => {
      if (!Array.isArray(e?.shots) || !e.shots.length) throw new Error(`Episode ${i + 1} came back with no shot.`);
      return {
        hook: String(e.hook ?? "").trim().slice(0, 120),
        shots: e.shots.slice(0, 6).map((s) => ({
          picture: String(s?.picture ?? "").trim().slice(0, 1200),
          seconds: Math.min(5, Math.max(3, Math.round(Number(s?.seconds) || 4))),
          caption: String(s?.caption ?? "").trim().slice(0, 120),
        })),
      };
    }),
  };
}

/** One project: a vertical board per episode, a shot per picture. No pictures yet; making them costs money. */
export function buildSeries(series: Series, format: FormatId): Project {
  const base = createProject(series.title);
  const boards = series.episodes.map((e, i) => ({
    id: crypto.randomUUID(),
    name: `${i + 1} · ${e.hook || `Video ${i + 1}`}`.slice(0, 80),
    kind: "episode" as const,
    aspect: "9:16" as const,
    notes: [],
    shots: e.shots.map((s) => ({
      ...newShot(),
      heading: "",
      beat: s.picture,
      seconds: s.seconds,
      ...(s.caption ? { caption: s.caption } : {}),
      model: { id: "minimax/minimax-h3", settings: { resolution: "768P", ratio: "9:16" } },
    })),
  }));
  return { ...base, boards, source: { templateId: `series-${format}`, name: series.title } };
}
