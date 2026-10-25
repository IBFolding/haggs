import type { Traits } from "../characters/character";
import type { Place } from "../locations/location";

/** Ready-made starting points for the Characters, Locations, Accessories and Found footage pages: one tap fills the form. */

export const CHARACTER_SAMPLES: Traits[] = [
  { name: "Mara, the lighthouse keeper", age: 58, gender: "woman", build: "sturdy", height: "average height", skin: "weathered fair", hairStyle: "braided", hairLength: "long", hairColor: "silver", eyes: "grey", face: "square", facialHair: "none", glasses: "none", wardrobe: "a heavy navy wool coat, a mustard scarf and rubber boots", marks: "deep laugh lines, a salt-bleached streak in her braid", look: "photoreal" },
  { name: "Dev, the night-shift courier", age: 27, gender: "man", build: "lean", height: "tall", skin: "warm brown", hairStyle: "short curls", hairLength: "short", hairColor: "black", eyes: "dark brown", face: "oval", facialHair: "light stubble", glasses: "none", wardrobe: "a reflective yellow rain jacket over a grey hoodie, a cycling cap", marks: "a small silver stud in one ear", look: "photoreal" },
  { name: "Professor Ines Vale", age: 44, gender: "woman", build: "slim", height: "average height", skin: "light olive", hairStyle: "swept back", hairLength: "chin-length", hairColor: "dark auburn", eyes: "hazel", face: "heart-shaped", facialHair: "none", glasses: "round tortoiseshell", wardrobe: "a rust corduroy blazer over a cream shirt, a brass compass pin", marks: "ink on her fingertips", look: "photoreal" },
];

export const PLACE_SAMPLES: Place[] = [
  { name: "The last diner on Route 9", setting: "roadside diner", where: "interior", timeOfDay: "night", weather: "rain", season: "autumn", era: "1970s", mood: "lonely and warm", style: "chrome, red vinyl booths, a flickering neon sign", details: "a jukebox in the corner, rain on the windows, one coffee left on the counter" },
  { name: "Observatory on the cliff", setting: "observatory", where: "exterior", timeOfDay: "dusk", weather: "clear", season: "winter", era: "present day", mood: "quiet and vast", style: "white stone dome, weathered copper, long shadows", details: "a path of footprints in the snow, the dome slightly open, the first stars out" },
  { name: "Grandmother's greenhouse", setting: "greenhouse", where: "interior", timeOfDay: "morning", weather: "overcast", season: "spring", era: "present day", mood: "soft and overgrown", style: "peeling white paint, glass panes, terracotta pots", details: "tomato vines up the frame, a kettle on a crate, dust in the light" },
];

export const ACCESSORY_SAMPLES: { name: string; words: string }[] = [
  { name: "Red wool scarf", words: "a long bright red wool scarf with tassels" },
  { name: "Round glasses", words: "thin gold round-rimmed glasses with a faint tint" },
  { name: "Leather satchel", words: "a worn tan leather satchel with brass buckles and a frayed strap" },
  { name: "Vintage film camera", words: "a black and silver 35mm rangefinder camera on a leather strap" },
];

export const FOUND_SAMPLES: { label: string; brief: string }[] = [
  { label: "A city that is closing down", brief: "A lonely night shift in a city that is closing down" },
  { label: "A small-town summer", brief: "A hot summer in a small town where nothing ever happens" },
  { label: "The future, as it was imagined", brief: "How people in the fifties imagined the home of the future" },
];
