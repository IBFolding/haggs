import type { Effect, Music, Project, Shot, Sound } from "./model";

/**
 * The cut: the board's shots, in story order, laid end to end.
 *
 * It is derived from the project every time rather than stored, for the same
 * reason prompts are. Reorder the board and the cut is reordered; there is no
 * second arrangement to keep in step with the first.
 */

export const DEFAULT_IMAGE_SECONDS = 3;
export const DEFAULT_VIDEO_SECONDS = 5;

export type Clip = {
  shotId: string;
  index: number;
  heading: string;
  url: string;
  kind: "image" | "video";
  /** Seconds from the start of the cut. */
  start: number;
  /** Seconds into the footage where this clip begins. */
  from: number;
  seconds: number;
  /** Words burned into the picture while this clip is on screen. */
  caption?: string;
  /** Seconds to fade in from, and out to, black (picture and its own sound). */
  fadeIn?: number;
  fadeOut?: number;
};

/** A spoken line placed on the cut's clock. */
export type Voice = { shotId: string; id: string; url: string; text: string; start: number; gain: number };

export type Cut = {
  clips: Clip[];
  total: number;
  voices: Voice[];
  music: Music | null;
  /** How the voices sit in the mix. */
  sound?: Sound;
  /** Sound effects on their own track. */
  effects?: Effect[];
  /** The shape every clip is fitted to. */
  aspect: "16:9" | "9:16";
  /** Shots with nothing to show yet, so a gap in the cut is never a surprise. */
  skipped: string[];
};

function positive(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * Providers disagree on how a duration is written — Kling takes "5", Veo takes
 * "8s", MiniMax takes the number — but they all mean seconds.
 */
function fromSetting(value: unknown): number | null {
  if (typeof value === "number") return positive(value);
  if (typeof value === "string") return positive(Number.parseFloat(value));
  return null;
}

/**
 * How long a shot holds on screen. An explicit duration wins. Otherwise a video
 * runs for the length its model was asked for, and a still holds for a default.
 * A zero or negative duration is ignored: it would make a clip that cannot play.
 */
export function clipSeconds(shot: Shot): number {
  const explicit = positive(shot.seconds);
  if (explicit !== null) return explicit;

  if (shot.render?.kind === "video") {
    return fromSetting(shot.model.settings.duration) ?? DEFAULT_VIDEO_SECONDS;
  }
  return DEFAULT_IMAGE_SECONDS;
}

export function buildCut(project: Project): Cut {
  const clips: Clip[] = [];
  const skipped: string[] = [];
  const voices: Voice[] = [];
  let cursor = 0;

  for (const shot of project.shots) {
    if (!shot.render) {
      skipped.push(shot.id);
      continue;
    }
    const seconds = clipSeconds(shot);
    clips.push({
      shotId: shot.id,
      index: clips.length,
      // A shot with no scene heading is named by its beat, without any spoken line on it.
      heading: shot.heading || shot.beat.split(" — ")[0]!.slice(0, 80),
      url: shot.render.url,
      kind: shot.render.kind,
      start: cursor,
      from: positive(shot.trimIn) ?? 0,
      seconds,
      ...(shot.caption?.trim() ? { caption: shot.caption.trim() } : {}),
      ...(positive(shot.fadeIn) ? { fadeIn: shot.fadeIn! } : {}),
      ...(positive(shot.fadeOut) ? { fadeOut: shot.fadeOut! } : {}),
    });
    for (const line of shot.voices ?? []) {
      // A line that hasn't been spoken yet has nothing to play.
      if (line.url) voices.push({ shotId: shot.id, id: line.id, url: line.url, text: line.text, start: Math.round((cursor + Math.max(0, line.offset)) * 1000) / 1000, gain: line.gain ?? 0 });
    }
    cursor += seconds;
  }

  return { clips, total: cursor, skipped, voices, music: project.music ?? null, ...(project.sound ? { sound: project.sound } : {}), ...(project.effects?.length ? { effects: project.effects } : {}), aspect: project.aspect ?? "16:9" };
}

/**
 * What is on screen at time `t`, and how far into it. Past the end it holds the
 * last frame rather than returning nothing, so a scrubber dragged to the edge
 * still shows a picture.
 */
export function atTime(cut: Cut, t: number): { clip: Clip; offset: number } | null {
  const last = cut.clips[cut.clips.length - 1];
  if (!last) return null;

  const time = Math.max(0, t);
  if (time >= cut.total) return { clip: last, offset: last.seconds };

  const clip = cut.clips.find((c) => time >= c.start && time < c.start + c.seconds) ?? last;
  return { clip, offset: time - clip.start };
}

/** A readable record of the cut — what is in it, in what order, for how long. */
export function cutList(cut: Cut, name: string): string {
  return JSON.stringify(
    {
      format: "haggs.cut/1",
      name,
      total: cut.total,
      clips: cut.clips.map((clip) => ({
        order: clip.index + 1,
        heading: clip.heading,
        kind: clip.kind,
        start: clip.start,
        seconds: clip.seconds,
        url: clip.url,
      })),
    },
    null,
    2,
  );
}

/** Wraps a value in single quotes so a shell treats it as one inert word. */
function sh(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

/** Keeps a project name usable as a filename and inert in a shell. */
function slug(name: string): string {
  return name.replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "") || "cut";
}

/**
 * A shell script that fetches each clip and joins them with ffmpeg.
 *
 * Every clip is first normalised to the same size, frame rate and audio layout,
 * because the concat step refuses clips that disagree. A still gets a silent
 * track and a video keeps its own sound, which the script detects per file
 * rather than assuming, since not every model produces audio.
 *
 * URLs and the project name go into a shell script, so both are quoted rather
 * than interpolated.
 */
/**
 * The sound mix as one ffmpeg filter graph over the joined picture (input 0,
 * with the clips' own sound), each voice line (inputs 1…n) and the
 * soundtrack (the last input). Voices are delayed to their places; the
 * soundtrack is trimmed to the cut, faded out, and pressed down by the
 * voices so every line is heard over it. Null when there is nothing to mix.
 */
/** The treatment that makes synthetic voices sit in a film: warmth, a little air, levelled, in a room, and the music ducking under them. */
export const BLEND: Sound = { room: 0.3, warmth: 2, clarity: -1, squeeze: 0.5, duck: 0.7 };

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Number.isFinite(n) ? n : 0));

