import type { Metadata } from "next";

import { Board } from "../board";

export const metadata: Metadata = { title: "Board — haggs" };

export default async function BoardPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ b?: string }> }) {
  const { id } = await params;
  const { b } = await searchParams;
  return <Board id={id} boardId={b} />;
}
