import { parseScreenplay } from "./screenplay";
import { addBeat, addShot, buildSheets, type Sheets } from "./sheets";

/**
 * Formats: where the beats of a hit go, by kind of show.
 *
 * Each beat has a window in seconds and a job. Starting from a format gives a
 * board the right shape before a word is written — the AI writer fills the
 * windows from your idea, and every beat stays yours to move, cut or add to.
 * Runtimes are the screen time a format actually gets (a "30-minute" comedy
 * runs about 22 minutes once ads are out).
 */

export type FormatBeat = { title: string; at: number; until: number; job: string };
export type Format = {
  id: string;
  label: string;
  group: "Half-hour" | "Hour" | "Vertical" | "Short";
  seconds: number;
  aspect: "16:9" | "9:16";
  /** What the writer is told about the form, in one line. */
  form: string;
  beats: FormatBeat[];
};

const m = (minutes: number) => Math.round(minutes * 60);

export const FORMATS: Format[] = [
  {
    id: "comedy-30", label: "Comedy · 30 min", group: "Half-hour", seconds: m(22), aspect: "16:9",
    form: "Single-camera half-hour comedy: an A story and a B story that collide, jokes that come from character, a small change by the end.",
    beats: [
      { title: "Cold open", at: 0, until: m(2.5), job: "A self-contained runner that shows who they are and lands a laugh in the first 20 seconds." },
      { title: "Inciting incident", at: m(2.5), until: m(5.5), job: "Something upsets the normal and hands the lead a want." },
      { title: "The bad plan", at: m(5.5), until: m(8), job: "The lead commits to a plan we can see will go wrong. Act out on the commitment." },
      { title: "Complications", at: m(8), until: m(13), job: "The plan meets reality; the B story starts crossing the A story; every scene escalates." },
      { title: "Midpoint turn", at: m(13), until: m(15), job: "A reveal flips what the lead thought they wanted." },
      { title: "Low point", at: m(15), until: m(18), job: "The plan collapses and the cost is personal. The laugh gets quieter here." },
      { title: "Climax", at: m(18), until: m(20.5), job: "The lead chooses differently; the biggest comic set piece; A and B resolve together." },
      { title: "Tag", at: m(20.5), until: m(22), job: "One last laugh; the world is back to normal, slightly changed." },
    ],
  },
  {
    id: "animation-30", label: "Animation · 30 min", group: "Half-hour", seconds: m(22), aspect: "16:9",
    form: "Half-hour animated comedy: a clear want, visual gags that escalate past what live action can do, and a real heart beat before the end.",
    beats: [
      { title: "Cold open gag", at: 0, until: m(1.5), job: "A visual gag only animation can do, setting the tone." },
      { title: "The want", at: m(1.5), until: m(4), job: "The lead wants something specific and visual." },
      { title: "The plan", at: m(4), until: m(7), job: "A scheme with a gadget, a disguise or a rule-break. Act out on launching it." },
      { title: "Escalating gags", at: m(7), until: m(12), job: "Each attempt bigger and more absurd than the last; the world reacts." },
      { title: "Big set piece", at: m(12), until: m(15), job: "The largest visual sequence of the episode." },
      { title: "Reversal", at: m(15), until: m(18), job: "It backfires; the lead loses what they had." },
      { title: "Heart moment", at: m(18), until: m(20.5), job: "A quiet, honest beat that earns the ending." },
      { title: "Button", at: m(20.5), until: m(22), job: "A final gag that calls back to the cold open." },
    ],
  },
  {
    id: "dramedy-30", label: "Dramedy · 30 min", group: "Half-hour", seconds: m(25), aspect: "16:9",
    form: "Half-hour dramedy: laughs and pain in the same scene, one character's emotional problem driving every turn.",
    beats: [
      { title: "Cold open", at: 0, until: m(2), job: "Funny and a little sad at once; show the wound without naming it." },
      { title: "The want", at: m(2), until: m(5), job: "A practical goal that hides the emotional one." },
      { title: "Act one break", at: m(5), until: m(8), job: "A choice that commits them to the episode." },
      { title: "Funny-sad escalation", at: m(8), until: m(14), job: "Each scene funnier on the surface and truer underneath." },
      { title: "Midpoint vulnerability", at: m(14), until: m(17), job: "The mask slips in front of someone who matters." },
      { title: "Low point", at: m(17), until: m(21), job: "The real problem lands; nobody is joking." },
      { title: "Honest climax", at: m(21), until: m(24), job: "They say the true thing, imperfectly." },
      { title: "Tag", at: m(24), until: m(25), job: "A small laugh that lets the audience breathe." },
    ],
  },
  {
    id: "romance-30", label: "Romance · 30 min", group: "Half-hour", seconds: m(24), aspect: "16:9",
    form: "Half-hour romance: two people, one obstacle between them, chemistry in every exchange.",
    beats: [
      { title: "Meet-cute", at: 0, until: m(3), job: "They meet badly, memorably, with a spark neither admits." },
      { title: "The obstacle", at: m(3), until: m(6), job: "Why they can't, or shouldn't." },
      { title: "Forced together", at: m(6), until: m(10), job: "Circumstance keeps putting them in the same room." },
      { title: "First real moment", at: m(10), until: m(14), job: "They see each other honestly for the first time." },
      { title: "Almost", at: m(14), until: m(17), job: "Nearly a kiss, nearly a confession; interrupted." },
      { title: "The complication", at: m(17), until: m(20), job: "The obstacle returns, bigger, and one of them pulls away." },
      { title: "The gesture", at: m(20), until: m(23), job: "Someone risks being embarrassed for love." },
      { title: "Together, for now", at: m(23), until: m(24), job: "A warm ending with a hook for what's next." },
    ],
  },
  {
    id: "drama-60", label: "Drama · 60 min", group: "Hour", seconds: m(44), aspect: "16:9",
    form: "One-hour drama: a teaser and five acts, each act ending on a cliffhanger that makes leaving impossible.",
    beats: [
      { title: "Teaser", at: 0, until: m(3), job: "Open on a mystery, a threat or a striking image; end on a question." },
      { title: "Act one", at: m(3), until: m(12), job: "Set the problem and the stakes. Act out on a question the audience needs answered." },
      { title: "Act two", at: m(12), until: m(22), job: "Escalate; the first plan fails. Act out on a reversal." },
      { title: "Act three", at: m(22), until: m(32), job: "The midpoint truth changes the game. Act out on a crisis." },
      { title: "Act four", at: m(32), until: m(40), job: "Consequences land; the lead must decide. Act out on the decision." },
      { title: "Act five", at: m(40), until: m(44), job: "Resolve this episode's question and open a bigger one: the cliffhanger." },
    ],
  },
  {
    id: "dramedy-60", label: "Dramedy · 60 min", group: "Hour", seconds: m(48), aspect: "16:9",
    form: "Hour-long dramedy: an ensemble whose comedy and grief share every scene, with a heartfelt ending.",
    beats: [
      { title: "Cold open", at: 0, until: m(3), job: "A funny scene with a sting at the end." },
      { title: "Act one", at: m(3), until: m(13), job: "Each lead gets a want; act out on a complication." },
      { title: "Act two", at: m(13), until: m(24), job: "Stories cross; laughs build; act out on a hard truth." },
      { title: "Act three", at: m(24), until: m(35), job: "Someone breaks; the comedy turns. Act out on a loss." },
      { title: "Act four", at: m(35), until: m(45), job: "They show up for each other." },
      { title: "Tag", at: m(45), until: m(48), job: "A laugh through tears, and a hook." },
    ],
  },
  {
    id: "romance-60", label: "Romance · 60 min", group: "Hour", seconds: m(44), aspect: "16:9",
    form: "One-hour romantic drama: a slow burn with real stakes outside the relationship.",
    beats: [
      { title: "Teaser", at: 0, until: m(3), job: "A charged first glance or a memory of one." },
      { title: "Act one", at: m(3), until: m(12), job: "Meet, clash, and the obstacle. Act out on being thrown together." },
      { title: "Act two", at: m(12), until: m(22), job: "Grudging respect becomes attraction. Act out on an almost." },
      { title: "Act three", at: m(22), until: m(32), job: "They give in; it's wonderful. Act out on the secret surfacing." },
      { title: "Act four", at: m(32), until: m(40), job: "The world tears them apart." },
      { title: "Act five", at: m(40), until: m(44), job: "The grand choice, and a hook that it isn't over." },
    ],
  },
  {
    id: "vertical-drama", label: "Vertical drama · episode", group: "Vertical", seconds: 90, aspect: "9:16",
    form: "Vertical micro-drama episode (one of many): hook in the first three seconds, a twist mid-episode, and a cliffhanger that makes the next episode a must.",
    beats: [
      { title: "Hook", at: 0, until: 3, job: "A shocking line, slap, reveal or image. No setup." },
      { title: "Situation", at: 3, until: 15, job: "Who, where and what they want, fast, through conflict." },
      { title: "Conflict", at: 15, until: 40, job: "Humiliation, betrayal or desire pushes the lead to the edge." },
      { title: "Twist", at: 40, until: 60, job: "A hidden identity, power or secret flips the scene." },
      { title: "Escalation", at: 60, until: 80, job: "The twist makes things worse before better." },
      { title: "Cliffhanger", at: 80, until: 90, job: "Cut on the moment of maximum suspense." },
    ],
  },
  {
    id: "vertical-comedy", label: "Vertical comedy", group: "Vertical", seconds: 60, aspect: "9:16",
    form: "Vertical comedy short: one premise, a hook in the first second, a punchline and a button.",
    beats: [
      { title: "Hook", at: 0, until: 3, job: "The funniest image or line first." },
      { title: "Setup", at: 3, until: 15, job: "The premise, clearly, in one beat." },
      { title: "Escalation", at: 15, until: 40, job: "Three turns, each more absurd." },
      { title: "Punchline", at: 40, until: 52, job: "The payoff the setup promised, landing on a reaction." },
      { title: "Button", at: 52, until: 60, job: "One more laugh, ideally one that loops." },
    ],
  },
  {
    id: "vertical-animation", label: "Vertical animation", group: "Vertical", seconds: 60, aspect: "9:16",
    form: "Vertical animated short: a striking visual hook, a character with one want, gags that only animation can do, and a loopable ending.",
    beats: [
      { title: "Visual hook", at: 0, until: 3, job: "An image that stops the scroll." },
      { title: "The want", at: 3, until: 12, job: "One character, one want, shown not told." },
      { title: "Gag escalation", at: 12, until: 40, job: "Attempts that grow bigger and stranger." },
      { title: "Visual payoff", at: 40, until: 52, job: "The biggest, most beautiful moment." },
      { title: "Loop", at: 52, until: 60, job: "End where it can start again." },
    ],
  },
  {
    id: "sizzle-120", label: "Sizzle reel · 2 min", group: "Short", seconds: 120, aspect: "16:9",
    form: "A sizzle reel or trailer that sells a series: tone first, leads second, stakes third, and a title on a promise.",
    beats: [
      { title: "Open on the world", at: 0, until: 15, job: "Tone and scale in a few images." },
      { title: "Meet the leads", at: 15, until: 40, job: "Who we follow and why we love them." },
      { title: "Inciting", at: 40, until: 55, job: "The event that changes everything." },
      { title: "Stakes rise", at: 55, until: 85, job: "What can be lost, building fast." },
      { title: "The ride", at: 85, until: 105, job: "A montage of the best moments, without spoilers." },
      { title: "Title and promise", at: 105, until: 120, job: "Title card and one last hook." },
    ],
  },
];

