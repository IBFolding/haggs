import type { Metadata } from "next";

import { PlayableHome } from "./home";

export const metadata: Metadata = { title: "Playable — haggs" };

export default function PlayablePage() {
  return <PlayableHome />;
}
