/**
 * The studio reel at the top of Explore: pictures and clips the haggs team made with haggs itself, so the page is alive
 * before anyone has shared anything. Static on purpose, like the curated Community entries. Community shares come
 * from the database and are shown below it, never mixed in.
 */

export type ShowcaseItem = { id: string; kind: "image" | "video"; src: string; poster?: string; alt: string; label: string };

/** WAYLIGHT: a short film made end to end in haggs. The stills are frames from its real takes; the reel is a 30 second cut of them. */
export const SHOWCASE_REEL: ShowcaseItem = {
  id: "waylight-sizzle",
  kind: "video",
  src: "/explore/waylight-sizzle.mp4",
  poster: "/explore/waylight-sizzle-poster.webp",
  alt: "A 30 second sizzle reel of WAYLIGHT, a sci-fi love story: a woman at a river, a rocket launch, a hand against frosted glass, Earth from orbit.",
  label: "WAYLIGHT, 30 second sizzle",
};

export const SHOWCASE: ShowcaseItem[] = [
  { id: "waylight-05", kind: "image", src: "/explore/waylight-05.webp", alt: "WAYLIGHT: a woman holding papers and a man beside a blue pickup outside a hardware store.", label: "WAYLIGHT · the meeting" },
  { id: "ad-halo", kind: "image", src: "/samples/ad-halo.webp", alt: "Product photo of a black desk lamp with a glowing halo ring on a dark background.", label: "Product photo · Ads" },
  { id: "waylight-22", kind: "image", src: "/explore/waylight-22.webp", alt: "WAYLIGHT: a rocket rising from a desert launch pad at dusk while a small crowd watches.", label: "WAYLIGHT · the launch" },
  { id: "clip-city", kind: "video", src: "/samples/clip-city.mp4", alt: "A rainy neon street at night with a cyclist in a yellow raincoat.", label: "Clip · Video" },
  { id: "waylight-13", kind: "image", src: "/explore/waylight-13.webp", alt: "WAYLIGHT: a woman laughing on a rocky river bank.", label: "WAYLIGHT · she laughs" },
  { id: "comic-noir", kind: "image", src: "/samples/comic-look-noir.webp", alt: "Comic panel in black, white and red: a woman on a rooftop looking at a stormy city skyline.", label: "Comic maker · Noir look" },
  { id: "waylight-51", kind: "image", src: "/explore/waylight-51.webp", alt: "WAYLIGHT: two people holding each other by a warm fireplace.", label: "WAYLIGHT · love returns" },
  { id: "place-diner", kind: "image", src: "/samples/place-diner.webp", alt: "A rainy-evening diner with red booths, a jukebox and a neon sign.", label: "Places" },
  { id: "waylight-42", kind: "image", src: "/explore/waylight-42.webp", alt: "WAYLIGHT: a hand reaching through drifting debris.", label: "WAYLIGHT · the breach" },
  { id: "clip-tea", kind: "video", src: "/samples/clip-tea.mp4", alt: "A short close-up clip of a cup of tea.", label: "Clip · Video" },
  { id: "waylight-15", kind: "image", src: "/explore/waylight-15.webp", alt: "WAYLIGHT: two people close together at night beside a telescope.", label: "WAYLIGHT · the waylight" },
  { id: "char-ines", kind: "image", src: "/samples/char-ines.webp", alt: "Portrait of a woman with glasses and a red jacket at a desk covered in maps.", label: "Characters" },
  { id: "waylight-34", kind: "image", src: "/explore/waylight-34.webp", alt: "WAYLIGHT: a web of light cracking across the sky over a dark town.", label: "WAYLIGHT · the lattice" },
  { id: "ad-ridge", kind: "image", src: "/samples/ad-ridge.webp", alt: "Product photo of a navy and orange trail running shoe on a light grey background.", label: "Product photo · Ads" },
  { id: "waylight-50", kind: "image", src: "/explore/waylight-50.webp", alt: "WAYLIGHT: a lone figure walking along a violet shore under a stormy sky.", label: "WAYLIGHT · the violet shore" },
  { id: "place-observatory", kind: "image", src: "/samples/place-observatory.webp", alt: "A domed observatory on a snowy ridge at sunset.", label: "Places" },
  { id: "waylight-53", kind: "image", src: "/explore/waylight-53.webp", alt: "WAYLIGHT: Earth seen from orbit.", label: "WAYLIGHT · a new world" },
  { id: "waylight-02", kind: "image", src: "/explore/waylight-02.webp", alt: "WAYLIGHT: a woman kneeling on a flat shore, digging in the sand.", label: "WAYLIGHT · the grave" },
];