export const formatById = (id: string) => FORMATS.find((f) => f.id === id);

/**
 * The format laid out with no AI: one placeholder scene and beat per format
 * beat, each beat carrying its job so the writer — the person — knows what it
 * is for. A short format's windows are filled with shots of up to five
 * seconds so the reel already runs to length; a long one gets one shot per
 * beat to start from.
 */
export function layoutFormat(format: Format, idea: string, title: string): Sheets {
  const script = format.beats.map((b, i) => `BEAT ${i + 1} — ${b.title.toUpperCase()}\n\n${b.job}`).join("\n\n");
  let sheets = buildSheets([parseScreenplay(`FADE IN:\n\n${script}\n`, { episode: 1 })], {
    title: title.trim() || "Untitled",
    seconds: format.seconds,
    format: format.aspect,
    logline: idea.trim(),
  });
  format.beats.forEach((b, i) => {
    const scene = sheets.script[i]!;
    sheets = addBeat(sheets, { title: b.title, sceneIds: [scene.id], feeling: b.job });
    const beatId = sheets.story.at(-1)!.id;
    const length = b.until - b.at;
    const pieces = format.seconds <= 180 ? Math.ceil(length / 5) : 1;
    for (let p = 0; p < pieces; p++) {
      const seconds = format.seconds <= 180 ? Math.min(5, length - p * 5) : Math.min(15, length);
      const action = `${b.title}: ${b.job}${idea.trim() ? ` — ${idea.trim()}` : ""}`.slice(0, 600);
      sheets = addShot(sheets, beatId, { seconds, action, dialogue: "" });
    }
  });
  return sheets;
}
