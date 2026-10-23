import type { Metadata } from "next";

import { Found } from "./found";

export const metadata: Metadata = { title: "Found footage — haggs" };

export default function FoundPage() {
  return <Found />;
}
