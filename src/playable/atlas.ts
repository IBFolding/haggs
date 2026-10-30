/** Bounded, data-only Game Director atlas interchange. Never fetch manifest paths. */
export const ATLAS_LIMITS = { pngBytes: 2_000_000, jsonBytes: 256_000, pixels: 16_000_000, side: 8192, frames: 600 } as const;
export type AtlasFrame = { frame: number; x: number; y: number; width: number; height: number };
export type AtlasClip = { name: string; start_frame: number; end_frame_exclusive: number };
export type SpriteAtlas = { version: 1; width: number; height: number; fps: number; frames: AtlasFrame[]; animations: AtlasClip[]; selected: string; loop: boolean };
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
function integer(v: unknown, min: number, max: number, label: string): number {
  if (typeof v !== 'number' || !Number.isSafeInteger(v) || v < min || v > max) throw new Error(`Invalid atlas ${label}.`);
  return v;
}
export function readAtlas(value: unknown, width?: number, height?: number): SpriteAtlas {
  if (!object(value)) throw new Error('Choose a Game Director atlas.json object.');
  const w = integer(width ?? value.width, 1, ATLAS_LIMITS.side, 'width');
  const h = integer(height ?? value.height, 1, ATLAS_LIMITS.side, 'height');
  if (w * h > ATLAS_LIMITS.pixels) throw new Error('Atlas exceeds 16 million pixels. Export smaller cells.');
  if (value.version !== undefined && value.version !== 1) throw new Error('Unsupported atlas version.');
  // The export filename is metadata only. Reject alternate formats/remote paths explicitly.
  if (value.image !== undefined && value.image !== 'atlas.png') throw new Error('The manifest image must be atlas.png. Select the PNG separately.');
  if (typeof value.fps !== 'number' || !Number.isFinite(value.fps) || value.fps < 1 || value.fps > 120) throw new Error('Atlas FPS must be between 1 and 120.');
  if (!Array.isArray(value.frames) || !value.frames.length || value.frames.length > ATLAS_LIMITS.frames) throw new Error('Atlas needs 1–600 frames.');
  const frames = value.frames.map((v, i) => {
    if (!object(v)) throw new Error('Invalid atlas frame.');
    const frame = integer(v.frame, 0, value.frames instanceof Array ? value.frames.length - 1 : 0, 'frame index');
    const x = integer(v.x, 0, w - 1, 'frame x'), y = integer(v.y, 0, h - 1, 'frame y');
    const fw = integer(v.width, 1, w, 'frame width'), fh = integer(v.height, 1, h, 'frame height');
    if (x + fw > w || y + fh > h) throw new Error(`Frame ${i} extends outside the PNG.`);
    return { frame, x, y, width: fw, height: fh };
  }).sort((a, b) => a.frame - b.frame);
  if (frames.some((f, i) => f.frame !== i)) throw new Error('Frame indices must be unique and contiguous from zero.');
  if (value.animations !== undefined && !Array.isArray(value.animations)) throw new Error('Atlas animations must be an array.');
  const offered = (value.animations ?? []) as unknown[];
  if (offered.length > 128) throw new Error('Too many atlas action ranges.');
  const names = new Set<string>(['all']);
  const animations: AtlasClip[] = [{ name: 'all', start_frame: 0, end_frame_exclusive: frames.length }];
  for (const v of offered) {
    if (!object(v) || typeof v.name !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(v.name)) throw new Error('Invalid atlas action name.');
    const start = integer(v.start_frame, 0, frames.length - 1, 'action start');
    const end = integer(v.end_frame_exclusive, start + 1, frames.length, 'action end');
    if (v.name === 'all' && start === 0 && end === frames.length) continue;
    if (names.has(v.name)) throw new Error('Atlas action names must be unique.');
    names.add(v.name); animations.push({ name: v.name, start_frame: start, end_frame_exclusive: end });
  }
  const selected = value.selected ?? 'all';
  if (typeof selected !== 'string' || !names.has(selected)) throw new Error('Selected atlas action does not exist.');
  if (value.loop !== undefined && typeof value.loop !== 'boolean') throw new Error('Atlas loop must be true or false.');
  return { version: 1, width: w, height: h, fps: value.fps, frames, animations, selected, loop: value.loop === true };
}

/** Game time, not wall time: pause/replay and frame-rate independence are preserved. */
export function atlasFrame(atlas: SpriteAtlas, seconds: number): AtlasFrame {
  const clip = atlas.animations.find(a => a.name === atlas.selected) ?? atlas.animations[0]!;
  const count = clip.end_frame_exclusive - clip.start_frame;
  const elapsed = Math.floor(Math.max(0, Number.isFinite(seconds) ? seconds : 0) * atlas.fps);
  const offset = atlas.loop ? elapsed % count : Math.min(count - 1, elapsed);
  return atlas.frames[clip.start_frame + offset]!;
}

export function pngSize(bytes: Uint8Array): { width: number; height: number } {
  if (bytes.length < 33 || ![137,80,78,71,13,10,26,10].every((b, i) => bytes[i] === b) || String.fromCharCode(...bytes.slice(12,16)) !== 'IHDR') throw new Error('Select a real PNG atlas, not SVG, HTML or another file type.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(8) !== 13) throw new Error('Invalid PNG header.');
  const width = integer(view.getUint32(16), 1, ATLAS_LIMITS.side, 'PNG width');
  const height = integer(view.getUint32(20), 1, ATLAS_LIMITS.side, 'PNG height');
  if (width * height > ATLAS_LIMITS.pixels) throw new Error('Atlas exceeds 16 million pixels. Export smaller cells.');
  return { width, height };
}
