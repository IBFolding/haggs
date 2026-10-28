import type { Metadata } from "next";

import { Studio } from "./studio";

export const metadata: Metadata = { title: "Playable — haggs" };

export default async function PlayableGamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Studio id={id} />;
}
