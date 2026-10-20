import type { Metadata } from "next";

import { MediaTab } from "./media";

export const metadata: Metadata = { title: "Media — haggs" };

export default async function MediaPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ b?: string }> }) {
  const { id } = await params;
  const { b } = await searchParams;
  return <MediaTab id={id} boardId={b} />;
}
