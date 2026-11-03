/**
 * Curated entries on the Community page that are not user-published apps: sample outputs made with haggs itself, and
 * third-party workflows we only point to. Static on purpose, so they show with or without an account.
 */

export type StudioSample = { id: string; title: string; kind: "image" | "video"; src: string; poster?: string; madeWith: string; note: string; tall?: boolean;
  /** The words it was made from, when we recorded them; the app page hands them to the tool that makes one like it. */
  prompt?: string;
  /** Where "Make one like this" goes, and what it is called. All three tools are live in the hosted app. */
  tool: { href: "/photos" | "/video" | "/comic"; label: string };
};

export const STUDIO_SAMPLES: StudioSample[] = [
  { id: "comic-page", tall: true, tool: { href: "/comic", label: "Comic maker" }, title: "Comic page: Mina, origin story", kind: "image", src: "/community/comic-page.jpg", madeWith: "haggs Comic maker", note: "One page with captions and a speech bubble, drawn from a written panel list and a style sheet." },
  { id: "ad-kettle-hero", tool: { href: "/photos", label: "Photos" }, prompt: "Premium product photo of a matte black gooseneck kettle on a pale oak counter, morning light.", title: "Product photo: kettle on oak", kind: "image", src: "/community/ad-1.jpg", madeWith: "haggs workflow submit, Flux image node (seed 1000)", note: "Prompt: premium product photo of a matte black gooseneck kettle on a pale oak counter, morning light." },
  { id: "ad-kettle-lifestyle", tool: { href: "/photos", label: "Photos" }, prompt: "Woman in a cream sweater pouring coffee from the kettle into a ceramic dripper, golden light.", title: "Lifestyle ad: pour-over", kind: "image", src: "/community/ad-2.jpg", madeWith: "haggs workflow submit, Flux image node (seed 1001)", note: "Prompt: woman in a cream sweater pouring coffee from the kettle into a ceramic dripper, golden light." },
  { id: "ad-kettle-moody", tool: { href: "/photos", label: "Photos" }, prompt: "Moody product hero, thin ribbon of steam against charcoal, single warm rim light.", title: "Hero shot: kettle in the dark", kind: "image", src: "/community/ad-4.jpg", madeWith: "haggs workflow submit, Flux image node (seed 1003)", note: "Prompt: moody product hero, thin ribbon of steam against charcoal, single warm rim light." },
  { id: "influencer-clip", tall: true, tool: { href: "/video", label: "Video" }, title: "Talking clip from a made character", kind: "video", src: "/community/influencer-clip.mp4", poster: "/community/influencer-clip-poster.jpg", madeWith: "haggs Video, made-character flow", note: "A generated character, made once and then made to talk. The exact video model was not recorded for this clip." },
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
  /**
   * How to run it. haggs does not run third-party workflows: the app page says so and sends people to the creator's own
   * install guide. `hosted` is only ever true if the creator says it runs on a hosted service.
   */
  run: { hosted: false; where: string; steps: string[] };
};

/** Workflows by other people. haggs links to them; it does not bundle, host or redistribute their code, weights or nodes. */
export const THIRD_PARTY_WORKFLOWS: ThirdPartyWorkflow[] = [
  // Empty for now: Reshoot 4D (itsmetamike, AGPL-3.0, CUDA GPU, local only) is held back until after the contest.
];

export const COMFYUI_INSTALL_URL = "https://github.com/comfyanonymous/ComfyUI#installing";

export type CommunityEntry = { kind: "sample"; sample: StudioSample } | { kind: "third-party"; workflow: ThirdPartyWorkflow };

/** One curated entry by its id, for the app page behind each Community card. */
export function communityEntry(id: string): CommunityEntry | null {
  const sample = STUDIO_SAMPLES.find((s) => s.id === id);
  if (sample) return { kind: "sample", sample };
  const workflow = THIRD_PARTY_WORKFLOWS.find((w) => w.id === id);
  return workflow ? { kind: "third-party", workflow } : null;
}

/** The URL of an entry's app page. */
export const communityAppPath = (id: string) => `/workflows/community/${id}`;
