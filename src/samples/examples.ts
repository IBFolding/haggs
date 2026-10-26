/** Real results shipped with the site, shown on the empty Photos and Video pages with the prompt that made each one. */
export type Example = { src: string; kind: "image" | "video"; prompt: string; model: string; cost: string };

export const EXAMPLES: Example[] = [
  { src: "/samples/portrait.jpg", kind: "image", model: "FLUX 3", cost: "7 credits", prompt: "Cinematic portrait of a woman in her fifties with silver braided hair and a navy wool coat standing on a windy lighthouse gallery at golden hour, warm rim light, shallow depth of field, film grain, no text, no watermark." },
  { src: "/samples/street.jpg", kind: "image", model: "FLUX 3", cost: "7 credits", prompt: "A rainy neon-lit street in a futuristic city at night, a lone cyclist in a yellow raincoat crossing wet asphalt, reflections everywhere, cinematic wide shot, no text, no watermark." },
  { src: "/samples/landscape.jpg", kind: "image", model: "FLUX 3", cost: "7 credits", prompt: "A glass observatory dome on a snowy cliff at dusk, the first stars appearing over a calm sea, soft blue and amber light, epic wide landscape, photographic, no text, no watermark." },
  { src: "/samples/ad-kettle.jpg", kind: "image", model: "FLUX 3", cost: "7 credits", prompt: "Premium product photo of a matte black gooseneck pour-over coffee kettle on a pale oak kitchen counter, soft morning window light, shallow depth of field, steam rising, clean minimal advertising photo, no text, no logo." },
  { src: "/samples/clip-tea.mp4", kind: "video", model: "Veo 3.1 Lite, 4 seconds", cost: "12 credits", prompt: "A speckled terracotta mug on a wooden table by a rainy window, steam curling up, slow push in, soft natural light." },
  { src: "/samples/clip-city.mp4", kind: "video", model: "Veo 3.1 Lite, 4 seconds", cost: "12 credits", prompt: "A lone cyclist in a yellow raincoat rides slowly through a rainy neon-lit city street at night, camera tracking alongside, cinematic." },
  { src: "/samples/clip-influencer.mp4", kind: "video", model: "Veo 3.1 Fast, 4 seconds with sound", cost: "84 credits", prompt: "The woman looks into the camera, smiles warmly and says in a relaxed, natural voice: \"Okay, I made this whole video in one place.\" She takes a small sip of coffee. Handheld influencer video, soft cafe ambience." },
];

export const examplesFor = (surface: string): Example[] =>
  surface === "Video" ? EXAMPLES.filter((e) => e.kind === "video") : surface === "Edit" ? [] : EXAMPLES.filter((e) => e.kind === "image");
