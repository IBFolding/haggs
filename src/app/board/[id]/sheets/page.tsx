import type { Metadata } from "next";

import { SheetsStudio } from "./sheets";

export const metadata: Metadata = { title: "Sheets — haggs" };

export default async function SheetsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SheetsStudio id={id} />;
}