/** One voice line's filter chain, from the cut's sound settings. */
function voiceChain(sound: Sound | undefined): string[] {
  if (!sound) return [];
  const out: string[] = [];
  const { room, warmth, clarity, squeeze } = sound;
  if (warmth || clarity || squeeze || room) out.push("highpass=f=80");
  if (warmth) out.push(`equalizer=f=200:t=h:w=200:g=${clamp(warmth, -6, 6)}`);
  if (clarity) out.push(`equalizer=f=3500:t=q:w=1.2:g=${clamp(clarity, -6, 6)}`);
  if (clarity !== undefined && clarity <= 0 && (warmth || squeeze || room)) out.push("equalizer=f=7500:t=q:w=2:g=-3");
  if (squeeze) out.push(`acompressor=threshold=${Math.round(-18 - 6 * clamp(squeeze, 0, 1))}dB:ratio=${(2 + 4 * clamp(squeeze, 0, 1)).toFixed(1)}:attack=8:release=160:makeup=${Math.round(2 + 4 * clamp(squeeze, 0, 1))}`);
  if (room) {
    // Dense taps under ~60ms read as the air of a room, never as an echo.
    const r = clamp(room, 0, 1);
    const taps = [11, 17, 23, 29, 37, 43, 53, 61];
    const decays = [0.35, 0.3, 0.28, 0.25, 0.2, 0.18, 0.15, 0.12];
    out.push(`aecho=0.85:0.75:${taps.map((t) => Math.round(t * (0.6 + 0.4 * r))).join("|")}:${decays.map((d) => (d * (0.3 + 0.7 * r)).toFixed(2)).join("|")}`);
  }
  return out;
}

