import type { Metadata } from "next";

import { Explore } from "./explore";

export const metadata: Metadata = { title: "Explore — haggs" };

export default function ExplorePage() {
  return <Explore />;
}
