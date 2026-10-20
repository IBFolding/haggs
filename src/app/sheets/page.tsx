import type { Metadata } from "next";

import { SheetsStudio } from "./sheets";

export const metadata: Metadata = {
  title: "Script sheets — haggs",
};

export default function SheetsPage() {
  return <SheetsStudio />;
}