export function mixFilter(cut: Cut): { inputs: string[]; filter: string } | null {
  const sound = cut.sound;
  const voices = sound?.voiceMute ? [] : cut.voices;
  const effects = sound?.fxMute ? [] : (cut.effects ?? []);
  const music = sound?.musicMute ? null : cut.music;
  if (!voices.length && !effects.length && !music) return null;
  const parts: string[] = [];
  const inputs: string[] = [];
  const voiceTrim = sound?.voiceGain ?? 0;
  voices.forEach((v, i) => {
    inputs.push(v.url);
    const ms = Math.round(v.start * 1000);
    parts.push(`[${inputs.length}:a]${["aresample=48000", ...voiceChain(sound), `adelay=${ms}|${ms}`, `volume=${v.gain + voiceTrim}dB`].join(",")}[v${i}]`);
  });
  const vo = voices.length > 1 ? (parts.push(`${voices.map((_, i) => `[v${i}]`).join("")}amix=inputs=${voices.length}:normalize=0[vo]`), "[vo]") : voices.length ? "[v0]" : null;
  const fxTrim = sound?.fxGain ?? 0;
  effects.forEach((e, i) => {
    inputs.push(e.url);
    const ms = Math.round(e.start * 1000);
    parts.push(`[${inputs.length}:a]aresample=48000,adelay=${ms}|${ms},volume=${e.gain + fxTrim}dB[fx${i}]`);
  });
  const fx = effects.length > 1 ? (parts.push(`${effects.map((_, i) => `[fx${i}]`).join("")}amix=inputs=${effects.length}:normalize=0[fx]`), "[fx]") : effects.length ? "[fx0]" : null;
  let bed: string | null = null;
  if (music) {
    inputs.push(music.url);
    const fade = Math.max(0, cut.total - 2);
    parts.push(`[${inputs.length}:a]aresample=48000,atrim=0:${cut.total},volume=${music.gain}dB,afade=t=out:st=${fade}:d=2[mus]`);
    if (vo && sound?.duck !== 0) {
      parts.push(`${vo}asplit[vo1][vo2]`, `[mus][vo1]sidechaincompress=threshold=0.04:ratio=${Math.round(4 + 8 * clamp(sound?.duck ?? 0.5, 0, 1))}:attack=20:release=450[bed]`);
      bed = "[bed]";
    } else bed = "[mus]";
  }
  const voice = vo && bed === "[bed]" ? "[vo2]" : vo;
  // The clips' own sound is the video track: it has a level and a mute like the others.
  const clipLevel = sound?.clipMute ? "0" : sound?.clipGain ? `${sound.clipGain}dB` : null;
  if (clipLevel) parts.push(`[0:a]volume=${clipLevel}[clip]`);
  const layers = [clipLevel ? "[clip]" : "[0:a]", bed, voice, fx].filter(Boolean) as string[];
  parts.push(`${layers.join("")}amix=inputs=${layers.length}:normalize=0:duration=first${sound?.loud ? "[pre];[pre]acompressor=threshold=-20dB:ratio=1.8:attack=30:release=250:makeup=1,loudnorm=I=-16:TP=-1.5:LRA=11" : ""}[mix]`);
  return { inputs, filter: parts.join(";") };
}

/**
 * Captions as overlays on the joined picture: one transparent frame-sized PNG
 * per captioned clip (input 1…n), each shown only while its clip plays. Null
 * when no clip has a caption.
 */
export function captionFilter(cut: Cut): { captions: { text: string; index: number }[]; filter: string } | null {
  const captions = cut.clips.filter((c) => c.caption).map((c) => ({ text: c.caption!, index: c.index }));
  if (!captions.length) return null;
  let last = "0:v";
  const parts = cut.clips.filter((c) => c.caption).map((c, i) => {
    const out = i === captions.length - 1 ? "out" : `c${i}`;
    const part = `[${last}][${i + 1}:v]overlay=0:0:enable='between(t,${c.start},${Math.round((c.start + c.seconds) * 1000) / 1000})'[${out}]`;
    last = out;
    return part;
  });
  return { captions, filter: parts.join(";") };
}

/** The picture and sound filters for a clip's fades. A fade never runs longer than half the clip. */
export function fadeFilters(clip: Pick<Clip, "seconds" | "fadeIn" | "fadeOut">): { v: string; a: string } {
  const cap = Math.max(0.05, clip.seconds / 2);
  const inn = clip.fadeIn && clip.fadeIn > 0 ? Math.round(Math.min(clip.fadeIn, cap) * 100) / 100 : 0;
  const out = clip.fadeOut && clip.fadeOut > 0 ? Math.round(Math.min(clip.fadeOut, cap) * 100) / 100 : 0;
  const v: string[] = [];
  const a: string[] = [];
  if (inn) { v.push(`fade=t=in:st=0:d=${inn}`); a.push(`afade=t=in:st=0:d=${inn}`); }
  if (out) { const st = Math.round((clip.seconds - out) * 100) / 100; v.push(`fade=t=out:st=${st}:d=${out}`); a.push(`afade=t=out:st=${st}:d=${out}`); }
  return { v: v.join(","), a: a.join(",") };
}

