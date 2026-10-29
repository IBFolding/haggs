import type { AdFormat } from "./ads";
import type { NewBrandKit } from "./brand";

/** Ready-made brands and products to try the Ads page with: one tap fills everything in. */
/** `product.picture` is a product photo made with ChatGPT, so the sample's ads have a real product to keep. */
export type Sample = { id: string; label: string; brand: NewBrandKit; product: { name: string; words: string; picture?: string }; formats: AdFormat["id"][]; audiences: string[] };

export const SAMPLES: Sample[] = [
  {
    id: "kiln", label: "Kiln & Co. mug",
    brand: { name: "Kiln & Co.", url: "", logo: null, colors: ["#d9532b", "#faf6f0", "#1a1a1a"], fonts: ["DM Serif Display"], about: "Small-batch stoneware mugs, thrown by hand in Portland.", tone: "warm, handmade, a little playful" },
    product: { name: "Ember mug", words: "a speckled terracotta stoneware mug with a thumb handle and a matte cream glaze inside", picture: "/samples/ad-ember.webp" },
    formats: ["product", "poster"], audiences: ["students on a budget", "new parents"],
  },
  {
    id: "northwind", label: "Northwind running shoe",
    brand: { name: "Northwind", url: "", logo: null, colors: ["#0b3d91", "#ff6a13", "#f2f4f8"], fonts: ["Space Grotesk"], about: "Lightweight trail running shoes for people who run before work.", tone: "energetic, direct, no fluff" },
    product: { name: "Ridge 3 trail shoe", words: "a lightweight navy blue trail running shoe with an orange sole, mesh upper and chunky grip", picture: "/samples/ad-ridge.webp" },
    formats: ["social", "story"], audiences: ["early-morning commuters", "first-time trail runners"],
  },
  {
    id: "lumen", label: "Lumen desk lamp",
    brand: { name: "Lumen", url: "", logo: null, colors: ["#f5c542", "#22252b", "#ffffff"], fonts: ["Inter"], about: "Minimal desk lamps that make late-night work feel calm.", tone: "calm, modern, quietly confident" },
    product: { name: "Halo desk lamp", words: "a slim matte black desk lamp with a circular warm-white light ring on an adjustable arm", picture: "/samples/ad-halo.webp" },
    formats: ["product", "marketplace"], audiences: ["remote workers", "night-shift nurses"],
  },
];
