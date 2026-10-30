import { airLayout } from "./grey-air";
import { actorShadow, atmosphere, exprAt, propShadow, type GreyScene, type Key, type Prop } from "./grey-scene";

/**
 * Turns a Grey Room scene into one ffmpeg composite: backdrop, props behind
 * the actor, the actor, props in front, lights, then the look. The plan lists
 * the files to feed in (in order) and the filter that joins them; the server
 * maps each input to a file on disk. Pure, so the same scene always plans the
 * same render and it can be tested without ffmpeg.
 *
 * It draws what the preview draws, except the air (fog, rain, …) which only
 * the preview animates, and it says so.
 */

export type PlanInput = {
  role: "backdrop" | "surface" | "texture" | "actor" | "prop" | "shadow" | "light" | "air" | "footage-picture" | "footage";
  /** A media link for backdrop, actor, props and footage; the light's or the prop's id for a light or a shadow; the kind of air (rain, fog…). */
  ref: string;
  /** Flags that go before this input's `-i`. */
  args: string[];
  /** For a texture: the width in pixels of one tile, which the server repeats to fill the frame. */
  tile?: number;
};
export type Plan = { inputs: PlanInput[]; filter: string; /** The input to take sound from. */ audioFrom: number; notes: string[] };

const n = (v: number) => +v.toFixed(3);
/** Whether any key sets this value, so it must be written as a moving expression. */
const moves = (keys: Key[] | undefined, c: keyof Omit<Key, "t">) => (keys ?? []).some((k) => typeof k[c] === "number");

/** The contact shadow under a prop, in pixels: nearly as wide as the prop, and a flat ellipse. `aspect` is the picture's height over its width. */
export function shadowSize(p: Pick<Prop, "w">, size: { w: number; h: number }, aspect: number): { w: number; h: number } {
  return { w: Math.round(p.w * size.w * 0.92), h: Math.max(8, Math.round(p.w * size.w * aspect * 0.1)) };
}

