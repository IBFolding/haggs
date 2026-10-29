import { BRAMBLE_RUN } from "./showcase/bramble-run";
import { COMET_MARKET } from "./showcase/comet-market";
import { LANTERN_MOTH } from "./showcase/lantern-moth";
import { NOODLE_PATCH } from "./showcase/noodle-patch";
import { SPROUT_SWARM } from "./showcase/sprout-swarm";
import { STARLIGHT_SALVAGE } from "./showcase/starlight-salvage";
import type { Asset, CodeSpec, GameSpec, Shape } from "./spec";

/**
 * Ready-made games shown on Playable's home page, so there is something to
 * play straight away. Each one is an ordinary code game: playing it saves a
 * copy in this browser, which can then be changed by chatting like any other.
 */

/** `cover`: key art for the card, in `public/playable/covers/`; without one the card draws the game's emoji cast. */
export type Featured = { id: string; spec: GameSpec; cover?: string };

/** The games that have a cover picture (made with ChatGPT's image model). */
const COVERS = new Set<string>(["sprout-swarm", "noodle-patch", "bramble-run", "lantern-moth", "starlight-salvage", "comet-market"]);

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
    id: "noodle-patch",
    spec: {
      version: 2, template: "code", title: "Noodle Patch", genre: "Simulation", aspect: "16:9", three: false, touch: "tap",
      pitch: "Grow the ingredients out back, then run the ramen stall out front: read each order, build the bowl and serve it before your customer gives up. Three days, an upgrade after each.",
      controls: "Click or tap to plant, harvest, build bowls and serve",
      palette: { sky: "#ffd8a8", ground: "#cde7a8", accent: "#c8443a", text: "#3b2a2a" },
      art: {
        assets: [
          asset("wheat", "Noodles", "sprite", "🌾", "a bundle of golden wheat that becomes fresh ramen noodles, cosy hand-painted cartoon style", "#f2c94c", "star"),
          asset("scallion", "Scallion", "sprite", "🌿", "a fresh green scallion bunch, cosy hand-painted cartoon style", "#6fcf5b", "triangle"),
          asset("mushroom", "Mushroom", "sprite", "🍄", "a plump brown shiitake mushroom, cosy hand-painted cartoon style", "#c08a5a", "circle"),
          asset("egg", "Egg", "sprite", "🥚", "a soft-boiled ramen egg cut in half with a jammy yolk, cosy hand-painted cartoon style", "#ffe9b0", "circle"),
          asset("hen", "Hen", "sprite", "🐔", "a round cheerful farm hen, cosy hand-painted cartoon style", "#ffffff", "circle"),
          asset("bowl", "Ramen bowl", "sprite", "🍜", "a big red ramen bowl full of steaming broth, seen slightly from above, cosy hand-painted cartoon style", "#c8443a", "circle"),
          asset("coin", "Coin", "sprite", "🪙", "a shiny gold coin with a noodle swirl stamped on it, game icon", "#ffd34d", "circle"),
          asset("cat", "Cat", "sprite", "🐱", "a hungry cartoon cat customer leaning on a counter, cosy hand-painted style", "#f2a65a", "circle"),
          asset("dog", "Dog", "sprite", "🐶", "a happy cartoon dog customer with a napkin, cosy hand-painted style", "#c8a07a", "circle"),
          asset("fox", "Fox", "sprite", "🦊", "a clever cartoon fox customer in a scarf, cosy hand-painted style", "#e07a3f", "circle"),
          asset("panda", "Panda", "sprite", "🐼", "a sleepy cartoon panda customer holding chopsticks, cosy hand-painted style", "#ffffff", "circle"),
          asset("farm", "Farm", "background", "🌄", "a cosy little farm at golden hour with rolling green hills and a wooden ramen stall, wide game backdrop, hand-painted", "#ffd8a8", "square"),
        ],
      },
      code: NOODLE_PATCH,
    },
  },
  {
    id: "bramble-run",
    spec: {
      version: 2, template: "code", title: "Bramble Run", genre: "Platformer", aspect: "16:9", three: false, touch: "tap",
      pitch: "A hedgehog courier has parcels to deliver across Clover Meadow and the Dusk Thicket. Run, jump, bounce off bugs, grab the feather to glide, and reach the delivery gate.",
      controls: "← → run · Space jump (hold for higher) · touch: hold a side, tap the middle",
      palette: { sky: "#8fd3ff", ground: "#9b6a3f", accent: "#ffd34d", text: "#ffffff" },
      art: {
        assets: [
          asset("hero", "Hedgehog courier", "sprite", "🦔", "a small hedgehog courier with a tiny satchel, side view facing left, bright cartoon platformer style", "#c98a5a", "circle"),
          asset("beetle", "Beetle", "sprite", "🪲", "a round red-shelled beetle walking, side view facing left, bright cartoon platformer style", "#e2463c", "circle"),
          asset("bee", "Bee", "sprite", "🐝", "a chubby buzzing bee, side view facing left, bright cartoon platformer style", "#ffd34d", "circle"),
          asset("acorn", "Acorn", "sprite", "🌰", "a shiny acorn collectible, game pickup icon", "#c98a3b", "circle"),
          asset("feather", "Feather", "sprite", "🪶", "a soft white glider feather power-up with a faint glow, game pickup icon", "#ffffff", "diamond"),
          asset("meadow", "Clover Meadow", "background", "🌼", "a sunny meadow with rolling hills, clover and distant trees, wide side-scrolling platformer backdrop, bright cartoon style", "#8fd3ff", "square"),
          asset("dusk", "Dusk Thicket", "background", "🌲", "a purple dusk forest with tall dark pines and a low orange sky, wide side-scrolling platformer backdrop, bright cartoon style", "#2d2156", "square"),
        ],
      },
      code: BRAMBLE_RUN,
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
export const FEATURED: Featured[] = WRITTEN.map((f) => (COVERS.has(f.id) ? { ...f, cover: `/playable/covers/${f.id}.webp` } : f));
