/**
 * The fixes Check can make by itself. Each one is plain arithmetic or copying what is already on the sheets, so it never
 * calls a model and never costs anything; anything that needs judgement stays a link to the sheet it is on.
 */

import { fixCell, promptForShot, type Finding, type Sheets } from "./sheets";

export type Fix = { label: string; apply: (sheets: Sheets) => Sheets };

const FPS = 30;
const MIN = 0.5 * FPS;
const MAX = 15 * FPS;

/**
 * Every shot's length scaled so the reel runs exactly `target` seconds, on whole frames and inside 0.5–15s. Longer shots
 * take up the rounding first. Null when the shots can't reach it: too few to fill it, or too many to fit.
 */
export function fitRuntime(sheets: Sheets, target = sheets.seconds): Sheets | null {
  const shots = sheets.shots;
  const goal = Math.round(target * FPS);
  if (!shots.length || shots.length * MIN > goal || shots.length * MAX < goal) return null;
  const now = shots.reduce((n, s) => n + s.seconds * FPS, 0);
  const frames = shots.map((s) => Math.min(MAX, Math.max(MIN, Math.round(((s.seconds * FPS) / now) * goal))));
  const order = frames.map((_, i) => i).sort((a, b) => frames[b]! - frames[a]!);
  let off = goal - frames.reduce((n, f) => n + f, 0);
  while (off !== 0) {
    const step = Math.sign(off);
    let moved = false;
    for (const i of order) {
      if (off === 0) break;
      const next = frames[i]! + step;
      if (next < MIN || next > MAX) continue;
      frames[i] = next;
      off -= step;
      moved = true;
    }
    if (!moved) return null;
  }
  return { ...sheets, shots: shots.map((s, i) => ({ ...s, seconds: frames[i]! / FPS })) };
}

/** A shot's action cut back a sentence at a time until its prompt fits, then hard-cut if one sentence is still too long. */
export function trimAction(sheets: Sheets, shotId: string): Sheets {
  const shot = sheets.shots.find((s) => s.id === shotId);
  if (!shot) return sheets;
  const over = (action: string) => promptForShot(sheets, { ...shot, action }).length >= 4000;
  let action = shot.action;
  const sentences = action.match(/[^.!?]+[.!?]*\s*/g) ?? [action];
  while (sentences.length > 1 && over(action)) {
    sentences.pop();
    action = sentences.join("").trim();
  }
  while (action.length > 40 && over(action)) action = `${action.slice(0, Math.floor(action.length * 0.85)).trim()}…`;
  return action === shot.action ? sheets : fixCell(sheets, "shots", shotId, "action", action);
}

const join = (...parts: string[]) => parts.map((p) => p.trim().replace(/\.$/, "")).filter(Boolean).join(". ");

/** The fixes on offer for one finding, most likely first. Empty when it needs a person. */
export function fixesFor(sheets: Sheets, finding: Finding): Fix[] {
  switch (finding.code) {
    case "runtime": {
      const fitted = fitRuntime(sheets);
      const total = Math.round(sheets.shots.reduce((n, s) => n + s.seconds, 0) * FPS) / FPS;
      const target = Math.min(600, Math.max(5, Math.round(total)));
      return [
        ...(fitted ? [{ label: `Fit the shots to ${sheets.seconds}s`, apply: (s: Sheets) => fitRuntime(s) ?? s }] : []),
        ...(target !== sheets.seconds ? [{ label: `Make the target ${target}s`, apply: (s: Sheets) => fitRuntime({ ...s, seconds: target }) ?? { ...s, seconds: target } }] : []),
      ];
    }
    case "long-prompt":
      return [{ label: "Trim the action", apply: (s) => trimAction(s, finding.id) }];
    case "no-action": {
      const shot = sheets.shots.find((s) => s.id === finding.id);
      const scene = sheets.script.find((s) => s.id === shot?.sceneId);
      const beat = sheets.story.find((b) => b.id === shot?.beatId);
      const words = (scene?.action || beat?.feeling || "").slice(0, 600);
      return words ? [{ label: scene?.action ? "Use the scene's action" : "Use the beat's feeling", apply: (s) => fixCell(s, "shots", finding.id, "action", words) }] : [];
    }
    case "no-lock": {
      const c = sheets.characters.find((x) => x.id === finding.id);
      const lock = c ? join(c.age ? `${c.age} years old` : "", c.look, c.wardrobe) : "";
      return c && (c.look || c.wardrobe) ? [{ label: "Lock the look as written", apply: (s) => fixCell(s, "characters", c.id, "lock", lock) }] : [];
    }
    case "no-look": {
      const l = sheets.locations.find((x) => x.id === finding.id);
      return l && (l.look || l.light) ? [{ label: "Lock the look as written", apply: (s) => fixCell(s, "locations", l.id, "lock", join(l.look, l.light)) }] : [];
    }
    case "dialogue":
      return [{ label: "Hear it as sound only", apply: (s) => {
        const shot = s.shots.find((x) => x.id === finding.id);
        if (!shot) return s;
        return fixCell(fixCell(s, "shots", shot.id, "sound", join(shot.sound, `Voice: “${shot.dialogue.trim()}”`)), "shots", shot.id, "dialogue", "");
      } }];
    default:
      return [];
  }
}

/** Every fix Check can make at once: what "Fix what I can" does. */
export function fixAll(sheets: Sheets, findings: Finding[]): { sheets: Sheets; fixed: number } {
  let next = sheets;
  let fixed = 0;
  // Lengths last, so trimmed and filled shots are counted once their text is settled.
  const order = [...findings].filter((f) => f.code !== "dialogue").sort((a, b) => Number(a.code === "runtime") - Number(b.code === "runtime"));
  for (const finding of order) {
    // A target the shots can't reach is the person's call, not something to change for them.
    const [fix] = fixesFor(next, finding).filter((f) => finding.code !== "runtime" || f.label.startsWith("Fit"));
    if (!fix) continue;
    const after = fix.apply(next);
    if (after !== next) {
      next = after;
      fixed++;
    }
  }
  return { sheets: next, fixed };
}
