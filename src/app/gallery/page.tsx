import type { Metadata } from "next";

import { Gallery } from "./gallery";

export const metadata: Metadata = { title: "Gallery — haggs" };

export default function GalleryPage() {
  return <Gallery />;
}
