import type { Entry } from "../server/comfy-library";
import type { StepKind } from "./recipe";

/**
 * Other ways to do a step: library workflows that take the same things and
 * make the same thing, so a step can be swapped for any of them (open
 * weights or partner) without rewiring.
 */

/** Comfy names workflows that call a partner API "api_…"; the rest run on open weights. */
export const isOpen = (e: Pick<Entry, "name">) => !e.name.startsWith("api_");

export function alternativesFor(kind: StepKind | "library", library: Entry[]): Entry[] {
  const media = (e: Entry) => new Set(e.inputs.map((i) => i.media));
  const fits = (e: Entry): boolean => {
    const m = media(e);
    switch (kind) {
      case "make-picture": return e.kind === "image" && m.size === 0;
      case "edit-picture": return e.kind === "image" && m.has("image") && !m.has("video");
      case "animate": return e.kind === "video" && m.has("image") && !m.has("video");
      case "recast": return e.kind === "video" && m.has("video") && m.has("image");
      default: return false;
    }
  };
  return library.filter(fits).sort((a, b) => b.usage - a.usage);
}
