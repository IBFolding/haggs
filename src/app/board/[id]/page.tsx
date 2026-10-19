import type { Metadata } from "next";

import { Board } from "../board";

export const metadata: Metadata = { title: "Board — haggs" };

export default async function BoardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Board id={id} />;
}
