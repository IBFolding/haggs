import { ROOM, describeGrey, project, type GreyFrame } from "./grey";
import { camAt } from "./grey-camera";
import { figuresMarkup } from "./grey-figure";

/**
 * The grey blockout as plain pictures, one per moment, with the camera where its path puts it.
 * Played in order they make the control video a video model follows: where the people stand,
 * how the camera moves. No words are drawn into the picture, because they would end up in the video.
 */
export function greyFrameSvg(grey: GreyFrame, t: number, size: { w: number; h: number }): string {
  const { w: W, h: H } = size;
  const aspect = W / H;
  const cam = camAt(grey.cam, grey.camKeys, t);
  const px = (u: number) => (u * W).toFixed(1);
  const py = (v: number) => (v * H).toFixed(1);
  const lines: string[] = [];
  for (let i = -ROOM; i <= ROOM; i += 1) {
    const a = project(cam, { x: i, y: 0, z: -ROOM }, aspect), b = project(cam, { x: i, y: 0, z: ROOM }, aspect);
    const c = project(cam, { x: -ROOM, y: 0, z: i }, aspect), d = project(cam, { x: ROOM, y: 0, z: i }, aspect);
    if (a && b) lines.push(`<line x1="${px(a.u)}" y1="${py(a.v)}" x2="${px(b.u)}" y2="${py(b.v)}"/>`);
    if (c && d) lines.push(`<line x1="${px(c.u)}" y1="${py(c.v)}" x2="${px(d.u)}" y2="${py(d.v)}"/>`);
  }
  const lit = Math.cos(((grey.light.az - cam.angle) * Math.PI) / 180);
  const figures = grey.pose === "walk" ? [figuresMarkup(grey, cam, t, size)] : grey.subjects.flatMap((s) => {
    const feet = project(cam, { x: s.x, y: 0, z: s.z }, aspect), head = project(cam, { x: s.x, y: 1.75, z: s.z }, aspect);
    return feet && head ? [{ feet, head, depth: feet.depth }] : [];
  }).sort((p, q) => q.depth - p.depth).map(({ feet, head }) => {
    const wd = Math.max(18, Math.abs(feet.v * H - head.v * H) * 0.22);
    const shade = Math.round(150 + lit * 40);
    return `<ellipse cx="${px(feet.u)}" cy="${py(feet.v)}" rx="${(wd * 1.1).toFixed(1)}" ry="${(wd * 0.35).toFixed(1)}" fill="#000" opacity=".28"/>`
      + `<line x1="${px(feet.u)}" y1="${py(feet.v)}" x2="${px(head.u)}" y2="${(head.v * H + wd * 0.5).toFixed(1)}" stroke="rgb(${shade},${shade},${shade + 6})" stroke-width="${wd.toFixed(1)}" stroke-linecap="round"/>`
      + `<circle cx="${px(head.u)}" cy="${py(head.v)}" r="${(wd * 0.62).toFixed(1)}" fill="rgb(${shade + 20},${shade + 20},${shade + 26})"/>`;
  });
  const horizon = py(project(cam, { x: 0, y: 0, z: ROOM * 2 }, aspect)?.v ?? 0.55);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`
    + `<defs><linearGradient id="w" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#8a8a8e"/><stop offset="1" stop-color="#5d5d62"/></linearGradient><linearGradient id="f" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#6f6f74"/><stop offset="1" stop-color="#9a9a9f"/></linearGradient></defs>`
    + `<rect width="${W}" height="${H}" fill="url(#w)"/><rect y="${horizon}" width="${W}" height="${H}" fill="url(#f)"/>`
    + `<g stroke="#fff" stroke-opacity=".12" stroke-width="2">${lines.join("")}</g>${figures.join("")}</svg>`;
}

/** The moments to draw for a clip of this many seconds at this frame rate (one more than the gaps, so the last frame is included). */
export const frameTimes = (seconds: number, fps: number): number[] => Array.from({ length: Math.max(1, Math.round(seconds * fps)) + 1 }, (_, i) => i / fps);

/** The longest control video the shot graph accepts, in seconds, and the frame rate it is made at. */
export const CONTROL_MAX_SECONDS = 5;
export const CONTROL_FPS = 25;

/** How long the shot runs: as long as the camera move, at most five seconds, in whole eight-frame steps plus one (what the video model needs). A still camera gets about four. */
export function controlSeconds(grey: GreyFrame): number {
  const keys = grey.camKeys ?? [];
  const want = keys.length > 1 ? Math.min(CONTROL_MAX_SECONDS, Math.max(1, keys[keys.length - 1]!.t)) : 3.84;
  const frames = 8 * Math.max(1, Math.floor((want * CONTROL_FPS) / 8)) + 1;
  return (frames - 1) / CONTROL_FPS;
}

/** The blockout with its camera move squeezed to fit the clip, when the move is longer than the clip can be. */
export function fitToClip(grey: GreyFrame): GreyFrame {
  const keys = grey.camKeys;
  if (!keys || keys.length < 2) return grey;
  const end = keys[keys.length - 1]!.t;
  const clip = controlSeconds(grey);
  if (end <= clip) return grey;
  const k = clip / end;
  return { ...grey, camKeys: keys.map((key) => ({ ...key, t: +(key.t * k).toFixed(3) })) };
}

/** What the shot should be, in words: the beat, the camera and light, and that the people stay as they are in the first frame. */
export function shotPrompt(beat: string, g: GreyFrame): string {
  const who = g.subjects.map((s) => s.label).filter(Boolean).join(", ");
  return `${beat.trim().replace(/[.\s]+$/, "")}. ${who ? `The people are: ${who}. ` : ""}${g.pose === "walk" ? (g.subjects.length === 1 ? "The one person walks toward the camera, facing it, with natural arms and a relaxed gait. Nobody else is in the shot. " : `The ${g.subjects.length} people walk toward the camera, facing it, with natural arms and a relaxed gait. Nobody else is in the shot. `) : ""}${describeGrey(g)} The camera moves smoothly, as the control video shows. Natural, restrained motion. Keep the people, clothes, place and light exactly as in the first frame.`;
}
