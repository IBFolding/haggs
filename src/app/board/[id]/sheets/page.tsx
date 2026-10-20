import type { Metadata } from "next";

import { SheetsStudio } from "./sheets";

export const metadata: Metadata = { title: "Sheets — haggs" };

export default async function SheetsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ b?: string }> }) {
  const { id } = await params;
  const { b } = await searchParams;
  return <SheetsStudio id={id} boardId={b} />;
}
