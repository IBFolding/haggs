import type { Metadata } from "next";

import { Studio } from "../studio";

export const metadata: Metadata = { title: "Edit — haggs" };

export default function EditPage() {
  return <Studio surface="Edit" />;
}
