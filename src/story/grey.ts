import { angleName } from "../academy/labs";
import { tidyKeys, type CamKey } from "./grey-camera";

/**
 * The grey room: a shot worked out in plain grey before anything is made. A
 * camera, a few stand-ins on a floor and a light are enough to settle the
 * framing; dial it in, then ask for the real picture to be made from it.
 */

export type GreySubject = { id: string; label: string; x: number; z: number };
export type GreyFrame = {
  trajectory?: import("./trajectory").Trajectory;
  /** Where the camera is round the room (0 = in front, looking the way the subjects face) and how far, in metres. */
  cam: { angle: number; distance: number; height: number; lens: number };
  subjects: GreySubject[];
  /** The camera moving: keys over a few seconds. With none, `cam` is a still camera. */
  camKeys?: CamKey[];
  /** The light: which way it comes from and how high. */
  light: { az: number; el: number };
};

export const ROOM = 3; // the floor runs −3 to 3 metres each way

export const defaultGrey = (labels: string[] = ["Subject"]): GreyFrame => ({
  cam: { angle: 0, distance: 5, height: 1.5, lens: 35 },
  subjects: labels.slice(0, 4).map((label, i, all) => ({ id: `s${i}`, label, x: all.length === 1 ? 0 : -1 + (2 * i) / Math.max(1, all.length - 1), z: 0 })),
  light: { az: 315, el: 45 },
});

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** The camera made safe: inside the room's reach, a real lens, a sane height. */
export function tidy(g: GreyFrame): GreyFrame {
  return {
    ...(g.trajectory?{trajectory:g.trajectory}:{}),
    ...(tidyKeys(g.camKeys) ? { camKeys: tidyKeys(g.camKeys)! } : {}),
    cam: { angle: ((g.cam.angle % 360) + 360) % 360, distance: clamp(g.cam.distance, 1, 12), height: clamp(g.cam.height, 0.2, 6), lens: clamp(Math.round(g.cam.lens), 14, 135) },
    subjects: g.subjects.slice(0, 6).map((s) => ({ ...s, label: s.label.slice(0, 24), x: clamp(s.x, -ROOM, ROOM), z: clamp(s.z, -ROOM, ROOM) })),
    light: { az: ((g.light.az % 360) + 360) % 360, el: clamp(g.light.el, 5, 90) },
  };
}

export type Projected = { u: number; v: number; depth: number };

/** Where a point in the room lands in the frame (0–1 across, 0–1 down), looking at the middle of the room at chest height. */
export function project(cam: GreyFrame["cam"], p: { x: number; y: number; z: number }, aspect: number): Projected | null {
  const a = (cam.angle * Math.PI) / 180;
  const pos = { x: Math.sin(a) * cam.distance, y: cam.height, z: -Math.cos(a) * cam.distance };
  const target = { x: 0, y: 1.2, z: 0 };
  const sub = (p: typeof pos, q: typeof pos) => ({ x: p.x - q.x, y: p.y - q.y, z: p.z - q.z });
  const dot = (p: typeof pos, q: typeof pos) => p.x * q.x + p.y * q.y + p.z * q.z;
  const norm = (p: typeof pos) => { const l = Math.hypot(p.x, p.y, p.z) || 1; return { x: p.x / l, y: p.y / l, z: p.z / l }; };
  const cross = (p: typeof pos, q: typeof pos) => ({ x: p.y * q.z - p.z * q.y, y: p.z * q.x - p.x * q.z, z: p.x * q.y - p.y * q.x });
  const f = norm(sub(target, pos));
  const r = norm(cross({ x: 0, y: 1, z: 0 }, f));
  const u = cross(f, r);
  const v = sub(p, pos);
  const depth = dot(v, f);
  if (depth < 0.2) return null;
  const k = cam.lens / 36;
  return { u: 0.5 + (dot(v, r) / depth) * k, v: 0.5 - (dot(v, u) / depth) * k * aspect, depth };
}

/** A line of words for what the camera and light are doing, for the model that makes the real picture. */
export function describeGrey(g: GreyFrame): string {
  const shot = angleName(g.cam.angle, clamp((g.cam.distance - 1) / 8, 0, 1)).name.toLowerCase();
  const height = g.cam.height < 0.8 ? "a low camera looking up" : g.cam.height > 2.6 ? "a high camera looking down" : "an eye-level camera";
  const lens = g.cam.lens <= 24 ? "a wide lens" : g.cam.lens >= 85 ? "a long telephoto lens with a flat, compressed background" : "a natural 35 to 50 mm lens";
  const side = (g.light.az < 45 || g.light.az >= 315) ? "from the front" : g.light.az < 135 ? "from the right" : g.light.az < 225 ? "from behind, as a backlight" : "from the left";
  const lift = g.light.el > 65 ? "high overhead" : g.light.el < 20 ? "low and raking" : "at a natural angle";
  return `${shot}, ${height}, ${lens}. Light ${side}, ${lift}.`;
}

/** The prompt that turns the grey blockout into the picture: what it is, what must not move. */
export function realPrompt(beat: string, g: GreyFrame): string {
  const who = g.subjects.map((s) => s.label).filter(Boolean).join(", ");
  return `Turn this grey 3D blockout into a photoreal cinematic film still. ${beat.trim().replace(/[.\s]+$/, "")}. ${who ? `The grey figures are: ${who}. ` : ""}${describeGrey(g)} Keep the composition exactly as the blockout shows it: the camera angle, where every figure stands, their size in the frame, the horizon. Replace the grey with real people, clothes, materials and a real place.`;
}

/** A shot with a real take on it is locked: the tools that change it wait for an approval. */
export const needsApproval = (shot: { render?: unknown; approved?: boolean }) => Boolean(shot.render) && !shot.approved;
