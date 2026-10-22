/**
 * Starting points for Create and Video: the shots people come to a studio
 * like this to make, written as prompts with the parts to make your own in
 * [brackets]. Picking one fills the composer and selects the first bracket.
 */

export type Template = {
  id: string;
  surface: "Create" | "Video";
  name: string;
  /** One line: what you get. */
  blurb: string;
  prompt: string;
  /** Starts from a picture you attach (a product, a face, a still). */
  fromPicture?: boolean;
  /** The aspect it is usually made in, when the model offers it. */
  aspect?: "16:9" | "9:16" | "1:1" | "4:5";
};

export const TEMPLATES: Template[] = [
  {
    id: "ai-influencer",
    surface: "Create",
    name: "AI influencer",
    blurb: "A consistent person for a feed, photographed like a real one.",
    prompt: "Candid lifestyle photo of [a 26-year-old woman with copper curls and light freckles] [laughing over coffee in a sunlit café], natural skin texture, phone-camera realism, soft window light, shallow depth of field.",
    aspect: "4:5",
  },
  {
    id: "character-sheet",
    surface: "Create",
    name: "Character sheet",
    blurb: "Front, three-quarter and profile — save it as their face.",
    prompt: "Character reference sheet of [a weathered fisherman in his sixties, grey beard, yellow oilskin]: front, three-quarter and profile views side by side, neutral expression, same outfit in every view, plain grey background, even studio light.",
    aspect: "16:9",
  },
  {
    id: "product-hero",
    surface: "Create",
    name: "Product hero shot",
    blurb: "The ad image: one product, lit like it matters.",
    prompt: "Studio product photograph of [a matte black bottle of cold brew] on [a wet slate slab], dramatic rim light, fine water droplets, dark background, 85mm, crisp focus on the label.",
    aspect: "4:5",
  },
  {
    id: "storyboard-frame",
    surface: "Create",
    name: "Storyboard frame",
    blurb: "A film still for a board, ready to animate.",
    prompt: "Cinematic film still: [a young woman in a red coat] [stops on an empty platform as the last train leaves] in [a snowy mountain station at dusk], 35mm anamorphic, soft film grain, practical light.",
    aspect: "16:9",
  },
  {
    id: "location-plate",
    surface: "Create",
    name: "Location",
    blurb: "An empty establishing plate — save it as a place.",
    prompt: "Wide establishing shot of [a small desert town at dusk, neon motel sign, one road out], no people, cinematic 35mm, natural haze, the look of a feature film.",
    aspect: "16:9",
  },
  {
    id: "key-art",
    surface: "Create",
    name: "Poster key art",
    blurb: "The poster, with room left for the title.",
    prompt: "Movie poster key art for [a lighthouse-keeper ghost story]: [a lone figure on the rocks under a sweeping beam], moody storm light, strong silhouette, empty space at the top for the title, no text.",
    aspect: "4:5",
  },
  {
    id: "ugc-talking",
    surface: "Video",
    name: "Influencer to camera",
    blurb: "Handheld UGC: someone talks you into it.",
    prompt: "Handheld selfie video: [a woman in her twenties with a messy bun] talks excitedly to camera about [the vitamin C serum she's holding], natural daylight in [her bathroom], small genuine gestures, vertical phone footage, authentic UGC feel.",
    aspect: "9:16",
  },
  {
    id: "product-placement",
    surface: "Video",
    name: "Product placement",
    blurb: "Your product in a scene, never the subject until the end.",
    prompt: "[The cold brew bottle in the picture] sits naturally on [a sunny kitchen counter] while [a man makes breakfast] in the background; slow push-in that ends on the product, soft morning light. Keep the product exactly as it is in the picture.",
    fromPicture: true,
    aspect: "16:9",
  },
  {
    id: "product-orbit",
    surface: "Video",
    name: "Product 360",
    blurb: "A slow orbit for a product page or an ad's last beat.",
    prompt: "Slow 360-degree orbit around [the product in the picture] on a turntable, studio lighting, [black] background, crisp moving reflections. Keep the product exactly as it is.",
    fromPicture: true,
    aspect: "1:1",
  },
  {
    id: "animate-still",
    surface: "Video",
    name: "Bring a still to life",
    blurb: "Your picture, moving. Faces and framing stay put.",
    prompt: "Bring the picture to life: [a light breeze moves her hair; she turns to camera and smiles]. Very slow push-in. Keep the faces, clothes and everything in frame the same.",
    fromPicture: true,
    aspect: "16:9",
  },
  {
    id: "establishing-drone",
    surface: "Video",
    name: "Drone establishing",
    blurb: "Open a film or an episode from the air.",
    prompt: "Slow aerial drone push over [a misty pine valley at dawn] toward [a lone cabin with smoke rising from its chimney], volumetric light through the trees, cinematic.",
    aspect: "16:9",
  },
  {
    id: "dolly-zoom",
    surface: "Video",
    name: "Dolly zoom moment",
    blurb: "The Vertigo shot, for the instant someone realises.",
    prompt: "Dolly zoom on [a man in a grey suit] as he realises [he's being followed] in [a half-empty subway car]; the background stretches away while his face stays the same size. Tense fluorescent light.",
    aspect: "16:9",
  },
];

export const templatesFor = (surface: string) => TEMPLATES.filter((t) => t.surface === surface);

/** Where the first [bracketed] part is, brackets included, so it can be selected for typing over. */
export function slotIn(prompt: string): { start: number; end: number } | null {
  const start = prompt.indexOf("[");
  if (start < 0) return null;
  const end = prompt.indexOf("]", start);
  return end < 0 ? null : { start, end: end + 1 };
}
