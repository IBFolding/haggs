import type { Project, Shot, Take } from "./model";

/**
 * Takes: every version a shot has had, kept, so rolling again never throws
 * away the last one and the editor can flip between them.
 *
 * `render` stays the single answer to "what is on this shot" — the board, the
 * cut and staleness all read it — and the takes list is the shelf it was
 * chosen from.
 */

const id = () => "take-" + crypto.randomUUID().slice(0, 8);

export function takesOf(shot: Shot): Take[] {
  if (shot.takes?.length) return shot.takes;
  return shot.render ? [{ id: "take-first", ...shot.render }] : [];
}

/** Adds a new take and puts it on the shot. */
export function addTake(shot: Shot, render: NonNullable<Shot["render"]>, origin?: string): Shot {
  const take: Take = { id: id(), ...render, ...(origin ? { origin } : {}) };
  return { ...shot, takes: [...takesOf(shot), take], render };
}

const asRender = ({ url, kind, usd, promptHash, at }: Take) => ({ url, kind, usd, promptHash, at });

export function chooseTake(shot: Shot, takeId: string): Shot {
  const take = takesOf(shot).find((t) => t.id === takeId);
  if (!take) throw new Error("That take is not on this shot any more.");
  return { ...shot, takes: takesOf(shot), render: asRender(take) };
}

export function toggleFavorite(shot: Shot, takeId: string): Shot {
  return { ...shot, takes: takesOf(shot).map((t) => (t.id === takeId ? { ...t, favorite: !t.favorite } : t)) };
}

/** The next or previous take, wrapping round — the editor's quick flip. */
export function cycleTake(shot: Shot, step: 1 | -1): Shot {
  const takes = takesOf(shot);
  if (takes.length < 2) return shot;
  const at = Math.max(0, takes.findIndex((t) => t.url === shot.render?.url && t.at === shot.render?.at));
  return chooseTake(shot, takes[(at + step + takes.length) % takes.length]!.id);
}

export function removeTake(shot: Shot, takeId: string): Shot {
  const takes = takesOf(shot);
  const gone = takes.find((t) => t.id === takeId);
  const rest = takes.filter((t) => t.id !== takeId);
  const wasOn = gone && gone.url === shot.render?.url && gone.at === shot.render?.at;
  const { render: _old, ...without } = shot;
  if (!rest.length) return { ...without, takes: [] };
  return { ...shot, takes: rest, render: wasOn ? asRender(rest[0]!) : shot.render! };
}

/** Splits a shot at `at` seconds into two shots of the same footage. */
export function splitShot(project: Project, shotId: string, at: number): Project {
  const index = project.shots.findIndex((s) => s.id === shotId);
  const shot = project.shots[index];
  if (!shot) throw new Error("That shot is not on the board any more.");
  const length = shot.seconds ?? 5;
  if (!(at > 0 && at < length)) throw new Error("Split inside the shot, not at its start or end.");
  const first: Shot = { ...shot, seconds: Math.round(at * 30) / 30 };
  const { sheetShotId: _linked, ...rest } = shot;
  const second: Shot = { ...rest, id: crypto.randomUUID(), seconds: Math.round((length - at) * 30) / 30, trimIn: (shot.trimIn ?? 0) + at };
  const shots = [...project.shots];
  shots.splice(index, 1, first, second);
  return { ...project, shots };
}

const MIN_SHOT = 0.2;

/** Cuts the start of a shot off at `at` seconds into it: the footage now starts later and the shot is shorter. */
export function trimHead(project: Project, shotId: string, at: number): Project {
  const shot = project.shots.find((s) => s.id === shotId);
  if (!shot) throw new Error("That shot is not on the board any more.");
  const length = shot.seconds ?? 5;
  if (!(at > 0 && length - at >= MIN_SHOT)) throw new Error(`Leave at least ${MIN_SHOT}s of the shot.`);
  const round = (n: number) => Math.round(n * 30) / 30;
  return { ...project, shots: project.shots.map((s) => (s.id === shotId ? { ...s, trimIn: round((s.trimIn ?? 0) + at), seconds: round(length - at) } : s)) };
}

/** Cuts the end of a shot off at `at` seconds into it. */
export function trimTail(project: Project, shotId: string, at: number): Project {
  const shot = project.shots.find((s) => s.id === shotId);
  if (!shot) throw new Error("That shot is not on the board any more.");
  const length = shot.seconds ?? 5;
  if (!(at >= MIN_SHOT && at < length)) throw new Error(`Leave at least ${MIN_SHOT}s of the shot.`);
  return { ...project, shots: project.shots.map((s) => (s.id === shotId ? { ...s, seconds: Math.round(at * 30) / 30 } : s)) };
}
