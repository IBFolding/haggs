import type { Metadata } from "next";

import { Creator } from "./creator";

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }): Promise<Metadata> {
  const { handle } = await params;
  return { title: `@${decodeURIComponent(handle)} — haggs` };
}

export default async function CreatorPage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  return <Creator handle={decodeURIComponent(handle)} />;
}