/** Local media (/api/local/…) is fetched from the running app, so the script needs its address. */
function absolute(url: string, origin: string | undefined): string {
  return url.startsWith("/") && origin ? `${origin.replace(/\/$/, "")}${url}` : url;
}

/** The size every clip is normalised to. */
export const frameOf = (aspect: Cut["aspect"]) => (aspect === "9:16" ? { w: 1080, h: 1920 } : { w: 1920, h: 1080 });
export const normFilter = (aspect: Cut["aspect"]) => {
  const { w, h } = frameOf(aspect);
  return `scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30,format=yuv420p`;
};

export function ffmpegScript(cut: Cut, name: string, origin?: string): string {
  if (cut.clips.length === 0) {
    throw new Error("There is nothing to export yet — shoot at least one shot first.");
  }

  const out = `${slug(name)}.mp4`;
  const lines: string[] = [
    "#!/usr/bin/env bash",
    `# ${cut.clips.length} clips, ${cut.total}s, ${frameOf(cut.aspect).w}×${frameOf(cut.aspect).h} — generated by haggs`,
    "set -euo pipefail",
    "",
    'work="$(mktemp -d)"',
    'trap \'rm -rf "$work"\' EXIT',
    "",
    "# One normalised size, rate and audio layout, so the joins are clean.",
    `norm="${normFilter(cut.aspect)}"`,
    "",
  ];

  for (const clip of cut.clips) {
    const n = String(clip.index + 1).padStart(3, "0");
    const src = `"$work/src-${n}"`;
    const dest = `"$work/clip-${n}.mp4"`;

    lines.push(`# ${n}: ${clip.heading.replace(/[\r\n]+/g, " ") || "untitled shot"}`);
    lines.push(`curl -fsSL ${sh(absolute(clip.url, origin))} -o ${src}`);

    if (clip.kind === "image") {
      lines.push(
        `ffmpeg -loglevel error -y -loop 1 -t ${clip.seconds} -i ${src} \\`,
        `  -f lavfi -t ${clip.seconds} -i anullsrc=r=48000:cl=stereo \\`,
        `  -vf "$norm" -c:v libx264 -c:a aac -shortest ${dest}`,
      );
    } else {
      // A video keeps its sound if it has any, and gets silence if it does not.
      const seek = clip.from > 0 ? `-ss ${clip.from} ` : "";
      lines.push(
        `if ffprobe -v error -select_streams a -show_entries stream=index -of csv=p=0 ${src} | grep -q .; then`,
        `  ffmpeg -loglevel error -y ${seek}-i ${src} -t ${clip.seconds} -vf "$norm" \\`,
        `    -af "aresample=48000,apad" -ar 48000 -ac 2 -c:v libx264 -c:a aac -shortest ${dest}`,
        "else",
        `  ffmpeg -loglevel error -y ${seek}-i ${src} -f lavfi -t ${clip.seconds} -i anullsrc=r=48000:cl=stereo \\`,
        `    -t ${clip.seconds} -vf "$norm" -c:v libx264 -c:a aac -shortest ${dest}`,
        "fi",
      );
    }
    lines.push("");
  }

  lines.push(
    ': > "$work/list.txt"',
    ...cut.clips.map((clip) => {
      const n = String(clip.index + 1).padStart(3, "0");
      return `echo "file 'clip-${n}.mp4'" >> "$work/list.txt"`;
    }),
    "",
  );
  const mix = mixFilter(cut);
  if (!mix) {
    lines.push(`ffmpeg -loglevel error -y -f concat -safe 0 -i "$work/list.txt" -c copy ${sh(out)}`);
  } else {
    lines.push(
      `ffmpeg -loglevel error -y -f concat -safe 0 -i "$work/list.txt" -c copy "$work/picture.mp4"`,
      "",
      "# The sound: voice lines in their places, the soundtrack dipped under them.",
      ...mix.inputs.map((url, i) => `curl -fsSL ${sh(absolute(url, origin))} -o "$work/sound-${i + 1}"`),
      `ffmpeg -loglevel error -y -i "$work/picture.mp4" ${mix.inputs.map((_, i) => `-i "$work/sound-${i + 1}"`).join(" ")} \\`,
      `  -filter_complex ${sh(mix.filter)} \\`,
      `  -map 0:v -map "[mix]" -c:v copy -c:a aac -b:a 192k ${sh(out)}`,
    );
  }
  lines.push(`echo "wrote ${out}"`, "");

  return lines.join("\n");
}
