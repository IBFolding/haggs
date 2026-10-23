import type { Metadata } from "next";

import { Locations } from "./locations";

export const metadata: Metadata = { title: "Locations — haggs" };

export default function LocationsPage() {
  return <Locations />;
}
