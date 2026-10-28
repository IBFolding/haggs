import { Bricolage_Grotesque, JetBrains_Mono } from "next/font/google";

import "./playable.css";

/**
 * Playable carries the rebuild's type and colour on its own pages, so it ships
 * from main without waiting on the UI rebuild. The variable names match the
 * rebuild's root layout; once that lands this layout can drop the fonts.
 */
const bricolage = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-bricolage", display: "swap" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains", display: "swap" });

export default function PlayableLayout({ children }: { children: React.ReactNode }) {
  return <div className={`pl-root ${bricolage.variable} ${jetbrains.variable}`}>{children}</div>;
}
