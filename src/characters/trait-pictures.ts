import { TRAIT_ROWS } from "./character";

/**
 * A picture for each character trait choice, so a person is built by sight: the same person shown each way, made with
 * ChatGPT as one grid per trait and cut into tiles. Height has no picture; it is drawn (see `HEIGHT_SCALE`). Colours
 * (skin, hair colour, eyes) are swatches instead.
 */
export const PICTURED = ["gender", "build", "hairStyle", "hairLength", "face", "facialHair", "glasses", "look"] as const;
export type PicturedRow = (typeof PICTURED)[number];

/** The file for one choice: `/traits/{row}-{choice}.webp`, the choice written with dashes. */
export const traitPicture = (row: string, option: string): string => `/traits/${row}-${option.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.webp`;

/** Every pictured choice, in its row's order. */
export function picturedChoices(): { row: PicturedRow; option: string; src: string }[] {
  return PICTURED.flatMap((row) => (TRAIT_ROWS.find((r) => r.id === row)?.options ?? []).map((option) => ({ row, option, src: traitPicture(row, option) })));
}

/** How tall each height choice is drawn, against a doorway of 1. */
export const HEIGHT_SCALE: Record<string, number> = { short: 0.68, "below average height": 0.75, "average height": 0.82, tall: 0.9, "very tall": 0.98 };

export const TRAIT_PICTURES_BY = "Pictures made with ChatGPT";

/** The same for places: `/places/{row}-{choice}.webp`. Time of day stays a sky swatch. */
export const PLACE_PICTURED = ["where", "setting", "weather", "season", "era", "mood"] as const;
export const placePicture = (row: string, option: string): string => `/places/${row}-${option.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.webp`;
