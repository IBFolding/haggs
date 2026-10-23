import type { Metadata } from "next";

import { Recreate } from "./recreate";

export const metadata: Metadata = { title: "Recreate an edit — haggs" };

export default function RecreatePage() {
  return <Recreate />;
}
