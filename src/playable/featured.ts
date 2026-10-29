import { COMET_MARKET } from "./showcase/comet-market";
import { LANTERN_MOTH } from "./showcase/lantern-moth";
import { STARLIGHT_SALVAGE } from "./showcase/starlight-salvage";
import type { Art, Asset, CodeSpec, GameSpec, Shape, TemplateSpec } from "./spec";

/**
 * Ready-made games shown on Playable's home page, so there is something to
 * play straight away. Each one is an ordinary spec: playing it saves a copy
 * in this browser, which can then be changed by chatting like any other.
 */

const art = (prompt: string, color: string, shape: Shape): Art => ({ prompt, color, shape });

export type Featured = { id: string; spec: GameSpec };

const asset = (id: string, label: string, kind: Asset["kind"], emoji: string, prompt: string, color: string, shape: Shape): Asset => ({ id, label, kind, emoji, prompt, color, shape });

/** Games Claude wrote against the game kit: what a code game can be. */
const WRITTEN: { id: string; spec: CodeSpec }[] = [
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

export const FEATURED: Featured[] = [
  ...WRITTEN,
  {
    id: "gutter-run",
    spec: {
      version: 1, template: "runner", title: "Gutter Run", pitch: "A folded paper boat races down a rain-soaked city gutter at night, hopping leaves and scooping up bottle caps.",
      palette: { sky: "#0b1020", ground: "#1a2030", accent: "#ffd34d", text: "#f4f6f8" },
      text: { intro: "Sail 250 metres down the gutter. Tap or press Space to hop the leaves.", win: "Safe at the storm drain!", lose: "Soaked through." },
      art: {
        player: art("A small folded white paper boat, side view, slightly wet paper texture, soft painted storybook style", "#f4f6f8", "triangle"),
        hazard: art("A wet brown autumn leaf lying flat, side view, soft painted storybook style", "#c0632b", "diamond"),
        pickup: art("A shiny metal bottle cap, side view icon, soft painted storybook style", "#ffd34d", "circle"),
        background: art("A rainy city street at night seen from gutter level, side view, wet asphalt with neon and streetlight reflections, soft painted storybook style", "#0b1020", "square"),
      },
      rules: { speed: 360, gravity: 1900, jump: 760, spawnEvery: 1.8, pickupEvery: 2.2, lives: 3, goal: "distance", target: 250 },
    },
  },
  {
    id: "lamplight-tide",
    spec: {
      version: 1, template: "collector", title: "Lamplight Tide", pitch: "A lighthouse keeper's cat pads across a moonlit beach, scooping up glowing fish before the tide comes in.",
      palette: { sky: "#0d1b2a", ground: "#1b263b", accent: "#ffd166", text: "#f1f5f9" },
      text: { intro: "Catch 12 glowing fish before the tide turns. Mind the crabs.", win: "A full bowl tonight!", lose: "The tide got there first." },
      art: {
        player: art("A small ginger cat seen from above, top-down view, curled tail, soft painted storybook style", "#f4a261", "circle"),
        hazard: art("A red beach crab seen from above, top-down view, claws raised, painted storybook style", "#e63946", "star"),
        pickup: art("A small glowing blue-green fish seen from above, top-down icon, soft bioluminescent glow, painted storybook style", "#4cc9f0", "diamond"),
        background: art("A dark sandy beach at night seen from directly above, wet sand with moonlight reflections, gentle foam at one edge, painted storybook style", "#1b263b", "square"),
      },
      rules: { speed: 260, hazards: 3, hazardSpeed: 120, target: 12, seconds: 60, lives: 3 },
    },
  },
  {
    id: "morning-bake",
    spec: {
      version: 1, template: "match", title: "Morning Bake", pitch: "Line up croissants, buns and tarts to fill the bakery window before the morning rush.",
      palette: { sky: "#3a2418", ground: "#4a2f20", accent: "#f6bd60", text: "#fff8ef" },
      text: { intro: "Swap neighbours to line up three bakes. Reach the score before the doors open.", win: "The window is full!", lose: "The rush came early." },
      art: {
        background: art("A warm wooden bakery counter with flour dusting, soft morning light, muted colours, puzzle game background", "#3a2418", "square"),
        tiles: [
          art("A golden croissant, game icon, soft painted style", "#f6bd60", "diamond"),
          art("A round cinnamon bun, game icon, soft painted style", "#c97b4a", "circle"),
          art("A red berry tart, game icon, soft painted style", "#e5383b", "star"),
          art("A green pistachio macaron, game icon, soft painted style", "#90be6d", "square"),
          art("A blueberry muffin, game icon, soft painted style", "#7b8cde", "triangle"),
        ],
      },
      rules: { cols: 7, rows: 7, kinds: 5, moves: 22, target: 1200 },
    },
  },
  {
    id: "snail-sprint",
    spec: {
      version: 1, template: "runner", title: "Snail Sprint", pitch: "A plucky garden snail races across a rainy garden path, hopping puddles and munching clover.",
      palette: { sky: "#cfe8d5", ground: "#5b7f4a", accent: "#2d6a4f", text: "#10241a" },
      text: { intro: "Munch 15 clovers. Tap or press Space to hop the puddles.", win: "Fastest snail in the garden!", lose: "Splashed!" },
      art: {
        player: art("A small garden snail with a spiral orange shell, side view, cheerful, soft painted storybook style", "#e07a5f", "circle"),
        hazard: art("A shallow rain puddle on a garden path, side view, soft painted storybook style", "#5fa8d3", "triangle"),
        pickup: art("A four-leaf clover, side view icon, soft painted storybook style", "#2d6a4f", "star"),
        background: art("A rainy garden path with tall flowers and dewy grass, side view, soft daylight, soft painted storybook style", "#cfe8d5", "square"),
      },
      rules: { speed: 260, gravity: 1900, jump: 760, spawnEvery: 2, pickupEvery: 1.6, lives: 3, goal: "score", target: 15 },
    },
  },
];
