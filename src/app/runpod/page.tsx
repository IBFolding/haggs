import type { Metadata } from "next";
import { RunpodStudio } from "./studio";
export const metadata: Metadata = { title: "RunPod Serverless — haggs" };
export default function Page() {
  return <RunpodStudio />;
}
