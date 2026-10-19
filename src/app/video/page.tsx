import type { Metadata } from "next";

import { Studio } from "../studio";

export const metadata: Metadata = { title: "Video — haggs" };

export default function VideoPage() {
  return <Studio surface="Video" />;
}
