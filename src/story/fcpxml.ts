import type { Clip, Cut } from "./cut";
import type { Marker } from "./model";

/**
 * The cut as Final Cut Pro XML 1.10 (also read by DaVinci Resolve and Premiere
 * through import): 30 fps, the picture on the spine, and voices, effects,
 * music and titles connected above and below it on numbered lanes.
 *
 * Fades are not carried: Final Cut has its own, drawn on the clip.
 *
 * Asset durations are what haggs knows (a clip's used range, an effect's
 * length, a spoken line's estimate); the editor re-reads the real media on
 * import.
 */

const FPS = 30;
const frames = (seconds: number) => Math.max(0, Math.round(seconds * FPS));
/** A time as FCPXML writes it: whole frames over the frame rate. */
export const tc = (seconds: number) => `${frames(seconds)}/${FPS}s`;

const esc = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const absolute = (url: string, origin: string | undefined) => (url.startsWith("/") && origin ? `${origin.replace(/\/$/, "")}${url}` : url);

type Placed = { name: string; url: string; start: number; seconds: number; lane: number; role: string; kind: "audio" | "video"; gain?: number; fromSource?: number };

export function fcpxml(cut: Cut, name: string, opts: { origin?: string; markers?: Marker[] } = {}): string {
  if (!cut.clips.length) throw new Error("There is nothing to export yet — shoot at least one shot first.");
  const w = cut.aspect === "9:16" ? 1080 : 1920;
  const h = cut.aspect === "9:16" ? 1920 : 1080;

  // One asset per file, sized to the longest use of it.
  const assets = new Map<string, { id: string; name: string; url: string; seconds: number; video: boolean; audio: boolean }>();
  const asset = (url: string, label: string, seconds: number, video: boolean, audio: boolean) => {
    const found = assets.get(url);
    if (found) {
      found.seconds = Math.max(found.seconds, seconds);
      return found;
    }
    const made = { id: `a${assets.size + 1}`, name: label, url, seconds, video, audio };
    assets.set(url, made);
    return made;
  };

  const connected: Placed[] = [
    ...(cut.sound?.voiceMute ? [] : cut.voices.map((v): Placed => ({ name: v.text.slice(0, 60) || "Voice", url: v.url, start: v.start, seconds: Math.max(1, Math.round((v.text.split(/\s+/).length / 2.6) * 10) / 10), lane: -1, role: "dialogue", kind: "audio", gain: v.gain }))),
    ...(cut.sound?.fxMute ? [] : (cut.effects ?? []).map((e): Placed => ({ name: e.name, url: e.url, start: e.start, seconds: e.seconds, lane: -2, role: "effects", kind: "audio", gain: e.gain }))),
    ...(cut.music && !cut.sound?.musicMute ? [{ name: cut.music.name, url: cut.music.url, start: 0, seconds: cut.total, lane: -3, role: "music", kind: "audio" as const, gain: cut.music.gain }] : []),
    ...(cut.overlays ?? []).map((o): Placed => ({ name: o.name.split("\n")[0]!.slice(0, 60), url: o.url, start: o.start, seconds: o.seconds, lane: 1, role: "titles", kind: "video" })),
  ];

  const parentOf = (at: number): Clip => cut.clips.find((c) => at >= c.start && at < c.start + c.seconds) ?? cut.clips[cut.clips.length - 1]!;

  const lines: string[] = [];
  const attach = (parent: Clip, indent: string) => {
    for (const item of connected.filter((x) => parentOf(x.start) === parent)) {
      const a = asset(item.url, item.name, item.seconds, item.kind === "video", item.kind === "audio");
      // A connected clip's offset is in its parent's own time.
      const offset = parent.from + (item.start - parent.start);
      const vol = item.gain ? `><adjust-volume amount="${item.gain}dB"/></asset-clip>` : "/>";
      lines.push(`${indent}<asset-clip ref="${a.id}" lane="${item.lane}" offset="${tc(offset)}" name="${esc(item.name)}" start="0s" duration="${tc(item.seconds)}" audioRole="${item.role}"${vol}`);
    }
  };

  const spine: string[] = [];
  for (const clip of cut.clips) {
    const a = asset(clip.url, clip.heading || `Shot ${clip.index + 1}`, clip.from + clip.seconds, true, clip.kind === "video" && !cut.sound?.clipMute);
    const inner: string[] = [];
    const saved = lines.length;
    attach(clip, "        ");
    inner.push(...lines.splice(saved));
    for (const m of (opts.markers ?? []).filter((x) => x.at >= clip.start && x.at < clip.start + clip.seconds)) {
      inner.push(`        <marker start="${tc(clip.from + (m.at - clip.start))}" duration="1/${FPS}s" value="${esc(m.text || "Marker")}"/>`);
    }
    const open = `      <asset-clip ref="${a.id}" offset="${tc(clip.start)}" name="${esc(clip.heading || `Shot ${clip.index + 1}`)}" start="${tc(clip.from)}" duration="${tc(clip.seconds)}" format="r1" tcFormat="NDF"`;
    spine.push(inner.length ? `${open}>\n${inner.join("\n")}\n      </asset-clip>` : `${open}/>`);
  }

  const resources = [...assets.values()].map((a) => {
    const isImage = !a.audio && a.video;
    const dur = isImage ? 3600 : a.seconds;
    return `    <asset id="${a.id}" name="${esc(a.name)}" start="0s" duration="${tc(dur)}" hasVideo="${a.video ? 1 : 0}" hasAudio="${a.audio ? 1 : 0}"${a.video ? ' format="r1"' : ""}${a.audio ? ' audioSources="1" audioChannels="2" audioRate="48000"' : ""}>\n      <media-rep kind="original-media" src="${esc(absolute(a.url, opts.origin))}"/>\n    </asset>`;
  });

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    "<!DOCTYPE fcpxml>",
    '<fcpxml version="1.10">',
    "  <resources>",
    `    <format id="r1" name="FFVideoFormat${h}p30" frameDuration="1/${FPS}s" width="${w}" height="${h}" colorSpace="1-1-1 (Rec. 709)"/>`,
    ...resources,
    "  </resources>",
    "  <library>",
    `    <event name="${esc(name)}">`,
    `      <project name="${esc(name)}">`,
    `        <sequence format="r1" duration="${tc(cut.total)}" tcStart="0s" tcFormat="NDF" audioLayout="stereo" audioRate="48k">`,
    "          <spine>",
    ...spine,
    "          </spine>",
    "        </sequence>",
    "      </project>",
    "    </event>",
    "  </library>",
    "</fcpxml>",
    "",
  ].join("\n");
}
