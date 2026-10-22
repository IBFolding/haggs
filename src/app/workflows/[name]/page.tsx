import type { Metadata } from "next";

import { ImportWorkflow } from "./import";
import { WorkflowApp } from "./workflow-app";

export const metadata: Metadata = { title: "Workflow — haggs" };

export default async function WorkflowPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  return name === "import" ? <ImportWorkflow /> : <WorkflowApp name={decodeURIComponent(name)} />;
}
