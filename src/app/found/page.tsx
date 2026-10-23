import type { Metadata } from "next";

import { Found } from "./found";

// Keeping a scene downloads a film of up to 120 MB, so the actions behind this page may run for minutes.
export const maxDuration = 300;

export const metadata: Metadata = { title: "Found footage — haggs" };

export default function FoundPage() {
  return <Found />;
}
