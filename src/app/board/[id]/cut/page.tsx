import type { Metadata } from "next";

import { Editor } from "./editor";

export const metadata: Metadata = { title: "Cut — haggs" };

export default async function CutPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ b?: string }> }) {
  const { id } = await params;
  const { b } = await searchParams;
  return <Editor id={id} boardId={b} />;
}
