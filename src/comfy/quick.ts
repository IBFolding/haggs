import type { Canvas, CNode } from "./canvas";

/**
 * Ready-made apps: the jobs people come to do (swap a person, replace a
 * background, relight, upscale, bring a photo to life), each already wired.
 * One click opens it as a simple form; the canvas is one tap away to change it.
 */

export const GROUPS = ["Make something", "Swap and faces", "Fashion", "Product and ads", "Photo tools", "Video tools"] as const;
export type Group = (typeof GROUPS)[number];
/**
 * The only ready-made apps that run entirely on open weights, checked against
 * Comfy Cloud's node catalog (a node flagged api_node calls a partner's paid
 * API) on 2026-10-23. Everything else uses at least one partner model.
 */
const OPEN_WEIGHTS = new Set(["template_purz_wan22_animate_auto_character_replace", "image_qwen_image_edit_2509_relight", "utility_z_image_turbo_2k_upscaler.app", "templates_liveportrait.app"]);
export const isOpenApp = (a: QuickApp) => a.canvas.nodes.length > 0 && a.canvas.nodes.every((n) => n.kind === "library" && OPEN_WEIGHTS.has(n.template ?? ""));

export type QuickApp = { id: string; group: Group; name: string; says: string; makes: "image" | "video"; canvas: Canvas };

const at = (i: number): { x: number; y: number } => ({ x: 40 + i * 290, y: 40 });
const step = (i: number, kind: Exclude<CNode["kind"], "library">, extra: Partial<CNode> = {}): CNode => ({ id: `n${i + 1}`, kind, ...at(i), ...extra });
const lib = (template: string): Canvas["nodes"] => [{ id: "n1", kind: "library", template, ...at(0) }];
const canvas = (name: string, nodes: CNode[], links: Canvas["links"] = []): Canvas => ({ name, nodes, links });
const chain = (nodes: CNode[]): Canvas["links"] => nodes.slice(1).map((n, i) => ({ from: nodes[i]!.id, to: n.id }));

