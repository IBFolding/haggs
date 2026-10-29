import { COMET_MARKET } from "./showcase/comet-market";
import { LANTERN_MOTH } from "./showcase/lantern-moth";
import { SPROUT_SWARM } from "./showcase/sprout-swarm";
import { STARLIGHT_SALVAGE } from "./showcase/starlight-salvage";
import type { Asset, CodeSpec, GameSpec, Shape } from "./spec";

/**
 * Ready-made games shown on Playable's home page, so there is something to
 * play straight away. Each one is an ordinary code game: playing it saves a
 * copy in this browser, which can then be changed by chatting like any other.
 */

export type Featured = { id: string; spec: GameSpec };

const asset = (id: string, label: string, kind: Asset["kind"], emoji: string, prompt: string, color: string, shape: Shape): Asset => ({ id, label, kind, emoji, prompt, color, shape });

/** Games Claude wrote against the game kit: what a code game can be. */
const WRITTEN: { id: string; spec: CodeSpec }[] = [
  {
    id: "sprout-swarm",
    spec: {
      version: 2, template: "code", title: "Sprout Swarm", genre: "Crowd", aspect: "9:16", three: true, touch: "tap",
      pitch: "Lead a swarm of sprouts down the garden path. Steer through the gates that grow it, dodge the saws, overrun the beetle squads and storm the Weed King.",
      controls: "Drag or ← → to steer",
      palette: { sky: "#8fd0ff", ground: "#e6f6ff", accent: "#7be06a", text: "#ffffff" },
      art: {
        assets: [
          asset("sky", "Sky", "background", "☁️", "a bright summer sky over a garden with soft fluffy clouds, wide mobile game backdrop, clean stylised 3D render", "#8fd0ff", "square"),
          asset("gem", "Dew gem", "sprite", "💎", "a sparkling blue dewdrop gem, game pickup icon, clean stylised 3D render", "#9ef0ff", "diamond"),
          asset("boss", "Weed King's crown", "sprite", "👑", "a grumpy cartoon weed king face wearing a spiky gold crown, clean stylised 3D render", "#ffd34d", "star"),
        ],
      },
      code: SPROUT_SWARM,
    },
  },
  {
    id: "lantern-moth",
    spec: {
      version: 2, template: "code", title: "Lantern Moth", genre: "Adventure", aspect: "16:9", three: false, touch: "pad",
      pitch: "Carry a tiny lantern through a garden swallowed by night. Your light is your health and your weapon: light the old lamps before it burns out.",
      controls: "Arrows or drag to fly, Space or A to flare",
      palette: { sky: "#0b1022", ground: "#16233a", accent: "#ffcf6b", text: "#fff6e0" },
      art: {
        assets: [
          asset("moth", "Moth", "sprite", "🦋", "a small fluffy moth carrying a glowing paper lantern, seen from above, warm storybook watercolour style", "#e8d9b5", "circle"),
          asset("shade", "Shadow", "sprite", "👻", "a wispy purple shadow creature with two pale eyes, storybook watercolour style", "#6b4fc9", "circle"),
          asset("firefly", "Firefly", "sprite", "✨", "a glowing firefly, bright yellow-green light, storybook watercolour style", "#fff3a0", "star"),
          asset("lamp", "Garden lamp", "sprite", "🏮", "an old iron garden lamp post with a paper lantern, seen from above, storybook watercolour style", "#ff9f43", "diamond"),
          asset("great", "Great Lantern", "sprite", "🪔", "a huge ornate brass lantern on a stone plinth, glowing, seen from above, storybook watercolour style", "#ffcf6b", "star"),
          asset("garden", "Night garden", "background", "🌿", "a night garden seen from directly above: winding paths, flower beds and hedges, deep blue moonlight, storybook watercolour", "#16233a", "square"),
          asset("pond", "Lily pond", "background", "🪷", "a lily pond seen from directly above at night, lily pads, stepping stones, reeds, deep teal moonlight, storybook watercolour", "#0f2a33", "square"),
          asset("oak", "Old oak", "background", "🌳", "the roots and mossy ground around an enormous old oak seen from directly above at night, mushrooms, storybook watercolour", "#1a1f2a", "square"),
        ],
      },
      code: LANTERN_MOTH,
    },
  },
  {
    id: "starlight-salvage",
    spec: {
      version: 2, template: "code", title: "Starlight Salvage", genre: "Shooter", aspect: "16:9", three: false, touch: "pad",
      pitch: "Blast junk drones and let their scrap fly into your hull: every piece charges Overdrive. Five waves, then the Salvage Queen.",
      controls: "Arrows or WASD to fly, Space or click to fire",
      palette: { sky: "#070a18", ground: "#161b34", accent: "#ffd34d", text: "#ffffff" },
      art: {
        assets: [
          asset("ship", "Your ship", "sprite", "🚀", "a small chunky salvage spaceship facing right, yellow and grey hull, glowing engine, side view, bold cartoon style", "#ffd34d", "triangle"),
          asset("scrap", "Scrap drone", "sprite", "🛰️", "a spinning ball of space junk with bolts and pipes, orange glow, bold cartoon style", "#ff9f43", "star"),
          asset("drone", "Gunner drone", "sprite", "👾", "a round hovering gunner robot with one blue eye facing left, side view, bold cartoon style", "#54d2ff", "diamond"),
          asset("darter", "Darter", "sprite", "☄️", "a fast sleek red dart-shaped drone facing left, side view, bold cartoon style", "#ff5d73", "triangle"),
          asset("boss", "Salvage Queen", "sprite", "🦀", "a giant crab-like scrapyard mothership boss facing left, magnet claws, red lights, bold cartoon style", "#ff5d73", "circle"),
          asset("bolt", "Your shot", "sprite", "⚡", "a short glowing yellow laser bolt, horizontal, game effect", "#fff3a0", "diamond"),
          asset("spark", "Enemy shot", "sprite", "🔴", "a small pink plasma orb with a bright core, game effect", "#ff6fb0", "circle"),
          asset("bit", "Scrap", "sprite", "🔩", "a small shiny bolt and gear piece of scrap metal, game pickup", "#c9d1d9", "square"),
          asset("powerup", "Power-up", "sprite", "🔋", "a glowing green power cell with a lightning symbol, game pickup icon", "#35e48a", "square"),
          asset("space", "Space", "background", "🌌", "a deep blue nebula in space with distant planets and a faint asteroid belt, wide side-scrolling game background, painterly", "#070a18", "square"),
        ],
      },
      code: STARLIGHT_SALVAGE,
    },
  },
  {
    id: "comet-market",
    spec: {
      version: 2, template: "code", title: "Comet Market Dash", genre: "Runner", aspect: "9:16", three: true, touch: "tap",
      pitch: "Sprint down a floating night market in 3D, dodging crates and grabbing lucky coins. Every ten coins starts a Rush.",
      controls: "← → or swipe to change lanes, ↑ or swipe up to jump",
      palette: { sky: "#1b1440", ground: "#2a2250", accent: "#ffb703", text: "#ffffff" },
      art: {
        assets: [
          asset("hero", "Runner", "sprite", "🏃", "a cheerful kid courier in a red scarf running away from the viewer, seen from behind, full body, bold cartoon style", "#ff5d5d", "circle"),
          asset("crate", "Crate", "background", "📦", "a square wooden market crate face with painted lantern stickers, flat texture filling the frame", "#b5763a", "square"),
          asset("coin", "Lucky coin", "sprite", "🪙", "a shiny gold lucky coin with a star stamped in the middle, game pickup icon", "#ffd34d", "star"),
          asset("road", "Street", "background", "🏮", "a cobblestone market street seen from directly above, with lantern light pooling, seamless texture", "#3b2f63", "square"),
          asset("sky", "Sky", "background", "🌙", "a purple night sky over floating market rooftops with paper lanterns and a big moon, wide game backdrop", "#1b1440", "square"),
        ],
      },
      code: COMET_MARKET,
    },
  },
];

/** What the home page shows first: the games Claude wrote. The template games are under Quick start. */
export const FEATURED: Featured[] = WRITTEN;