/** `aspects` is each prop picture's height over its width; a prop whose size isn't known gets no shadow. */
export function greyPlan(scene: GreyScene, size: { w: number; h: number }, seconds: number, footageUrl: string, aspects: Record<string, number> = {}): Plan {
  const { w: W, h: H } = size;
  const inputs: PlanInput[] = [];
  const notes: string[] = [];
  const loop = ["-loop", "1", "-t", String(seconds)];
  const parts: string[] = [];
  let at = "";

  // The backdrop: sized like the preview (a width of `scale` frames, aspect kept), placed by its position, on a dark floor.
  parts.push(`color=c=0x26262a:s=${W}x${H}:d=${seconds}[floor]`);
  if (scene.backdrop) {
    const b = scene.backdrop;
    inputs.push({ role: "backdrop", ref: b.url, args: loop });
    const i = inputs.length - 1;
    const sigma = b.blur > 0 ? `,gblur=sigma=${n(b.blur * 14 * (W / 760))}` : "";
    const zoom = moves(b.keys, "scale");
    parts.push(zoom ? `[${i}:v]scale=w='round(${W}*(${exprAt(b.scale, b.keys, "scale")}))':h=-2:eval=frame${sigma}[bd]` : `[${i}:v]scale=${Math.round(W * b.scale)}:-2${sigma}[bd]`);
    const bx = moves(b.keys, "x") ? `'(${W}-overlay_w)*(${exprAt(b.x, b.keys, "x")})'` : `(${W}-overlay_w)*${n(b.x)}`;
    const by = moves(b.keys, "y") ? `'(${H}-overlay_h)*(${exprAt(b.y, b.keys, "y")})'` : `(${H}-overlay_h)*${n(b.y)}`;
    parts.push(`[floor][bd]overlay=x=${bx}:y=${by}:shortest=1[bg]`);
    at = "bg";
  } else at = "floor";

  // Without a matte, footage is the base; surface edits must remain above it.
  if (!scene.matte) {
    notes.push("The original shot is the base. Surface edits sit over it; replacing the background needs a subject cut-out.");
    inputs.push({ role: "footage-picture", ref: footageUrl, args: scene.source?.kind === "image" ? loop : [] });
    const i = inputs.length - 1;
    parts.push(`[${i}:v]scale=${W}:${H}:force_original_aspect_ratio=decrease[ac]`);
    parts.push(`[${at}][ac]overlay=x=(${W}-overlay_w)/2:y=(${H}-overlay_h)/2:shortest=1[wa]`);
    at = "wa";
  }

  // Surfaces from the footage (a wall, a floor) with a new texture: blend the texture into the surface, keep the surface's own shape.
  for (const sf of scene.surfaces ?? []) {
    if (sf.hidden || !sf.mask || !sf.texture) continue;
    inputs.push({ role: "surface", ref: sf.mask.url, args: sf.mask.kind === "image" ? loop : ["-c:v", "libvpx-vp9"] });
    const si = inputs.length - 1;
    inputs.push({ role: "texture", ref: sf.texture.url, args: loop, tile: Math.round(W * 0.25 * sf.texture.scale) });
    const ti = inputs.length - 1;
    parts.push(`[${si}:v]scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=black@0,format=rgba,split[sc${si}][sz${si}]`);
    parts.push(`[sz${si}]alphaextract[sa${si}]`);
    parts.push(`[sc${si}]format=gbrp[sg${si}]`);
    parts.push(`[${ti}:v]format=gbrp[tx${ti}]`);
    parts.push(`[sg${si}][tx${ti}]blend=all_mode=overlay:all_opacity=${n(sf.strength)}[bl${si}]`);
    parts.push(`[bl${si}][sa${si}]alphamerge[sf${si}]`);
    parts.push(`[${at}][sf${si}]overlay=0:0:shortest=1[su${si}]`);
    at = `su${si}`;
  }

  const props = (scene.props ?? []).filter((p) => !p.hidden);
  const putProps = (list: typeof props, tag: string) => {
    for (const p of list) {
      const ratio = aspects[p.id];
      if (propShadow(p) > 0 && ratio) {
        inputs.push({ role: "shadow", ref: p.id, args: loop });
        const j = inputs.length - 1;
        const sx = moves(p.keys, "x") ? `'${W}*(${exprAt(p.x, p.keys, "x")})-overlay_w/2'` : `${Math.round(p.x * W)}-overlay_w/2`;
        const sy = moves(p.keys, "y") ? `'${H}*(${exprAt(p.y, p.keys, "y")})+${Math.round((p.w * W * ratio) / 2)}-overlay_h/2'` : `${Math.round(p.y * H + (p.w * W * ratio) / 2)}-overlay_h/2`;
        parts.push(`[${at}][${j}:v]overlay=x=${sx}:y=${sy}:shortest=1[sh${j}]`);
        at = `sh${j}`;
      }
      inputs.push({ role: "prop", ref: p.url, args: loop });
      const i = inputs.length - 1;
      const rad = (p.rotate * Math.PI) / 180;
      const grow = moves(p.keys, "w");
      const turn = moves(p.keys, "rotate");
      const chain = [
        grow ? `scale=w='round(${W}*(${exprAt(p.w, p.keys, "w")}))':h=-1:eval=frame` : `scale=${Math.round(p.w * W)}:-1`,
        "format=rgba",
        ...(p.flip ? ["hflip"] : []),
        ...(turn ? [`rotate=a='(${exprAt(p.rotate, p.keys, "rotate")})*PI/180':ow='hypot(iw,ih)':oh='hypot(iw,ih)':c=none`] : p.rotate ? [`rotate=${n(rad)}:ow='rotw(${n(rad)})':oh='roth(${n(rad)})':c=none`] : []),
        ...(p.opacity < 1 ? [`colorchannelmixer=aa=${n(p.opacity)}`] : []),
      ];
      parts.push(`[${i}:v]${chain.join(",")}[pp${i}]`);
      const next = `${tag}${i}`;
      const px = moves(p.keys, "x") ? `'${W}*(${exprAt(p.x, p.keys, "x")})-overlay_w/2'` : `${Math.round(p.x * W)}-overlay_w/2`;
      const py = moves(p.keys, "y") ? `'${H}*(${exprAt(p.y, p.keys, "y")})-overlay_h/2'` : `${Math.round(p.y * H)}-overlay_h/2`;
      parts.push(`[${at}][pp${i}]overlay=x=${px}:y=${py}:shortest=1[${next}]`);
      at = next;
    }
  };
  putProps(props.filter((p) => p.behind), "pb");

  if (scene.matte) {
    // The cut-out has an alpha channel; only the libvpx decoder keeps it.
    inputs.push({ role: "actor", ref: scene.matte.url, args: ["-c:v", "libvpx-vp9"] });
    const i = inputs.length - 1;
    const sh = actorShadow(scene);
    if (sh.amount > 0) {
      const rad = (sh.angle * Math.PI) / 180;
      const dx = Math.round(Math.cos(rad) * 0.022 * W), dy = Math.round(Math.sin(rad) * 0.022 * W);
      parts.push(`[${i}:v]scale=${W}:${H}:force_original_aspect_ratio=decrease,format=rgba,split[ac][acs]`);
      parts.push(`[acs]colorchannelmixer=rr=0:gg=0:bb=0:aa=${n(sh.amount * 0.7)},gblur=sigma=${n(W * 0.006)}[asd]`);
      parts.push(`[${at}][asd]overlay=x=(${W}-overlay_w)/2+${dx}:y=(${H}-overlay_h)/2+${dy}:shortest=1[wsd]`);
      at = "wsd";
    } else parts.push(`[${i}:v]scale=${W}:${H}:force_original_aspect_ratio=decrease[ac]`);
    parts.push(`[${at}][ac]overlay=x=(${W}-overlay_w)/2:y=(${H}-overlay_h)/2:shortest=1[wa]`);
    at = "wa";
  }

  putProps(props.filter((p) => !p.behind), "pf");

  // Lights are soft glows drawn to pictures the size of the frame, laid on with their own transparency.
  for (const l of scene.lights ?? []) {
    inputs.push({ role: "light", ref: l.id, args: loop });
    const i = inputs.length - 1;
    const next = `lt${i}`;
    // The glow is drawn at the light's own place; a moving light slides the whole picture by the difference.
    const lx = moves(l.keys, "x") ? `'(${exprAt(l.x, l.keys, "x")}-${n(l.x)})*${W}'` : "0";
    const ly = moves(l.keys, "y") ? `'(${exprAt(l.y, l.keys, "y")}-${n(l.y)})*${H}'` : "0";
    parts.push(`[${at}][${i}:v]overlay=x=${lx}:y=${ly}:shortest=1[${next}]`);
    at = next;
  }

  // Air: each kind is a tile that joins itself, sliding past the frame at its own pace.
  for (const a of atmosphere(scene)) {
    const lay = airLayout(a.kind, size);
    inputs.push({ role: "air", ref: a.kind, args: loop });
    const i = inputs.length - 1;
    const next = `ar${i}`;
    parts.push(`[${i}:v]format=rgba[aa${i}]`);
    const pos = lay.axis === "down" ? `x=0:y='mod(t*${Math.round(lay.speed)},${H})-${H}'` : lay.axis === "up" ? `x=0:y='-mod(t*${Math.round(lay.speed)},${H})'` : `x='-mod(t*${Math.round(lay.speed)},${W})':y=0`;
    parts.push(`[${at}][aa${i}]overlay=${pos}:shortest=1[${next}]`);
    at = next;
  }

  // The look: brightness, contrast, colour, warmth, then dark edges.
  const look = scene.look;
  const grade: string[] = [];
  if (look) {
    if (look.exposure || look.contrast || look.saturation) grade.push(`eq=brightness=${n(look.exposure * 0.4)}:contrast=${n(1 + look.contrast)}:saturation=${n(1 + look.saturation)}`);
    if (look.warmth) grade.push(`colorbalance=rs=${n(look.warmth * 0.18)}:bs=${n(-look.warmth * 0.18)}:rm=${n(look.warmth * 0.1)}:bm=${n(-look.warmth * 0.1)}`);
    if (look.vignette > 0.05) grade.push(`vignette=angle=${n((Math.PI / 2.2) * (1 - look.vignette * 0.7))}`);
  }
  parts.push(`[${at}]${grade.length ? grade.join(",") : "null"}[out]`);

  if ((scene.lights ?? []).length) notes.push("Lights are soft glows; they don't cast real shadows.");

  inputs.push({ role: "footage", ref: footageUrl, args: [] });
  return { inputs, filter: parts.join(";"), audioFrom: inputs.length - 1, notes };
}
