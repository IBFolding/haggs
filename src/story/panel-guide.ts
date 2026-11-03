/**
 * The editor's shot tools as an icon rail with a short walk-through: Prepare, Shape, Finish.
 * The guide only suggests; every group stays one click away, in any order.
 */

export type StepId = "prepare" | "shape" | "finish";
export type PanelTab = "shot" | "reshoot" | "voice" | "tools" | "sound" | "titles" | "review" | "passes";
export type GroupId = "timing" | "picture" | "reframe" | "caption" | "cut" | "continuity" | "look" | "reshoot" | "voice" | "edit" | "sound" | "titles" | "review" | "passes" | "more";
export type PanelMode = "simple" | "advanced";

export type Group = {
  id: GroupId;
  label: string;
  step: StepId;
  /** Shown in the Simple view; All tools shows every group. */
  simple: boolean;
  /** The panel tab this group lives in. Groups on the "shot" tab show one section at a time. */
  tab: PanelTab;
  /** One plain line saying what this group is for. */
  hint: string;
};

export const STEPS: { id: StepId; label: string }[] = [
  { id: "prepare", label: "Prepare" },
  { id: "shape", label: "Shape" },
  { id: "finish", label: "Finish" },
];

export const GROUPS: Group[] = [
  { id: "timing", label: "Timing", step: "prepare", simple: true, tab: "shot", hint: "How long the shot holds, and how it fades in and out." },
  { id: "picture", label: "Picture", step: "prepare", simple: true, tab: "shot", hint: "How the picture meets the frame, and its look." },
  { id: "reframe", label: "Reframe", step: "prepare", simple: false, tab: "shot", hint: "Move the frame across the picture over time." },
  { id: "caption", label: "Caption", step: "prepare", simple: true, tab: "shot", hint: "Words on screen for this shot." },
  { id: "cut", label: "Cut", step: "shape", simple: true, tab: "shot", hint: "Trim, split, bridge or remove this clip." },
  { id: "continuity", label: "Continuity", step: "shape", simple: false, tab: "shot", hint: "Keep the cast and place steady from shot to shot." },
  { id: "look", label: "Look", step: "shape", simple: true, tab: "shot", hint: "Camera, light and film look. Its words go into the prompt." },
  { id: "reshoot", label: "Reshoot", step: "shape", simple: false, tab: "reshoot", hint: "Make a new version of this shot from the footage, or block it out in grey." },
  { id: "edit", label: "Edit", step: "shape", simple: false, tab: "tools", hint: "Fix, swap or extend what is in the picture." },
  { id: "voice", label: "Voice", step: "finish", simple: true, tab: "voice", hint: "Voice-over lines for this shot." },
  { id: "sound", label: "Sound", step: "finish", simple: true, tab: "sound", hint: "Soundtrack, effects and the voice mix." },
  { id: "titles", label: "Titles", step: "finish", simple: true, tab: "titles", hint: "Words laid over the picture from the playhead." },
  { id: "review", label: "Review", step: "finish", simple: false, tab: "review", hint: "Notes and checks on this shot." },
  { id: "passes", label: "Passes", step: "finish", simple: false, tab: "passes", hint: "Draft and final generation passes." },
  { id: "more", label: "Roll", step: "finish", simple: true, tab: "shot", hint: "Roll again for a new take, or open the Grey Room." },
];

export const groupById = (id: GroupId): Group => GROUPS.find((g) => g.id === id)!;

/** The groups the rail shows. The open group always stays, so switching to Simple never closes what you are using. */
export function railFor(mode: PanelMode, open: GroupId): Group[] {
  return GROUPS.filter((g) => mode === "advanced" || g.simple || g.id === open);
}

/** The group a legacy tab opens (the first one that lives there). */
export function groupForTab(tab: PanelTab): GroupId {
  return GROUPS.find((g) => g.tab === tab)!.id;
}

/** The suggested next group: the first one in rail order that has not been opened yet. Null when all have been seen. */
export function suggestNext(visited: Iterable<GroupId>, rail: Group[], open: GroupId): GroupId | null {
  const seen = new Set(visited);
  seen.add(open);
  return rail.find((g) => !seen.has(g.id))?.id ?? null;
}

export type StepState = "done" | "current" | "todo";

/** Progress dots: a step is done once every group of it on the rail has been opened; the open group's step is current. */
export function stepProgress(visited: Iterable<GroupId>, rail: Group[], open: GroupId): { id: StepId; label: string; state: StepState; seen: number; total: number }[] {
  const seen = new Set(visited);
  seen.add(open);
  const current = groupById(open).step;
  return STEPS.map((s) => {
    const inStep = rail.filter((g) => g.step === s.id);
    const count = inStep.filter((g) => seen.has(g.id)).length;
    const finished = inStep.length > 0 && count === inStep.length;
    return { id: s.id, label: s.label, seen: count, total: inStep.length, state: s.id === current ? "current" : finished ? "done" : "todo" };
  });
}

/** The group after this one on the rail, for the "Next" button. Null at the end. */
export function groupAfter(open: GroupId, rail: Group[]): Group | null {
  const at = rail.findIndex((g) => g.id === open);
  return at >= 0 ? rail[at + 1] ?? null : rail[0] ?? null;
}
