/** What a frame of play hands a template: held keys, a held pointer in world space, and a match swap. */
export type Input = {
  up?: boolean;
  down?: boolean;
  left?: boolean;
  right?: boolean;
  /** The primary action, held: jump in the runner. */
  action?: boolean;
  /** Where a finger or mouse is held, in world units; the collector walks towards it. */
  point?: { x: number; y: number } | null;
};

export type Status = "playing" | "won" | "lost";

/** Every template's world is drawn into this box and scaled to fit the canvas. */
export const WORLD = { w: 800, h: 450 } as const;

export type Box = { x: number; y: number; w: number; h: number };

export const overlaps = (a: Box, b: Box, give = 0) =>
  a.x + give < b.x + b.w - give && a.x + a.w - give > b.x + give && a.y + give < b.y + b.h - give && a.y + a.h - give > b.y + give;
