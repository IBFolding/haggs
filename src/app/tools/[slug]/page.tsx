import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { videoTool } from "../../../tools/video-tools";
import { Nav } from "../../nav";
import { SiteFooter } from "../../site-footer";
import { ToolApp } from "./tool-app";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const tool = videoTool((await params).slug);
  return { title: tool ? `${tool.name} — haggs` : "Video tools — haggs" };
}

export default async function ToolPage({ params }: { params: Promise<{ slug: string }> }) {
  const tool = videoTool((await params).slug);
  if (!tool) notFound();
  return (
    <>
      <Nav current="Workflows" />
      <ToolApp tool={tool} />
      <SiteFooter />
    </>
  );
}
