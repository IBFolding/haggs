/**
 * Starting points for a film: a few questions, then a full sheet to cut from. Each one follows a storyboard (what the
 * viewer should know at each moment), opens on words or a number so the first frame always works, and runs 12 to 60
 * seconds. What you type is shouted, kept short, and can't break the sheet.
 */

export type Field = { id: string; label: string; value: string; hint?: string; numeric?: boolean };
export type FilmTemplate = { id: string; name: string; blurb: string; fields: Field[]; build: (v: Record<string, string>) => string };

const shout = (s: string | undefined, fallback: string, max = 28): string => {
  const t = (s ?? "").replace(/[|\r\n]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
  return (t || fallback).toUpperCase();
};
/** For words inside a stack: no slashes either, since a slash separates the words. */
const plain = (s: string | undefined, fallback: string): string => shout((s ?? "").replace(/[/]/g, " "), fallback, 20);
/** A number the counter can read: 26, $0.07 or 99%. */
const number = (s: string | undefined, fallback: string): string => { const t = (s ?? "").trim(); return /^[$€£]?\d+(\.\d+)?%?$/.test(t) ? t : fallback; };
const url = (s: string | undefined, fallback: string): string => ((s ?? "").replace(/[|\r\n]+/g, "").trim().slice(0, 40) || fallback);

const F = (id: string, label: string, value: string, extra: Partial<Field> = {}): Field => ({ id, label, value, ...extra });

export const FILM_TEMPLATES: FilmTemplate[] = [
  {
    id: "launch", name: "Product launch", blurb: "Name, promise, three features, one number, a call to action.",
    fields: [F("product", "Product", "YOUR PRODUCT"), F("tagline", "The promise", "MAKE FILMS IN MINUTES"), F("f1", "Feature one", "FAST"), F("f2", "Feature two", "OPEN"), F("f3", "Feature three", "YOURS"), F("stat", "A number", "98%", { numeric: true, hint: "26, $0.07 or 98%" }), F("statLabel", "What it counts", "OF PEOPLE FINISH A FILM"), F("cta", "Call to action", "TRY IT FREE"), F("url", "Address", "yourproduct.com")],
    build: (v) => `bpm 130
${shout(v.product, "YOUR PRODUCT")} | 2 | flip
${shout(v.tagline, "MAKE FILMS IN MINUTES")} | 4 | white
@stack ${plain(v.f1, "FAST")} / ${plain(v.f2, "OPEN")} / ${plain(v.f3, "YOURS")} | 6 | green
@count ${number(v.stat, "98%")} | 3 | ${shout(v.statLabel, "OF PEOPLE FINISH A FILM", 34)}
ONE CLICK. | 2 | invert
NO CATCH. | 2 | white
${shout(v.cta, "TRY IT FREE")} | 4 | flip
${url(v.url, "yourproduct.com")} | 4 | white
`,
  },
  {
    id: "showreel", name: "Showreel", blurb: "Who you are, what you make, proof, and how to reach you.",
    fields: [F("name", "Your name", "YOUR NAME"), F("role", "What you do", "MOTION DESIGNER"), F("s1", "You make", "TITLES"), F("s2", "And", "LAUNCH FILMS"), F("s3", "And", "MUSIC VIDEOS"), F("claim", "Your line", "EVERY FRAME IS CODE."), F("n", "Projects shipped", "12", { numeric: true }), F("contact", "Contact", "hello@you.com")],
    build: (v) => `bpm 128
${shout(v.name, "YOUR NAME")} | 2 | flip
${shout(v.role, "MOTION DESIGNER")} | 4 | white
I MAKE | 2 | invert
@stack ${plain(v.s1, "TITLES")} / ${plain(v.s2, "LAUNCH FILMS")} / ${plain(v.s3, "MUSIC VIDEOS")} | 6 | green
${shout(v.claim, "EVERY FRAME IS CODE.")} | 4 | white
@count ${number(v.n, "12")} | 3 | PROJECTS SHIPPED
LET'S WORK. | 2 | red
${url(v.contact, "hello@you.com")} | 4 | flip
`,
  },
  {
    id: "features", name: "Feature list", blurb: "Five things, one per beat, then the close.",
    fields: [F("product", "Product", "YOUR PRODUCT"), F("f1", "One", "RUNS IN THE BROWSER"), F("f2", "Two", "WORKS WITH ANY TRACK"), F("f3", "Three", "EXPORTS TO VIDEO"), F("f4", "Four", "FREE TO TRY"), F("f5", "Five", "OPEN SOURCE"), F("closer", "The close", "ALL IN ONE PLACE."), F("cta", "Call to action", "START NOW")],
    build: (v) => `bpm 120
${shout(v.product, "YOUR PRODUCT")} | 2 | flip
HERE'S WHAT YOU GET. | 2 | white
${shout(v.f1, "RUNS IN THE BROWSER")} | 3 | green
${shout(v.f2, "WORKS WITH ANY TRACK")} | 3 | white
${shout(v.f3, "EXPORTS TO VIDEO")} | 3 | flip
${shout(v.f4, "FREE TO TRY")} | 3 | invert
${shout(v.f5, "OPEN SOURCE")} | 3 | green
${shout(v.closer, "ALL IN ONE PLACE.")} | 2 | white
${shout(v.cta, "START NOW")} | 4 | flip
`,
  },
  {
    id: "before-after", name: "Before and after", blurb: "The old way dies, the new way lands, one number backs it.",
    fields: [F("before", "The old way", "TEN TABS."), F("after", "The new way", "ONE APP."), F("claim", "The claim", "SAME RESULT. A TENTH OF THE WORK."), F("proof", "Percent proven", "90", { numeric: true }), F("proofLabel", "What it measures", "LESS WORK"), F("cta", "Call to action", "SEE FOR YOURSELF")],
    build: (v) => `bpm 112
BEFORE | 2 | red
${shout(v.before, "TEN TABS.")} | 4 | white
AFTER | 2 | flip
${shout(v.after, "ONE APP.")} | 4 | green
${shout(v.claim, "SAME RESULT. A TENTH OF THE WORK.", 40)} | 4 | invert
@bar ${number(v.proof, "90").replace(/[^0-9.]/g, "") || "90"} | 3 | ${shout(v.proofLabel, "LESS WORK", 30)}
${shout(v.cta, "SEE FOR YOURSELF")} | 4 | flip
`,
  },
  {
    id: "countdown", name: "Countdown", blurb: "Five reasons, five to one, best last.",
    fields: [F("topic", "The topic", "TOP 5 REASONS"), F("i5", "Number 5", "IT'S FAST"), F("i4", "Number 4", "IT'S FREE"), F("i3", "Number 3", "IT'S OPEN"), F("i2", "Number 2", "IT'S SIMPLE"), F("i1", "Number 1", "IT'S YOURS"), F("closer", "The close", "NOW GO MAKE ONE.")],
    build: (v) => `bpm 120
${shout(v.topic, "TOP 5 REASONS")} | 3 | flip
NUMBER 5 | 2 | invert
${shout(v.i5, "IT'S FAST")} | 3 | white
NUMBER 4 | 2 | invert
${shout(v.i4, "IT'S FREE")} | 3 | white
NUMBER 3 | 2 | invert
${shout(v.i3, "IT'S OPEN")} | 3 | white
NUMBER 2 | 2 | invert
${shout(v.i2, "IT'S SIMPLE")} | 3 | white
NUMBER 1 | 2 | flip
${shout(v.i1, "IT'S YOURS")} | 3 | green
${shout(v.closer, "NOW GO MAKE ONE.")} | 4 | invert
`,
  },
  {
    id: "manifesto", name: "Manifesto", blurb: "Five lines you stand behind, then your name.",
    fields: [F("l1", "Line one", "WE MAKE THINGS."), F("l2", "Line two", "WE SHOW OUR WORK."), F("l3", "Line three", "WE KEEP IT OPEN."), F("l4", "Line four", "WE SAY WHAT IT COSTS."), F("l5", "Line five", "WE SHIP."), F("name", "Signed", "YOUR TEAM")],
    build: (v) => `bpm 96
WE BELIEVE | 2 | flip
${shout(v.l1, "WE MAKE THINGS.")} | 3 | white
${shout(v.l2, "WE SHOW OUR WORK.")} | 3 | green
${shout(v.l3, "WE KEEP IT OPEN.")} | 3 | invert
${shout(v.l4, "WE SAY WHAT IT COSTS.")} | 3 | white
${shout(v.l5, "WE SHIP.")} | 3 | flip
${shout(v.name, "YOUR TEAM")} | 4 | green
`,
  },
  {
    id: "haggs", name: "haggs in 20 seconds", blurb: "The haggs launch film, words only. Add your own pictures and clips between the lines.",
    fields: [F("url", "Address", "haggs.vercel.app")],
    build: (v) => `bpm 178
COMFY | 2 | white
IS POWER. | 2 | green
BUT LOOK | 2 | white
AT THIS. | 2 | red
NO. | 2 | invert
ONE CLICK. | 2 | flip
HAGGS | 4 | green
UPLOAD | 2 | white
ANY COMFY | 2 | green
WORKFLOW. | 2 | white
GET AN APP. | 2 | flip
@count 13 | 3 | MODELS ON COMFY
@count 26 | 3 | READY-MADE APPS
@count $0.07 | 3 | A PICTURE. PRICE FIRST.
YOUR KEY. | 2 | white
YOUR GPU. | 2 | flip
OPEN WEIGHTS. | 2 | green
CLAUDE. | 2 | invert
CHATGPT. | 2 | white
OVER MCP. | 2 | flip
HAGGS. | 4 | invert
${url(v.url, "haggs.vercel.app")} | 4 | flip
`,
  },
];

export const filmDefaults = (t: FilmTemplate): Record<string, string> => Object.fromEntries(t.fields.map((f) => [f.id, f.value]));
export const buildFilm = (t: FilmTemplate, values: Record<string, string>): string => t.build(values);
