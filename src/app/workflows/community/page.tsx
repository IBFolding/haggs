import type { Metadata } from "next";

import { Shelf } from "./shelf";

export const metadata: Metadata = { title: "Community apps — haggs" };

export default function CommunityPage() {
  return <Shelf />;
}
