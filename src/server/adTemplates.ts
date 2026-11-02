/** Ready-made ad styles StoryPop advertisers can pick from. Prices are estimates until haggs publishes its table. */
export type AdTemplate = { id: string; label: string; description: string; aspect: "9:16" | "16:9" | "1:1"; length_s: number; est_credits: number; surface: "haggs" | "storypop"; thumb_url: string | null };

export const AD_TEMPLATES: AdTemplate[] = [
  { id: "product-hero", label: "Product hero shot", description: "The ad image: one product, lit like it matters.", aspect: "9:16", length_s: 0, est_credits: 20, surface: "haggs", thumb_url: null },
  { id: "influencer-camera", label: "Influencer to camera", description: "Handheld UGC: someone talks you into it.", aspect: "9:16", length_s: 15, est_credits: 90, surface: "haggs", thumb_url: null },
  { id: "product-placement", label: "Product placement", description: "Your product in a scene, revealed at the end.", aspect: "9:16", length_s: 15, est_credits: 80, surface: "haggs", thumb_url: null },
  { id: "product-360", label: "Product 360", description: "A slow orbit for the ad's last beat.", aspect: "9:16", length_s: 6, est_credits: 40, surface: "haggs", thumb_url: null },
  { id: "still-to-life", label: "Bring a still to life", description: "Your picture, moving.", aspect: "9:16", length_s: 8, est_credits: 35, surface: "haggs", thumb_url: null },
  { id: "ai-influencer", label: "AI influencer", description: "A consistent face for your brand.", aspect: "9:16", length_s: 15, est_credits: 100, surface: "haggs", thumb_url: null },
  { id: "sponsor-card", label: "Sponsor card", description: "5s “presented by” before a cliffhanger.", aspect: "9:16", length_s: 5, est_credits: 15, surface: "storypop", thumb_url: null },
  { id: "cast-avatar", label: "Cast an avatar", description: "A StoryPop fan avatar stars in your ad.", aspect: "9:16", length_s: 15, est_credits: 110, surface: "storypop", thumb_url: null }
];

export const templateById = (id: unknown): AdTemplate | undefined => AD_TEMPLATES.find((t) => t.id === id);
