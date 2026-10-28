import type { Art, GameSpec, Shape } from "./spec";

/**
 * Ready-made games shown on Playable's home page, so there is something to
 * play straight away. Each one is an ordinary spec: playing it saves a copy
 * in this browser, which can then be changed by chatting like any other.
 */

const art = (prompt: string, color: string, shape: Shape): Art => ({ prompt, color, shape });

export type Featured = { id: string; spec: GameSpec };

export const FEATURED: Featured[] = [
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
