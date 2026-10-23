import type { Metadata } from "next";

import { SeriesMaker } from "./series-maker";

export const metadata: Metadata = { title: "Series — haggs" };

export default function SeriesPage() {
  return <SeriesMaker />;
}
