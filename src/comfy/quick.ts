import type { Canvas, CNode } from "./canvas";

/**
 * Ready-made apps: the jobs people come to do (swap a person, replace a
 * background, relight, upscale, bring a photo to life), each already wired.
 * One click opens it as a simple form; the canvas is one tap away to change it.
 */

export type QuickApp = { id: string; name: string; says: string; makes: "image" | "video"; canvas: Canvas };

const at = (i: number): { x: number; y: number } => ({ x: 40 + i * 290, y: 40 });
const step = (i: number, kind: Exclude<CNode["kind"], "library">, extra: Partial<CNode> = {}): CNode => ({ id: `n${i + 1}`, kind, ...at(i), ...extra });
const lib = (template: string): Canvas["nodes"] => [{ id: "n1", kind: "library", template, ...at(0) }];
const canvas = (name: string, nodes: CNode[], links: Canvas["links"] = []): Canvas => ({ name, nodes, links });
const chain = (nodes: CNode[]): Canvas["links"] => nodes.slice(1).map((n, i) => ({ from: nodes[i]!.id, to: n.id }));

export const QUICK_APPS: QuickApp[] = [
  { id: "swap-person", name: "Swap a person in a video", says: "Drop a video and a photo. The person in the video becomes the person in the photo.", makes: "video", canvas: canvas("Swap a person in a video", lib("template_purz_wan22_animate_auto_character_replace")) },
  { id: "swap-person-pro", name: "Swap a person, keep the whole performance", says: "Same motion, camera and sound; a new face and body from your photo.", makes: "video", canvas: (() => { const n = [step(0, "video-in"), { ...step(1, "picture-in"), y: 300 }, step(2, "recast")]; return canvas("Swap a person, keep the performance", n, [{ from: "n1", to: "n3" }, { from: "n2", to: "n3" }]); })() },
  { id: "replace-background", name: "Replace a video's background", says: "Drop a video and a picture of where it should be.", makes: "video", canvas: canvas("Replace a video's background", lib("api_bria_video_replace_background")) },
  { id: "remove-background", name: "Cut out a video's background", says: "Drop a video and get the person on a clean solid colour.", makes: "video", canvas: canvas("Cut out a video's background", lib("api_bria_remove_video_background")) },
  { id: "relight", name: "Relight a photo", says: "Change the light on a photo and keep everything else.", makes: "image", canvas: canvas("Relight a photo", lib("image_qwen_image_edit_2509_relight")) },
  { id: "upscale", name: "Make a photo sharper and bigger", says: "Drop a photo and get a 2K version.", makes: "image", canvas: canvas("Upscale a photo", lib("utility_z_image_turbo_2k_upscaler.app")) },
  { id: "restyle-photo", name: "Restyle a photo from another", says: "Drop a photo and a picture of the look you want it in.", makes: "image", canvas: canvas("Restyle a photo", lib("api_magnific_image_style_transfer")) },
  { id: "remove-object", name: "Remove something from a photo", says: "Paint over what shouldn't be there and it's gone.", makes: "image", canvas: canvas("Remove something from a photo", lib("api_bria_eraser")) },
  { id: "product-in-hand", name: "Put your product in someone's hand", says: "Drop your product and a photo of a person; they're holding it.", makes: "image", canvas: canvas("Product in hand", lib("templates-subject_product_swap.app")) },
  { id: "lip-sync", name: "Lip-sync a video to any voice", says: "Drop a video and the audio. The mouth follows the words.", makes: "video", canvas: canvas("Lip-sync a video", lib("api_sync_so_lip_sync_video")) },
  { id: "photo-to-clip", name: "Bring a photo to life", says: "Drop a photo, say how it moves, get a short clip with sound.", makes: "video", canvas: (() => { const n = [step(0, "picture-in"), step(1, "animate", { prompt: "Slow push-in, natural motion, the light shifts gently", seconds: 5 })]; return canvas("Bring a photo to life", n, chain(n)); })() },
  { id: "product-ad", name: "Product photo to an ad clip", says: "Drop a product shot. It's restaged, then animated into a short ad.", makes: "video", canvas: (() => { const n = [step(0, "picture-in"), step(1, "edit-picture", { prompt: "Place the product on wet black slate, low-key rim light, moody" }), step(2, "animate", { prompt: "Slow push-in, light glints across the surface", seconds: 6 })]; return canvas("Product to ad", n, chain(n)); })() },
  { id: "talking-photo", name: "Make a photo talk", says: "Drop a portrait and type what they say. It moves and speaks.", makes: "video", canvas: (() => { const n = [step(0, "picture-in"), step(1, "animate", { prompt: "The person looks at the camera and speaks naturally, small head movements", seconds: 5 }), step(2, "speak", { prompt: "Hello. Tell me what I missed." })]; return canvas("Make a photo talk", n, chain(n)); })() },
  { id: "poster", name: "A picture from words", says: "Describe it and get a cinematic still.", makes: "image", canvas: canvas("A picture from words", [step(0, "make-picture", { prompt: "A lighthouse at dusk, storm clouds breaking, cinematic film still" })]) },
];

export const quickById = (id: string) => QUICK_APPS.find((a) => a.id === id);
