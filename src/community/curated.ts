/**
 * Curated entries on the Community page that are not user-published apps: sample outputs made with haggs itself, and
 * third-party workflows we only point to. Static on purpose, so they show with or without an account.
 */

export type StudioSample = { id: string; title: string; kind: "image" | "video"; src: string; poster?: string; madeWith: string; note: string; tall?: boolean };

export const STUDIO_SAMPLES: StudioSample[] = [
  { id: "comic-page", tall: true, title: "Comic page: Mina, origin story", kind: "image", src: "/community/comic-page.jpg", madeWith: "haggs Comic maker", note: "One page with captions and a speech bubble, drawn from a written panel list and a style sheet." },
  { id: "ad-kettle-hero", title: "Product photo: kettle on oak", kind: "image", src: "/community/ad-1.jpg", madeWith: "haggs workflow submit, Flux image node (seed 1000)", note: "Prompt: premium product photo of a matte black gooseneck kettle on a pale oak counter, morning light." },
  { id: "ad-kettle-lifestyle", title: "Lifestyle ad: pour-over", kind: "image", src: "/community/ad-2.jpg", madeWith: "haggs workflow submit, Flux image node (seed 1001)", note: "Prompt: woman in a cream sweater pouring coffee from the kettle into a ceramic dripper, golden light." },
  { id: "ad-kettle-moody", title: "Hero shot: kettle in the dark", kind: "image", src: "/community/ad-4.jpg", madeWith: "haggs workflow submit, Flux image node (seed 1003)", note: "Prompt: moody product hero, thin ribbon of steam against charcoal, single warm rim light." },
  { id: "influencer-clip", tall: true, title: "Talking clip from a made character", kind: "video", src: "/community/influencer-clip.mp4", poster: "/community/influencer-clip-poster.jpg", madeWith: "haggs Video, made-character flow", note: "A generated character, made once and then made to talk. The exact video model was not recorded for this clip." },
];

export type ThirdPartyWorkflow = {
  id: string;
  name: string;
  summary: string;
  creator: { name: string; url: string };
  source: string;
  license: string;
  requirements: string[];
  notes: string;
};

/** Workflows by other people. haggs links to them; it does not bundle, host or redistribute their code, weights or nodes. */
export const THIRD_PARTY_WORKFLOWS: ThirdPartyWorkflow[] = [
  {
    id: "reshoot-4d",
    name: "Reshoot 4D",
    summary: "Reshoot existing video from a new camera path inside ComfyUI: it builds a 4D capture of the scene, you key a virtual camera, and LTX 2.3 renders the new frames from the real footage.",
    creator: { name: "itsmetamike", url: "https://github.com/itsmetamike" },
    source: "https://github.com/itsmetamike/reshoot-4d",
    license: "AGPL-3.0",
    requirements: ["Runs in your own ComfyUI, installed into custom_nodes", "NVIDIA CUDA GPU", "Needs ReDirector and LTX 2.3 installed too", "Its models keep their own licences"],
    notes: "Not part of haggs and not run by haggs. The creator's page does not say it runs on Comfy Cloud, so we do not claim it does. Follow the creator's install guide.",
  },
];
