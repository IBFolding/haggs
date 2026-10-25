import type { Metadata } from "next";

import { Ads } from "./ads";

export const metadata: Metadata = { title: "Ads — haggs" };

export default function AdsPage() {
  return <Ads />;
}
