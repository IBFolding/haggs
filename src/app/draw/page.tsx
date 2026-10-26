import type { Metadata } from "next";

import { Draw } from "./draw";

export const metadata: Metadata = { title: "Draw to video — haggs" };

export default function DrawPage() {
  return <Draw />;
}
