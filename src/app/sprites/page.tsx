import type { Metadata } from "next";

import { Sprites } from "./sprites";

export const maxDuration = 120;

export const metadata: Metadata = { title: "Sprite sheet — haggs" };

export default function SpritesPage() {
  return <Sprites />;
}
