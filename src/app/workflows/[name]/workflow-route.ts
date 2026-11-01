import type { Entry } from "../../../server/comfy-library";

export type WorkflowRoute = "import" | "build" | "mine" | "scene-forge" | "app" | "not-found";
/** A final decision for a workflow URL: what workflowRoute says, or "unavailable" when a missing name cannot be proven because the catalog did not answer. */
export type WorkflowDecision = WorkflowRoute | "unavailable";

/** The marker an unavailable catalog error carries, so the workflow error boundary recognizes it. */
export const WORKFLOW_CATALOG_DOWN = "WORKFLOW_CATALOG_DOWN";

/** Resolve public workflow URLs before authentication or runtime connection gates. */
export function workflowRoute(name: string, entries: readonly Pick<Entry, "name">[]): WorkflowRoute {
  if (name === "import") return "import";
  if (name === "build") return "build";
  if (name === "mine") return "mine";
  if (name === "haggs_scene_forge") return "scene-forge";
  return entries.some((entry) => entry.name === name) ? "app" : "not-found";
}

/**
 * Only a catalog that answered can prove a name does not exist. When it did
 * not (a cold start meeting an outage), an unknown name becomes an
 * "unavailable" state instead of a 404; reserved and known routes pass through.
 */
export function workflowDecision(name: string, entries: readonly Pick<Entry, "name">[], catalogLive: boolean): WorkflowDecision {
  const route = workflowRoute(name, entries);
  return route === "not-found" && !catalogLive ? "unavailable" : route;
}

/** The error a workflow page throws when the catalog cannot say whether the name exists. */
export function catalogDownError(): Error & { digest: string } {
  return Object.assign(new Error("The workflow library could not be reached."), { digest: WORKFLOW_CATALOG_DOWN });
}
