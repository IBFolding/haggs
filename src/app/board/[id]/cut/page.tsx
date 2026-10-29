import type { Metadata } from "next";

import { hosted } from "../../../../server/blob";

import { Editor } from "./editor";

export const metadata: Metadata = { title: "Cut — haggs" };

export default async function CutPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ b?: string; view?: string }> }) {
  const { id } = await params;
  const { b, view } = await searchParams;
  return <Editor id={id} boardId={b} classic={view === "classic"} renderEnabled={hosted() || process.env.NODE_ENV !== "production"} />;
}
