/**
 * Styles: a look described in plain words, with a style sheet (a picture of
 * the look) that goes to Comfy beside the footage. Turning live action into
 * animation keeps the motion, camera and performance and changes only how
 * everything is drawn.
 */

export type Style = { id: string; name: string; says: string; words: string };

export const STYLES: Style[] = [
  { id: "cel-anime", name: "Cel anime", says: "Hand-drawn cel animation with clean ink lines.", words: "cel-shaded 2D anime, clean ink outlines, flat colour fills with one soft shadow tone, painterly sky backgrounds, subtle film grain" },
  { id: "painted-feature", name: "Painted feature", says: "Soft hand-painted backgrounds and gentle character shading.", words: "hand-painted animated feature film, gouache backgrounds with visible brush texture, soft rounded character design, warm natural light, gentle shading" },
  { id: "stylised-3d", name: "Animated 3D", says: "A glossy stylised 3D family-film look.", words: "stylised 3D animated feature, expressive rounded characters, soft subsurface skin, rich saturated colour, cinematic depth of field, global illumination" },
  { id: "storybook", name: "Storybook watercolour", says: "Watercolour and ink, like a picture book.", words: "watercolour and ink storybook illustration, loose pencil linework, paper texture, bleeding pigment edges, muted warm palette" },
  { id: "ink-comic", name: "Ink comic", says: "Heavy black ink and halftone, like a graphic novel.", words: "graphic-novel ink illustration, heavy black linework, halftone shading, limited spot colour, dramatic hatching" },
  { id: "rotoscope", name: "Rotoscope", says: "Traced live action, vivid and a little wobbly.", words: "rotoscoped animation, traced outlines that boil slightly frame to frame, flat vivid colour blocks, hand-animated feel" },
  { id: "clay", name: "Claymation", says: "Sculpted clay, stop-motion lit.", words: "stop-motion claymation, sculpted clay characters with visible thumbprints, miniature handmade sets, practical studio lighting, slight frame stutter" },
  { id: "scribble", name: "Scribble", says: "Loose crayon and marker on white paper.", words: "hand-drawn scribble animation, loose marker and crayon lines on white paper, bold flat colour streaks, wobbly outlines, sketchbook feel" },
  { id: "pixel-art", name: "Pixel art", says: "Chunky 16-bit sprites.", words: "retro 16-bit pixel art, chunky visible pixels, limited bright palette, dithering, sprite-style characters and tiles" },
  { id: "mixed-media", name: "Mixed media", says: "Live action collaged with drawn and painted parts.", words: "mixed-media animation, live-action textures collaged with hand-drawn ink and painted shapes, paper cut-outs, saturated colour accents" },
  { id: "neon-anime", name: "Neon night anime", says: "Rain, neon and heavy contrast.", words: "night-city anime film, neon signage glow, wet reflective streets, deep blue shadows, bold magenta and cyan highlights, detailed linework" },
];

export const styleById = (id: string) => STYLES.find((s) => s.id === id);

/** What to tell the video model: change how it is drawn, not what happens. */
export function restylePrompt(style: Style, extra = ""): string {
  const more = extra.trim() ? ` ${extra.trim().replace(/[.\s]+$/, "")}.` : "";
  return `Redraw this footage as ${style.words}. Keep exactly the same motion, the same camera, the same performances, timing, composition and characters; change only how everything is drawn, to match the style reference.${more}`;
}

/** A picture of the look alone: palette, line, texture and a few sample forms. */
export function styleSheetPrompt(style: Style): string {
  return `Animation style sheet: ${style.words}. Show the look on a single board: a colour palette strip, a close-up of the line and texture, a character head and shoulders, a hand, a tree, and a building, all drawn in this one style. Cohesive, no text, no logos, no watermark.`;
}
