import type { Metadata } from "next";

import { Editor } from "./editor";

export const metadata: Metadata = { title: "Cut — haggs" };

export default async function CutPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Editor id={id} />;
}
