import type { Kv } from "./kv";

/**
 * Every finished generation, kept in this browser.
 *
 * The studio used to hold results in component state, which meant a refresh
 * threw away work you had already paid for. The URLs belong to the provider's
 * CDN, so old entries can outlive their media and show gaps — but the prompt,
 * the model and the settings that produced them are yours and stay readable.
 */

const KEY = "runs";
const DEFAULT_CAP = 500;
const GONE = "runs/deleted";

export type Run = {
  id: string;
  modelId: string;
  modelName: string;
  prompt: string;
  settings: Record<string, string | number | boolean>;
  url: string;
  kind: "image" | "video" | "audio";
  usd: number | null;
  at: number;
  favorite?: boolean;
  /** When it last changed, so devices agree on which copy is newest. */
  rev?: number;
  /** The Comfy job this came from, when it was recovered from Comfy, so it is only added once. */
  comfyJob?: string;
  /** The link in the account's file store once it has been kept there, so every device can play it. */
  remote?: string;
};

/** A picture or a clip: the runs that can be put to work in a project. A sound stays in the Gallery. */
export type PictureRun = Run & { kind: "image" | "video" };
export const isPicture = (run: Run): run is PictureRun => run.kind !== "audio";

export type NewRun = Omit<Run, "id" | "at" | "favorite" | "rev" | "remote">;

export type RunStore = {
  list(): Promise<Run[]>;
  /** `at` is when it was made, for a render recovered from earlier. */
  record(run: NewRun, at?: number): Promise<Run>;
  setFavorite(id: string, favorite: boolean): Promise<void>;
  remove(id: string): Promise<void>;
  clear(): Promise<void>;
  /** Runs removed here that the account hasn't been told about yet. */
  deleted(): Promise<string[]>;
  settled(ids: string[]): Promise<void>;
  /** Brings runs from the account in, replacing the same id. */
  adopt(runs: Run[]): Promise<void>;
  drop(ids: string[]): Promise<void>;
  /** Fills in fields on one run without counting as a change you made. */
  patch(id: string, fields: Partial<Pick<Run, "remote">>): Promise<void>;
};

function isRun(value: unknown): value is Run {
  if (typeof value !== "object" || value === null) return false;
  const run = value as Partial<Run>;
  return (
    typeof run.id === "string" &&
    typeof run.url === "string" &&
    typeof run.prompt === "string" &&
    typeof run.at === "number"
  );
}

/**
 * Trims to the cap by dropping the oldest ordinary runs. Favourites are a
 * deliberate keep and never age out — starring something and then losing it to
 * a counter you cannot see would make the star worthless.
 */
function trim(runs: Run[], cap: number): Run[] {
  const ordinary = runs.filter((run) => !run.favorite);
  if (ordinary.length <= cap) return runs;
  const doomed = new Set(ordinary.slice(cap).map((run) => run.id));
  return runs.filter((run) => !doomed.has(run.id));
}

export function createRunStore(kv: Kv, cap = DEFAULT_CAP): RunStore {
  let chain: Promise<unknown> = Promise.resolve();

  /** One writer at a time; a run finishing mid-write must not drop the other. */
  function serialize<T>(work: () => Promise<T>): Promise<T> {
    const result = chain.then(work);
    chain = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  async function read(): Promise<Run[]> {
    const stored = await kv.get<unknown>(KEY);
    if (!Array.isArray(stored)) return [];
    return stored.filter(isRun);
  }

  async function write(runs: Run[]): Promise<void> {
    await kv.set(KEY, trim(runs, cap));
  }

  return {
    list: () => read(),

    record(run, when) {
      const at = when ?? Date.now();
      const saved: Run = { ...run, id: crypto.randomUUID(), at, rev: at };
      return serialize(async () => {
        // A render recovered from earlier takes its place by the time it was made, not at the top.
        const all = [saved, ...(await read())];
        await write(when === undefined ? all : all.sort((a, b) => b.at - a.at));
        return saved;
      });
    },

    setFavorite(id, favorite) {
      return serialize(async () => {
        const runs = await read();
        await write(runs.map((run) => (run.id === id ? { ...run, favorite, rev: Date.now() } : run)));
      });
    },

    remove(id) {
      return serialize(async () => {
        const runs = await read();
        await write(runs.filter((run) => run.id !== id));
        const gone = (await kv.get<string[]>(GONE)) ?? [];
        if (!gone.includes(id)) await kv.set(GONE, [...gone, id]);
      });
    },

    clear() {
      return serialize(async () => {
        const gone = (await kv.get<string[]>(GONE)) ?? [];
        await kv.set(GONE, [...new Set([...gone, ...(await read()).map((r) => r.id)])]);
        await kv.remove(KEY);
      });
    },

    async deleted() {
      return (await kv.get<string[]>(GONE)) ?? [];
    },

    settled(ids) {
      return serialize(async () => {
        const gone = (await kv.get<string[]>(GONE)) ?? [];
        await kv.set(GONE, gone.filter((id) => !ids.includes(id)));
      });
    },

    adopt(runs) {
      return serialize(async () => {
        const mine = await read();
        const incoming = new Map(runs.filter(isRun).map((r) => [r.id, r]));
        const kept = mine.map((r) => incoming.get(r.id) ?? r);
        const fresh = [...incoming.values()].filter((r) => !mine.some((m) => m.id === r.id));
        await write([...kept, ...fresh].sort((a, b) => b.at - a.at));
      });
    },

    drop(ids) {
      return serialize(async () => {
        await write((await read()).filter((r) => !ids.includes(r.id)));
      });
    },

    patch(id, fields) {
      return serialize(async () => {
        await write((await read()).map((r) => (r.id === id ? { ...r, ...fields } : r)));
      });
    },
  };
}
