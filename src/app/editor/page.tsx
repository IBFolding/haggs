import type { Metadata } from "next";

import { EditorHome } from "./editor-home";

export const metadata: Metadata = { title: "Editor — haggs" };

export default function EditorPage() {
  return <EditorHome />;
}
