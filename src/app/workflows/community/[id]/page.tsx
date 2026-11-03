import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { STUDIO_SAMPLES, THIRD_PARTY_WORKFLOWS, communityEntry } from "../../../../community/curated";
import { CommunityApp } from "./community-app";

export const dynamicParams = false;
export const generateStaticParams = () => [...STUDIO_SAMPLES.map((s) => ({ id: s.id })), ...THIRD_PARTY_WORKFLOWS.map((w) => ({ id: w.id }))];

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const entry = communityEntry((await params).id);
  const title = !entry ? "Community app" : entry.kind === "sample" ? entry.sample.title : entry.workflow.name;
  return { title: `${title} — haggs` };
}

export default async function CommunityAppPage({ params }: { params: Promise<{ id: string }> }) {
  const entry = communityEntry((await params).id);
  if (!entry) notFound();
  return <CommunityApp entry={entry} />;
}
