import type { Metadata } from "next";

import { Suspense } from "react";

import { Swap } from "./swap";

export const metadata: Metadata = { title: "Swap a character — haggs" };

export default function SwapPage() {
  return <Suspense><Swap /></Suspense>;
}
