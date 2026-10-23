import type { Metadata } from "next";

import { Academy } from "./academy";

export const metadata: Metadata = { title: "Academy — haggs" };

export default function AcademyPage() {
  return <Academy />;
}
