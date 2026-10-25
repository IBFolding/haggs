import type { Metadata } from "next";

import { Doctor } from "./doctor";

// A long film takes a minute to read.
export const maxDuration = 300;

export const metadata: Metadata = { title: "Sizzle doctor — haggs" };

export default function DoctorPage() {
  return <Doctor />;
}
