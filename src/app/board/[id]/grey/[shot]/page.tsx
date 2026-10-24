import type { Metadata } from "next";

import { GreyStudio } from "./grey-studio";

export const metadata: Metadata = { title: "Grey Room — haggs" };

export default async function GreyPage({ params, searchParams }: { params: Promise<{ id: string; shot: string }>; searchParams: Promise<{ b?: string }> }) {
  const { id, shot } = await params;
  const { b } = await searchParams;
  return <GreyStudio id={id} shotId={shot} boardId={b} />;
}
