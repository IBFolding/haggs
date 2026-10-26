import type { Shot } from "./model";
/** Approval changes the prompt only; media and prior versions remain intact. */
export function applyReviewFix(shot: Shot, noteId: string): Shot {
  const note = shot.review?.find(n => n.id === noteId && n.shotId === shot.id);
  if (!note || note.status !== "approved" || !note.fix.trim()) return shot;
  return {...shot, beat: `${shot.beat}\n\nReview fix: ${note.fix.trim()}`.trim(), review: shot.review!.map(n => n.id === noteId ? {...n, status:"applied"} : n)};
}