export const QUICK_APPS: QuickApp[] = [
  { id: "swap-person", group: "Swap and faces", name: "Swap a person in a video", says: "Drop a video and a photo. The person in the video becomes the person in the photo.", makes: "video", canvas: canvas("Swap a person in a video", lib("template_purz_wan22_animate_auto_character_replace")) },
  { id: "swap-person-pro", group: "Swap and faces", name: "Swap a person, keep the whole performance", says: "Same motion, camera and sound; a new face and body from your photo.", makes: "video", canvas: (() => { const n = [step(0, "video-in"), { ...step(1, "picture-in"), y: 300 }, step(2, "recast")]; return canvas("Swap a person, keep the performance", n, [{ from: "n1", to: "n3" }, { from: "n2", to: "n3" }]); })() },
  { id: "replace-background", group: "Video tools", name: "Replace a video's background", says: "Drop a video and a picture of where it should be.", makes: "video", canvas: canvas("Replace a video's background", lib("api_bria_video_replace_background")) },
  { id: "remove-background", group: "Video tools", name: "Cut out a video's background", says: "Drop a video and get the person on a clean solid colour.", makes: "video", canvas: canvas("Cut out a video's background", lib("api_bria_remove_video_background")) },
  { id: "relight", group: "Photo tools", name: "Relight a photo", says: "Change the light on a photo and keep everything else.", makes: "image", canvas: canvas("Relight a photo", lib("image_qwen_image_edit_2509_relight")) },
  { id: "upscale", group: "Photo tools", name: "Make a photo sharper and bigger", says: "Drop a photo and get a 2K version.", makes: "image", canvas: canvas("Upscale a photo", lib("utility_z_image_turbo_2k_upscaler.app")) },
  { id: "restyle-photo", group: "Photo tools", name: "Restyle a photo from another", says: "Drop a photo and a picture of the look you want it in.", makes: "image", canvas: canvas("Restyle a photo", lib("api_magnific_image_style_transfer")) },
  { id: "remove-object", group: "Photo tools", name: "Remove something from a photo", says: "Paint over what shouldn't be there and it's gone.", makes: "image", canvas: canvas("Remove something from a photo", lib("api_bria_eraser")) },
  { id: "product-in-hand", group: "Product and ads", name: "Put your product in someone's hand", says: "Drop your product and a photo of a person; they're holding it.", makes: "image", canvas: canvas("Product in hand", lib("templates-subject_product_swap.app")) },
  { id: "lip-sync", group: "Swap and faces", name: "Lip-sync a video to any voice", says: "Drop a video and the audio. The mouth follows the words.", makes: "video", canvas: canvas("Lip-sync a video", lib("api_sync_so_lip_sync_video")) },
  { id: "upscale-video", group: "Video tools", name: "Make a video sharper and bigger", says: "Drop a video and get a higher-resolution version.", makes: "video", canvas: canvas("Upscale a video", lib("api_wavespeed_flshvsr_video_upscale")) },
  { id: "fill-in", group: "Photo tools", name: "Paint something into a photo", says: "Mark an area, say what belongs there, and it's filled in.", makes: "image", canvas: canvas("Paint into a photo", lib("api_bria_genfill")) },
  { id: "widen", group: "Photo tools", name: "Widen a photo", says: "Drop a photo and extend it past its edges to any shape.", makes: "image", canvas: canvas("Widen a photo", lib("api_bria_expand_image")) },
  { id: "green-screen", group: "Video tools", name: "Put a video's subject on green", says: "Drop a video and get the person on a green screen, ready for any background.", makes: "video", canvas: canvas("Green screen", lib("api_bria_video_green_screen")) },
  { id: "try-on", group: "Fashion", name: "Try an outfit on a person", says: "Drop a photo of a person and a garment; they're wearing it.", makes: "image", canvas: canvas("Try on an outfit", lib("api_kling_vto")) },
  { id: "flat-lay", group: "Fashion", name: "Flat lay to a studio photoshoot", says: "Drop a person and a flat-lay of clothes; get a studio shoot.", makes: "image", canvas: canvas("Flat lay to photoshoot", lib("templates-fashion_shoot_vton")) },
  { id: "editorial", group: "Fashion", name: "Fashion editorial shots", says: "A person, a place and a product become a set of editorial frames.", makes: "image", canvas: canvas("Fashion editorial", lib("templates-2x2_grid-character_bg_product")) },
  { id: "outfit-portrait", group: "Fashion", name: "Put an outfit on a portrait", says: "Dress the person in a portrait in clothes from another picture.", makes: "image", canvas: canvas("Outfit on a portrait", lib("template_eric_seedance_5_subject_and_outfit_combine")) },
  { id: "fashion-video", group: "Fashion", name: "Character and outfit to a fashion video", says: "A person and an outfit become a short fashion clip.", makes: "video", canvas: canvas("Fashion video", lib("templates-stitched_vid_contact_sheet")) },
  { id: "product-sequence", group: "Product and ads", name: "Product ad, cinematic sequence", says: "Drop your product and a look; get a cinematic ad sequence.", makes: "image", canvas: canvas("Product ad sequence", lib("template_sferro21_product_ad.app")) },
  { id: "product-grid", group: "Product and ads", name: "Product ad grid, nine shots", says: "One product photo becomes a 3×3 grid of ad frames.", makes: "image", canvas: canvas("Product ad grid", lib("templates-9grid_social_media-v2.0")) },
  { id: "swap-ad", group: "Product and ads", name: "Put your product in an ad you like", says: "Drop an ad and your product; yours replaces theirs.", makes: "image", canvas: canvas("Swap product into an ad", lib("templates-product_ad-v2.0")) },
  { id: "ugc-hand", group: "Product and ads", name: "UGC: a person holding your product", says: "Drop a person and your product; they're holding it, phone-camera style.", makes: "image", canvas: canvas("UGC product shot", lib("templates-subject_holding_product.app")) },
  { id: "mockups", group: "Product and ads", name: "Poster scene mockups", says: "Drop a poster and see it in four real scenes.", makes: "image", canvas: canvas("Poster mockups", lib("templates-poster_to_2x2_mockups-v2.0")) },
  { id: "photodump", group: "Make something", name: "Photo dump from one photo", says: "One photo becomes a set of consistent candid shots.", makes: "image", canvas: canvas("Photo dump", lib("templates-multiple_consistent_shots-nb_pro")) },
  { id: "talking-image", group: "Swap and faces", name: "Make a portrait speak your audio", says: "Drop a portrait and a voice recording; it talks.", makes: "video", canvas: canvas("Talking portrait", lib("api_sync_so_talking_image")) },
  { id: "expression", group: "Swap and faces", name: "Copy a facial expression", says: "Drop a portrait and a video of a face; the portrait performs it.", makes: "video", canvas: canvas("Copy an expression", lib("templates_liveportrait.app")) },
  { id: "photo-to-clip", group: "Make something", name: "Bring a photo to life", says: "Drop a photo, say how it moves, get a short clip with sound.", makes: "video", canvas: (() => { const n = [step(0, "picture-in"), step(1, "animate", { prompt: "Slow push-in, natural motion, the light shifts gently", seconds: 5 })]; return canvas("Bring a photo to life", n, chain(n)); })() },
  { id: "product-ad", group: "Product and ads", name: "Product photo to an ad clip", says: "Drop a product shot. It's restaged, then animated into a short ad.", makes: "video", canvas: (() => { const n = [step(0, "picture-in"), step(1, "edit-picture", { prompt: "Place the product on wet black slate, low-key rim light, moody" }), step(2, "animate", { prompt: "Slow push-in, light glints across the surface", seconds: 6 })]; return canvas("Product to ad", n, chain(n)); })() },
  { id: "talking-photo", group: "Make something", name: "Make a photo talk", says: "Drop a portrait and type what they say. It moves and speaks.", makes: "video", canvas: (() => { const n = [step(0, "picture-in"), step(1, "animate", { prompt: "The person looks at the camera and speaks naturally, small head movements", seconds: 5 }), step(2, "speak", { prompt: "Hello. Tell me what I missed." })]; return canvas("Make a photo talk", n, chain(n)); })() },
  { id: "poster", group: "Make something", name: "A picture from words", says: "Describe it and get a cinematic still.", makes: "image", canvas: canvas("A picture from words", [step(0, "make-picture", { prompt: "A lighthouse at dusk, storm clouds breaking, cinematic film still" })]) },
];

export const quickById = (id: string) => QUICK_APPS.find((a) => a.id === id);
