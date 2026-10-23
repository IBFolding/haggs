import { hashPrompt, promptFor } from "../story/assemble";
import { view } from "../story/boards";
import { createProject, newShot, type Project } from "../story/model";
import type { DraftRequest } from "../writer/draft";

/**
 * Series: a topic becomes several short vertical videos — a hook line on
 * screen, then a few picture-led shots — each its own board in one project.
 * Claude writes it; pictures and clips are made afterwards, priced first.
 */

export type FormatId = "what-if" | "pov" | "story" | "influencer" | "faceless" | "did-you-know" | "top-five";
export const FORMATS: { id: FormatId; label: string; blurb: string; rules: string }[] = [
  { id: "what-if", label: "What if…", blurb: "A wild question, answered in pictures. Each video opens on the question.", rules: "Each video asks one \"What if…\" question as its hook, then shows the consequences escalating shot by shot, absurd but visual. Stylised 3D-cartoon or hyper-real pictures, bold on-screen text." },
  { id: "pov", label: "POV", blurb: "First-person moments people recognise and share.", rules: "Each video is a first-person POV moment (\"POV: …\") that plays on something relatable and a little unhinged. Handheld phone-camera feel, close faces, natural light, a clear reaction by the last shot." },
  { id: "story", label: "Story series", blurb: "One story told in parts, each ending on a reason to watch the next.", rules: "The videos are consecutive parts of one story, numbered in order. Each opens with a recap hook, moves the story, and ends on a cliffhanger. Keep the same characters and places throughout." },
  { id: "faceless", label: "Faceless channel", blurb: "A calm narrator over pictures: storytelling, history, education, kids.", rules: "Each video is a faceless-channel short: a narrator speaks over pictures and no person talks to camera. Pick the register that fits the topic (storytelling, history, education or kids). The first narration line is a curiosity hook; each later line adds one clear idea in plain spoken words; the last line lands the point or invites the next video. Narration is natural speech, about 2.5 words per second of the shot, with no stage directions." },
  { id: "did-you-know", label: "Did you know?", blurb: "One surprising fact per video, shown and said fast.", rules: "Each video delivers one genuinely surprising, true fact. The first shot's caption is the hook \"Did you know…\" finished in under 9 words; later shots show the fact and its consequence, with a short caption each. Concrete, visual and checkable; no filler. Leave narration empty." },
  { id: "top-five", label: "Top 5", blurb: "A countdown, one shot per entry, best last.", rules: "Each video is a countdown of five things on one theme: shots are numbered 5 to 1, best last, each with a caption like \"5. Name\" and a picture of that thing. The hook is the theme as a promise. Leave narration empty." },
  { id: "influencer", label: "Influencer", blurb: "One consistent person talking to camera, in different places.", rules: "One recurring influencer character speaks to camera in every video, in a different everyday place each time. Each opens on their direct hook line. Keep their look identical in every picture description." },
];

/** A starting point that fills in a whole series: the kind, the idea, the look, the voice. Faceless presets are grouped like a channel's categories. */
export type Preset = { id: string; category: string; name: string; format: FormatId; topic: string; look?: string; voice?: string; count: number };
export const PRESETS: Preset[] = [
  { id: "raven", category: "Storytelling", name: "The Raven Who Stole the Light", format: "faceless", topic: "A folk tale told simply: a raven steals the sun from a hoarding old man and scatters light across the world", look: "painted-feature", voice: "Matilda (female, american)", count: 2 },
  { id: "golden-fish", category: "Storytelling", name: "The Golden Fish", format: "faceless", topic: "The fisherman, the golden fish and the wife who asks for too much, told as a bedtime tale", look: "storybook", voice: "Will (male, american)", count: 2 },
  { id: "factory-pov", category: "History", name: "POV: a 17th-century factory worker", format: "faceless", topic: "A day in the life of a worker in a 17th-century workshop, told in second person", look: "ink-comic", voice: "Brian (male, american)", count: 2 },
  { id: "dogs", category: "History", name: "A brief history of domestic dogs", format: "faceless", topic: "How wolves became dogs: the first campfires, the first partnerships, 15,000 years in 60 seconds", look: "painted-feature", voice: "Will (male, american)", count: 2 },
  { id: "dreams", category: "Education", name: "Why do we dream?", format: "faceless", topic: "What the brain is doing while we dream, and the theories for why", look: "storybook", voice: "Matilda (female, american)", count: 3 },
  { id: "jellyfish", category: "Education", name: "The immortal jellyfish", format: "faceless", topic: "The jellyfish that can reset its own life cycle, and what scientists are learning from it", look: "stylised-3d", voice: "Will (male, american)", count: 2 },
  { id: "counting", category: "Kids", name: "Counting to five", format: "faceless", topic: "A gentle counting song-story for toddlers: one ladybird to five ducklings, bright and simple", look: "painted-feature", voice: "Lily (female, british)", count: 2 },
  { id: "what-if-eat", category: "Trending", name: "What if you could eat endlessly?", format: "what-if", topic: "Strange things that would happen if a human never stopped being hungry", look: "stylised-3d", count: 3 },
  { id: "what-if-sleep", category: "Trending", name: "What if you never slept?", format: "what-if", topic: "What happens to a body and a city if nobody ever needed sleep", look: "stylised-3d", count: 3 },
  { id: "pov-late", category: "Trending", name: "POV: you're always five minutes late", format: "pov", topic: "Relatable moments of someone who is always five minutes late and has an excuse for each", count: 3 },
  { id: "dyk-ocean", category: "Trending", name: "Did you know: the ocean", format: "did-you-know", topic: "Surprising true facts about the deep ocean", look: "stylised-3d", count: 3 },
  { id: "top5-animals", category: "Trending", name: "Top 5 strangest animals", format: "top-five", topic: "The five strangest animals alive, best last", look: "painted-feature", count: 2 },
  { id: "story-lighthouse", category: "Trending", name: "The lighthouse keeper, in parts", format: "story", topic: "A lonely lighthouse keeper finds a message in a bottle that answers a letter he hasn't written yet", look: "painted-feature", count: 4 },
];
export const presetById = (id: string) => PRESETS.find((p) => p.id === id);

