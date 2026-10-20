import type { Metadata } from "next";

import { MediaTab } from "./media";

export const metadata: Metadata = { title: "Media — haggs" };

export default async function MediaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MediaTab id={id} />;
}
