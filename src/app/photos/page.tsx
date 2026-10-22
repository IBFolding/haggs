import type { Metadata } from "next";

import { Studio } from "../studio";

export const metadata: Metadata = { title: "Photos — haggs" };

export default function PhotosPage() {
  return <Studio surface="Create" />;
}
