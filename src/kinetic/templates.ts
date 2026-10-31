import { DEFAULT_SHEET, parseSheet } from "./beats";

export type KineticTemplate = {
  id: string;
  name: string;
  description: string;
  sheet: string;
};

/** Complete, editable production sheets. Media names are intentional references the user fills with their own files. */
export const TEMPLATES: readonly KineticTemplate[] = [
  {
    id: "beat-launch",
    name: "Beat launch",
    description: "A fast word-led opener with a counter and a hard-driving finish.",
    sheet: DEFAULT_SHEET,
  },
  {
    id: "product-punch",
    name: "Product punch",
    description: "Two product angles, a price reveal and a direct call to action.",
    sheet: `bpm 140
# Replace the words, price and two picture references.
MEET YOUR NEXT | 2 | white
EVERYDAY OBJECT. | 2 | green
@image product | 3 | THE HERO | zoom 0.5 0.45 1.35
THE DETAILS | 2 | flip
@image detail | 3 | MADE TO BE USED | zoom 0.7 0.35 1.6
@count $49 | 3 | LAUNCH PRICE
MAKE IT YOURS. | 4 | invert
`,
  },
  {
    id: "app-demo",
    name: "App demo",
    description: "A problem/solution hook around one reusable screen recording.",
    sheet: `bpm 150
# Add one clip named app, then edit the words and result.
YOUR WORKFLOW | 2 | white
HAS TOO MANY STEPS. | 2 | red
WATCH THIS. | 2 | flip
@clip app | 4 | ONE FLOW. START TO FINISH. | zoom 0.55 0.45 1.25
NO BUSYWORK. | 2 | green
@count 12 | 3 | MINUTES SAVED
TRY IT TODAY. | 4 | invert
`,
  },
  {
    id: "stat-story",
    name: "Stat story",
    description: "A clean three-stat build for a report, milestone or case study.",
    sheet: `bpm 130
# Three editable proof points, no media required.
THE NUMBERS | 2 | white
TELL THE STORY. | 2 | green
@count 87% | 3 | FASTER DELIVERY
LESS FRICTION. | 2 | flip
@count 3.2 | 3 | TIMES THE OUTPUT
PROOF, NOT PROMISES. | 2 | white
@count 12000 | 4 | HAPPY CUSTOMERS
BUILD WHAT'S NEXT. | 4 | invert
`,
  },
];

/** Media required by the current sheet, once each, with a clear ready/missing state for the UI. */
export function referenceStates(sheet: string, available: readonly string[]) {
  const references: { name: string; kind: "image" | "clip"; ready: boolean }[] = [];
  for (const block of parseSheet(sheet).blocks) {
    if ((block.kind === "image" || block.kind === "clip") && !references.some((ref) => ref.name === block.name)) {
      references.push({ name: block.name, kind: block.kind, ready: available.includes(block.name) });
    }
  }
  return references;
}
