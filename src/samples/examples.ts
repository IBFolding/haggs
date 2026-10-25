/** Real results shipped with the site, shown on the empty Photos and Video pages with the prompt that made each one. */
export type Example = { src: string; kind: "image" | "video"; prompt: string; model: string; cost: string };

export const EXAMPLES: Example[] = [
  { src: "/samples/portrait.jpg", kind: "image", model: "FLUX 3", cost: "$0.07", prompt: "Cinematic portrait of a woman in her fifties with silver braided hair and a navy wool coat standing on a windy lighthouse gallery at golden hour, warm rim light, shallow depth of field, film grain, no text, no watermark." },
  { src: "/samples/street.jpg", kind: "image", model: "FLUX 3", cost: "$0.07", prompt: "A rainy neon-lit street in a futuristic city at night, a lone cyclist in a yellow raincoat crossing wet asphalt, reflections everywhere, cinematic wide shot, no text, no watermark." },
  { src: "/samples/landscape.jpg", kind: "image", model: "FLUX 3", cost: "$0.07", prompt: "A glass observatory dome on a snowy cliff at dusk, the first stars appearing over a calm sea, soft blue and amber light, epic wide landscape, photographic, no text, no watermark." },
  { src: "/samples/clip-tea.mp4", kind: "video", model: "Veo 3.1 Lite, 4 seconds", cost: "$0.12", prompt: "A speckled terracotta mug on a wooden table by a rainy window, steam curling up, slow push in, soft natural light." },
  { src: "/samples/clip-city.mp4", kind: "video", model: "Veo 3.1 Lite, 4 seconds", cost: "$0.12", prompt: "A lone cyclist in a yellow raincoat rides slowly through a rainy neon-lit city street at night, camera tracking alongside, cinematic." },
];

export const examplesFor = (surface: string): Example[] =>
  surface === "Video" ? EXAMPLES.filter((e) => e.kind === "video") : surface === "Photos" ? EXAMPLES.filter((e) => e.kind === "image") : [];
