import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { catalogLive, indexOf, type Entry } from "../../../server/comfy-library";
import { BuildWorkflow } from "../build";
import { ImportWorkflow } from "./import";
import { MyApp } from "./mine";
import { WorkflowApp } from "./workflow-app";
import { SceneForge } from "./scene-forge";
import { catalogDownError, workflowDecision, type WorkflowDecision } from "./workflow-route";

export const metadata: Metadata = { title: "Workflow — haggs" };

export default async function WorkflowPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const decoded = decodeURIComponent(name);
  // Reserved and bundled routes answer without the catalog; only then is the
  // full catalog consulted, and only a live catalog's silence may stand
  // between a name and its page.
  let decision: WorkflowDecision = workflowDecision(decoded, [], catalogLive(process.cwd()));
  if (decision === "not-found" || decision === "unavailable") {
    const entries: Entry[] = await indexOf(process.cwd());
    decision = workflowDecision(decoded, entries, catalogLive(process.cwd()));
  }
  if (decision === "unavailable") throw catalogDownError();
  if (decision === "import") return <ImportWorkflow />;
  if (decision === "build") return <BuildWorkflow />;
  if (decision === "mine") return <Suspense><MyApp /></Suspense>;
  if (decision === "scene-forge") return <SceneForge />;
  if (decision === "not-found") notFound();
  return <WorkflowApp name={decoded} />;
}