const str = { type: "string" } as const;
const obj = (properties: Record<string, unknown>) => ({ type: "object", properties, required: Object.keys(properties), additionalProperties: false });
export const SERIES_SCHEMA = obj({
  title: str,
  episodes: { type: "array", items: obj({ hook: str, shots: { type: "array", items: obj({ picture: str, seconds: { type: "number" }, caption: str, narration: str }) } }) },
});

export type Series = { title: string; episodes: { hook: string; shots: { picture: string; seconds: number; caption: string; narration: string }[] }[] };

export function seriesRequest(format: FormatId, topic: string, count: number): DraftRequest {
  const f = FORMATS.find((x) => x.id === format);
  if (!f) throw new Error("Pick a format for the series.");
  if (!topic.trim()) throw new Error("Say what the series is about: a topic or a theme.");
  if (!Number.isInteger(count) || count < 1 || count > 8) throw new Error("A series is 1–8 videos.");
  return {
    system: `You write series of short vertical social videos (9:16, 12–20 seconds each) for a film studio that turns each shot into a still picture and then a 4-second clip. ${f.rules}\nEach video has 3 to 5 shots of 3 to 5 seconds. For every shot, "picture" describes exactly what the camera sees, concretely and visually, ready to give a picture model: subject, place, light, framing, and the same character details every time a character returns. "caption" is the short on-screen text for that shot (under 80 characters, may be empty). "narration" is the line a narrator speaks over that shot; leave it empty unless the format uses a narrator. Never put text, logos or words inside the pictures themselves. Keep each video's hook under 90 characters.`,
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
          narration: String((s as { narration?: unknown })?.narration ?? "").trim().slice(0, 400),
        })),
      };
    }),
  };
}

export type SeriesLook = { /** The style's words, e.g. "cel-shaded 2D anime". */ look?: string; /** Who stays the same person in every picture. */ lock?: string };

/** What a picture model is told: the shot, the same person, the look, and the frame. */
export function pictureWords(picture: string, { look, lock }: SeriesLook): string {
  return [picture.trim().replace(/[.\s]+$/, "") + ".", lock?.trim() ? `${lock.trim().replace(/[.\s]+$/, "")}. Keep this person exactly the same.` : "", look?.trim() ? `Drawn as ${look.trim()}.` : "", "Vertical 9:16, no text, no watermark."].filter(Boolean).join(" ");
}

/**
 * One project: a vertical board per episode, a shot per picture. Pictures made
 * on the page (keyed "episode.shot") arrive on their shots; the rest are made
 * later, priced on the board.
 */
export function buildSeries(series: Series, format: FormatId, opts: SeriesLook & { refs?: string[]; pictures?: Record<string, string>; clips?: Record<string, string>; voice?: string; narrationUrls?: Record<string, string> } = {}): Project {
  const base = createProject(series.title);
  const boards = series.episodes.map((e, i) => ({
    id: crypto.randomUUID(),
    name: `${i + 1} · ${e.hook || `Video ${i + 1}`}`.slice(0, 80),
    kind: "episode" as const,
    aspect: "9:16" as const,
    notes: [],
    shots: e.shots.map((s, k) => ({
      ...newShot(),
      heading: "",
      ...(s.narration ? { voices: [{ id: crypto.randomUUID(), text: s.narration, speaker: "NARRATOR", voice: opts.voice ?? "Matilda (female, american)", offset: 0.2, ...(opts.narrationUrls?.[`${i}.${k}`] ? { url: opts.narrationUrls[`${i}.${k}`]! } : {}) }] } : {}),
      beat: opts.look || opts.lock ? pictureWords(s.picture, opts) : s.picture,
      seconds: s.seconds,
      ...(s.caption ? { caption: s.caption } : {}),
      ...(opts.refs?.length ? { refs: [...opts.refs] } : {}),
      model: { id: "minimax/minimax-h3", settings: { resolution: "768P", ratio: "9:16" } },
    })),
  }));
  let project: Project = { ...base, boards, source: { templateId: `series-${format}`, name: series.title } };
  // Attach the pictures last, hashed against the prompt the board now produces, so none of them reads as stale.
  const pictures = opts.pictures ?? {};
  const clips = opts.clips ?? {};
  if (Object.keys(pictures).length || Object.keys(clips).length) {
    project = {
      ...project,
      boards: project.boards!.map((b, e) => {
        const seen = view(project, b.id);
        return { ...b, shots: b.shots.map((sh, s) => (clips[`${e}.${s}`] || pictures[`${e}.${s}`] ? { ...sh, render: { url: (clips[`${e}.${s}`] ?? pictures[`${e}.${s}`])!, kind: clips[`${e}.${s}`] ? ("video" as const) : ("image" as const), usd: null, promptHash: hashPrompt(promptFor(seen, s)), at: Date.now() } } : sh)) };
      }),
    };
  }
  return project;
}
