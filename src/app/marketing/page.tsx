import type { Metadata } from "next";

import { Marketing } from "./marketing";

export const metadata: Metadata = { title: "Marketing studio — haggs" };

export default function MarketingPage() {
  return <Marketing />;
}
