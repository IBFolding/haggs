import type { Kv } from "../story/kv";
import { readSpec, slotsOf, type GameSpec } from "./spec";

/**
 * Saved games, one record per key with a separate index, like projects. The
 * keys sit under `playable/`, which the development bridge doesn't mirror to
 * disk. Each save keeps the specs before it, so a chat edit can be undone.
 */

const INDEX_KEY = "playable/index";
const recordKey = (id: string) => `playable/${id}`;

export const HISTORY = 20;
export const CHAT = 100;

export type ChatLine = { who: "you" | "claude" | "note"; text: string; at: number };

export type SavedGame = { id: string; createdAt: number; updatedAt: number; spec: GameSpec; history: GameSpec[]; chat: ChatLine[] };

export type GameSummary = { id: string; title: string; template: GameSpec["template"]; accent: string; cover?: string; updatedAt: number };

const summaryOf = (g: SavedGame): GameSummary => ({
  id: g.id,
  title: g.spec.title,
  template: g.spec.template,
  accent: g.spec.palette.accent,
  ...((cover) => (cover ? { cover } : {}))(slotsOf(g.spec).find((s) => s.kind === "background" && s.art.url)?.art.url),
  updatedAt: g.updatedAt,
});

/** A record as read back: a spec that no longer reads drops the record rather than breaking the page. */
function readGame(value: unknown): SavedGame | undefined {
  const g = value as Partial<SavedGame> | undefined;
  if (!g || typeof g.id !== "string") return undefined;
  try {
    const history = (Array.isArray(g.history) ? g.history : []).flatMap((h) => { try { return [readSpec(h)]; } catch { return []; } });
    const chat = (Array.isArray(g.chat) ? g.chat : []).filter((l): l is ChatLine => typeof l?.text === "string" && ["you", "claude", "note"].includes(l?.who));
    return { id: g.id, createdAt: Number(g.createdAt) || 0, updatedAt: Number(g.updatedAt) || 0, spec: readSpec(g.spec), history, chat };
  } catch {
    return undefined;
  }
}

export type GameStore = {
  list(): Promise<GameSummary[]>;
  get(id: string): Promise<SavedGame | undefined>;
  create(spec: GameSpec, chat?: ChatLine[]): Promise<SavedGame>;
  /** A new spec: the current one goes onto the history. Lines are added to the chat. */
  change(id: string, spec: GameSpec, ...lines: ChatLine[]): Promise<SavedGame | undefined>;
  /** Lines only, the spec unchanged. */
  say(id: string, ...lines: ChatLine[]): Promise<SavedGame | undefined>;
  /** Back to the spec before the last change. Undefined when there is nothing to undo. */
  undo(id: string): Promise<SavedGame | undefined>;
  remove(id: string): Promise<void>;
};

export function createGameStore(kv: Kv, now: () => number = Date.now, newId: () => string = () => crypto.randomUUID().slice(0, 12)): GameStore {
  async function index(): Promise<GameSummary[]> {
    const raw = await kv.get<GameSummary[]>(INDEX_KEY);
    return Array.isArray(raw) ? raw.filter((s) => typeof s?.id === "string") : [];
  }

  async function write(game: SavedGame): Promise<SavedGame> {
    await kv.set(recordKey(game.id), game);
    const rest = (await index()).filter((s) => s.id !== game.id);
    await kv.set(INDEX_KEY, [summaryOf(game), ...rest]);
    return game;
  }

  async function get(id: string) {
    return readGame(await kv.get(recordKey(id)));
  }

  return {
    async list() {
      return (await index()).sort((a, b) => b.updatedAt - a.updatedAt);
    },
    get,
    async create(spec, chat = []) {
      const at = now();
      return write({ id: newId(), createdAt: at, updatedAt: at, spec: readSpec(spec), history: [], chat: chat.slice(-CHAT) });
    },
    async change(id, spec, ...lines) {
      const game = await get(id);
      if (!game) return undefined;
      return write({ ...game, updatedAt: now(), spec: readSpec(spec), history: [...game.history, game.spec].slice(-HISTORY), chat: [...game.chat, ...lines].slice(-CHAT) });
    },
    async say(id, ...lines) {
      const game = await get(id);
      if (!game) return undefined;
      return write({ ...game, updatedAt: now(), chat: [...game.chat, ...lines].slice(-CHAT) });
    },
    async undo(id) {
      const game = await get(id);
      const previous = game?.history.at(-1);
      if (!game || !previous) return undefined;
      return write({ ...game, updatedAt: now(), spec: previous, history: game.history.slice(0, -1), chat: [...game.chat, { who: "note" as const, text: "Undid the last change.", at: now() }].slice(-CHAT) });
    },
    async remove(id) {
      await kv.remove(recordKey(id));
      await kv.set(INDEX_KEY, (await index()).filter((s) => s.id !== id));
    },
  };
}
