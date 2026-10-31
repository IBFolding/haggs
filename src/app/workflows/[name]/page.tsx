import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { indexOf } from "../../../server/comfy-library";
import { BuildWorkflow } from "../build";
import { ImportWorkflow } from "./import";
import { MyApp } from "./mine";
import { WorkflowApp } from "./workflow-app";
import { SceneForge } from "./scene-forge";
import { workflowRoute } from "./workflow-route";

export const metadata: Metadata = { title: "Workflow — haggs" };

export default async function WorkflowPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const decoded = decodeURIComponent(name);
  let route = workflowRoute(decoded, []);
  if (route === "not-found") route = workflowRoute(decoded, await indexOf(process.cwd()));
  if (route === "import") return <ImportWorkflow />;
  if (route === "build") return <BuildWorkflow />;
  if (route === "mine") return <Suspense><MyApp /></Suspense>;
  if (route === "scene-forge") return <SceneForge />;
  if (route === "not-found") notFound();
  return <WorkflowApp name={decoded} />;
}
