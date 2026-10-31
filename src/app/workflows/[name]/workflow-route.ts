import type { Entry } from "../../../server/comfy-library";

export type WorkflowRoute = "import" | "build" | "mine" | "scene-forge" | "app" | "not-found";

/** Resolve public workflow URLs before authentication or runtime connection gates. */
export function workflowRoute(name: string, entries: readonly Pick<Entry, "name">[]): WorkflowRoute {
  if (name === "import") return "import";
  if (name === "build") return "build";
  if (name === "mine") return "mine";
  if (name === "haggs_scene_forge") return "scene-forge";
  return entries.some((entry) => entry.name === name) ? "app" : "not-found";
}
