import type { Metadata } from "next";

import { Accessories } from "./accessories";

export const metadata: Metadata = { title: "Accessories — haggs" };

export default function AccessoriesPage() {
  return <Accessories />;
}
