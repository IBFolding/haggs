import type { Metadata } from "next";

import { Kinetic } from "./kinetic";

export const metadata: Metadata = { title: "Kinetic film — haggs" };

export default function KineticPage() {
  return <Kinetic />;
}
