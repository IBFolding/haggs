import type { Metadata } from "next";
import { Suspense } from "react";

import { Characters } from "./characters";

export const metadata: Metadata = { title: "Characters — haggs" };

export default function CharactersPage() {
  return <Suspense><Characters /></Suspense>;
}
