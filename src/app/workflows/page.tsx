import type { Metadata } from "next";

import { Workflows } from "./workflows";

export const metadata: Metadata = { title: "Workflows — haggs" };

export default function WorkflowsPage() {
  return <Workflows />;
}
