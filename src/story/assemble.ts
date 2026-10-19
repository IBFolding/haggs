import type { Direction, Project, Shot } from "./model";

/**
 * A shot's prompt is derived, never stored.
 *
 * It has to be. A prompt that stands alone is a prompt that stops being true
 * the moment you move the shot: every shot inherits its opening state from the
 * one before it, so changing the order changes what each shot is continuing
 * from. Storing the text would leave you with prompts that quietly describe a
 * sequence you no longer have.
 *
 * Same inputs, same output — so the only thing that decides whether a render is
 * current is whether this function still produces the prompt it was made from.
 */

function join(parts: Array<string | undefined>): string {
  return parts.filter((part): part is string => Boolean(part?.trim())).join("\n");
}

export function assemble(
  shot: Shot,
  previous: Shot | undefined,
  direction: Direction,
): string {
  const craft: Direction = { ...direction, ...shot.direction };

  return join([
    shot.heading ? `${shot.heading}.` : undefined,
    shot.beat,
    previous
      ? `Continues from: ${previous.heading || "the shot before"} — ${previous.beat}. Keep the same characters, wardrobe, weather, screen direction and light direction.`
      : undefined,
    craft.camera ? `Camera: ${craft.camera}` : undefined,
    craft.light ? `Light: ${craft.light}` : undefined,
    craft.staging ? `Staging: ${craft.staging}` : undefined,
    craft.constants ? `Consistency: ${craft.constants}` : undefined,
  ]);
}

/** The prompt for the shot at `index`, in the order the project currently holds. */
export function promptFor(project: Project, index: number): string {
  const shot = project.shots[index];
  if (!shot) return "";
  return assemble(shot, index > 0 ? project.shots[index - 1] : undefined, project.direction);
}

/**
 * A small, stable, synchronous hash. Not a security primitive — it only has to
 * answer "is this the same text as last time", and it has to do it without
 * being async, because staleness is read during render.
 */
export function hashPrompt(prompt: string): string {
  let hash = 2166136261;
  for (let i = 0; i < prompt.length; i += 1) {
    hash ^= prompt.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

/**
 * Shots whose picture was made from a prompt the project no longer produces.
 *
 * Nothing is flagged or invalidated: a shot is stale exactly when the hash
 * stored on its render disagrees with the hash of its prompt now, so the
 * answer cannot drift out of step with the board. Locked shots are excluded —
 * locking is how you say a shot is finished and a reorder elsewhere must not
 * reopen it.
 */
export function staleShots(project: Project): string[] {
  return project.shots
    .filter((shot, index) => {
      if (!shot.render || shot.locked) return false;
      return shot.render.promptHash !== hashPrompt(promptFor(project, index));
    })
    .map((shot) => shot.id);
}
