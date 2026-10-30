import type { Metadata } from "next";
import { Suspense } from "react";

import { BuildWorkflow } from "../build";
import { ImportWorkflow } from "./import";
import { MyApp } from "./mine";
import { WorkflowApp } from "./workflow-app";

export const metadata: Metadata = { title: "Workflow — haggs" };

export default async function WorkflowPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  if (name === "import") return <ImportWorkflow />;
  if (name === "build") return <BuildWorkflow />;
  if (name === "mine") return <Suspense><MyApp /></Suspense>;
  return <WorkflowApp name={decodeURIComponent(name)} fixture={process.env.NODE_ENV !== 'production' && process.env.HAGGS_PORTAL_FIXTURE === '1' && decodeURIComponent(name) === 'haggs_fx_reuse_03-portal-paint'} />;
}
