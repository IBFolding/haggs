/**
 * Sprite sheet: a short clip of a character cut into evenly spaced frames and laid out as one picture, a grid of squares
 * for a game engine. Pure planning here; ffmpeg does the cutting.
 */

export const MAX_FRAMES = 64;
export type SpritePlan = { frames: number; columns: number; rows: number; size: number; fps: number };

export const spriteLayout = (frames: number, columns: number) => {
  const c = Math.max(1, Math.min(Math.floor(columns), frames));
  return { columns: c, rows: Math.ceil(frames / c), frames };
};

export function spritePlan({ seconds, frames, columns, size }: { seconds: number; frames: number; columns: number; size: number }): SpritePlan {
  if (!(seconds > 0)) throw new Error("That clip has no length to cut into frames.");
  const f = Math.min(MAX_FRAMES, Math.max(2, Math.round(Number(frames) || 8)));
  const cell = Math.min(512, Math.max(32, Math.round(Number(size) || 128)));
  const layout = spriteLayout(f, Number(columns) || 4);
  // Even frames spread across the whole clip.
  return { frames: f, columns: layout.columns, rows: layout.rows, size: cell - (cell % 2), fps: Math.round((f / seconds) * 1000) / 1000 };
}

export function spriteArgs(input: string, output: string, p: SpritePlan): string[] {
  const vf = `fps=${p.fps},scale=${p.size}:${p.size}:force_original_aspect_ratio=decrease,pad=${p.size}:${p.size}:(ow-iw)/2:(oh-ih)/2:color=black@0,format=rgba,tile=${p.columns}x${p.rows}:padding=0:margin=0:color=black@0`;
  return ["-v", "error", "-y", "-i", input, "-vf", vf, "-frames:v", "1", output];
}
