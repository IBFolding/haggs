import type { Metadata } from "next";

import { Comic } from "./comic";

export const metadata: Metadata = { title: "Comic strip — haggs" };

export default function ComicPage() {
  return <Comic />;
}
