import type { Media, Shot } from "./model";
import { takesOf } from "./takes";

/** Only cards actually shown under this shot can stand in for its take controls. */
export function shotFootage(shot: Shot, shownMedia: readonly Media[]) {
  const own = shownMedia.filter(m => m.shotId === shot.id);
  const takes = takesOf(shot);
  return {
    own,
    takes: takes.filter(t => !own.some(m => m.url === t.url)),
    showRender: Boolean(shot.render && !own.some(m => m.url === shot.render!.url) && !takes.some(t => t.url === shot.render!.url)),
  };
}
