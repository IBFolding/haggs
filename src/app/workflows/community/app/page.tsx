import type { Metadata } from "next";
import { Suspense } from "react";

import { CommunityRun } from "./run";

export const metadata: Metadata = { title: "Community app — haggs" };

export default function CommunityAppPage() {
  return <Suspense><CommunityRun /></Suspense>;
}
