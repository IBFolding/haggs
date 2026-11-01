import { project, type GreyFrame } from "./grey";

/**
 * A mannequin made of limbs, so the grey blockout can show a body and not only a post.
 * It is a stick figure with thickness: a pelvis, a spine, a head, two arms and two legs,
 * each a segment between two joints in the room (metres), moved by a simple walking cycle.
 * Standing, every joint is at rest.
 */
export type Pose = "stand" | "walk";
type V3 = { x: number; y: number; z: number };
export type Segment = { a: V3; b: V3; r: number; head?: boolean };

export const FIGURE_HEIGHT = 1.75;
/** Walking pace in metres a second, and strides a second. */
const PACE = 1.0;
const CYCLES = 0.95;
/** Seconds into the clip at which a walker is exactly where it was put in the blockout. */
export const WALK_MID = 2;

/** The segments of one figure at time `t`. `facing` is where it looks, in degrees, like the camera's angle: 0 faces the camera at its first place. */
export function figureSegments(at: { x: number; z: number }, t: number, pose: Pose, facing = 0): Segment[] {
  const th = (facing * Math.PI) / 180;
  const f = { x: Math.sin(th), z: -Math.cos(th) };
  const side = { x: Math.cos(th), z: Math.sin(th) };
  const walking = pose === "walk";
  const ahead = walking ? PACE * (t - WALK_MID) : 0;
  const base = { x: at.x + f.x * ahead, z: at.z + f.z * ahead };
  const phase = walking ? 2 * Math.PI * CYCLES * t : 0;
  // local (right, up, forward) to room
  const P = (r: number, y: number, fw: number): V3 => ({ x: base.x + side.x * r + f.x * fw, y, z: base.z + side.z * r + f.z * fw });
  const bob = walking ? 0.02 * Math.cos(2 * phase) : 0;
  const hipY = 0.95 + bob;
  const leg = (sign: 1 | -1): Segment[] => {
    const ph = phase + (sign === 1 ? 0 : Math.PI);
    const swing = walking ? 0.5 * Math.sin(ph) : 0;
    const bend = walking ? (0.55 * (1 - Math.cos(ph + 0.6))) / 2 : 0;
    const shin = swing - bend;
    const kneeFw = 0.45 * Math.sin(swing), kneeY = hipY - 0.45 * Math.cos(swing);
    const ankleFw = kneeFw + 0.45 * Math.sin(shin), ankleY = Math.max(0.05, kneeY - 0.45 * Math.cos(shin));
    const knee = P(sign * 0.09, kneeY, kneeFw), ankle = P(sign * 0.09, ankleY, ankleFw);
    return [{ a: P(sign * 0.09, hipY, 0), b: knee, r: 0.075 }, { a: knee, b: ankle, r: 0.06 }, { a: ankle, b: P(sign * 0.09, Math.max(0.03, ankleY - 0.04), ankleFw + 0.12), r: 0.045 }];
  };
  const arm = (sign: 1 | -1): Segment[] => {
    const ph = phase + (sign === 1 ? Math.PI : 0);
    const swing = walking ? 0.4 * Math.sin(ph) : 0;
    const elbowBend = walking ? 0.3 + 0.2 * Math.max(0, Math.sin(ph)) : 0.05;
    const shoulder = P(sign * 0.2, 1.42, 0);
    const elbow = P(sign * 0.22, 1.42 - 0.3 * Math.cos(swing), 0.3 * Math.sin(swing));
    const ef = 0.3 * Math.sin(swing);
    const hand = P(sign * 0.22, elbow.y - 0.27 * Math.cos(swing + elbowBend), ef + 0.27 * Math.sin(swing + elbowBend));
    return [{ a: shoulder, b: elbow, r: 0.05 }, { a: elbow, b: hand, r: 0.042 }];
  };
  const lean = walking ? 0.06 : 0;
  const chest = P(0, 1.45, lean);
  const head = P(0, 1.66, lean * 1.4);
  return [
    { a: P(0, hipY, 0), b: chest, r: 0.15 },
    { a: P(-0.2, 1.42, lean), b: P(0.2, 1.42, lean), r: 0.06 },
    { a: chest, b: head, r: 0.05 },
    { a: head, b: head, r: 0.11, head: true },
    ...leg(1), ...leg(-1), ...arm(1), ...arm(-1),
  ];
}

/** Every figure of a blockout as SVG shapes, drawn far to near, for a frame of this size. Numbers only: no words, so nothing odd can land in the video. */
export function figuresMarkup(grey: GreyFrame, cam: GreyFrame["cam"], t: number, size: { w: number; h: number }): string {
  const { w: W, h: H } = size;
  const aspect = W / H;
  const lit = Math.cos(((grey.light.az - cam.angle) * Math.PI) / 180);
  const shade = Math.round(150 + lit * 40);
  const px = (u: number) => (u * W).toFixed(1);
  const py = (v: number) => (v * H).toFixed(1);
  const out: { depth: number; svg: string }[] = [];
  for (const s of grey.subjects) {
    const feet = project(cam, { x: s.x, y: 0, z: s.z }, aspect), top = project(cam, { x: s.x, y: FIGURE_HEIGHT, z: s.z }, aspect);
    if (!feet || !top) continue;
    const metre = Math.abs(feet.v * H - top.v * H) / FIGURE_HEIGHT;
    const segments = figureSegments(s, t, grey.pose ?? "stand", 0);
    // The shadow goes where the body is, so a walker takes it along.
    const body = segments[0]!.a;
    const under = project(cam, { x: body.x, y: 0, z: body.z }, aspect) ?? feet;
    out.push({ depth: under.depth + 100, svg: `<ellipse cx="${px(under.u)}" cy="${py(under.v)}" rx="${(metre * 0.3).toFixed(1)}" ry="${(metre * 0.09).toFixed(1)}" fill="#000" opacity=".25"/>` });
    for (const seg of segments) {
      const a = project(cam, seg.a, aspect), b = project(cam, seg.b, aspect);
      if (!a || !b) continue;
      const tone = seg.head ? shade + 22 : shade - (seg.a.x > s.x ? 0 : 8);
      const fill = `rgb(${tone},${tone},${tone + 6})`;
      const w = (seg.r * 2 * metre).toFixed(1);
      out.push({ depth: (a.depth + b.depth) / 2, svg: seg.head
        ? `<circle cx="${px(a.u)}" cy="${py(a.v)}" r="${(seg.r * metre).toFixed(1)}" fill="${fill}"/>`
        : `<line x1="${px(a.u)}" y1="${py(a.v)}" x2="${px(b.u)}" y2="${py(b.v)}" stroke="${fill}" stroke-width="${w}" stroke-linecap="round"/>` });
    }
  }
  return out.sort((p, q) => q.depth - p.depth).map((o) => o.svg).join("");
}
