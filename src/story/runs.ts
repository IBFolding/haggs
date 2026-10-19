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
const DEFAULT_CAP = 60;

export type Run = {
  id: string;
  modelId: string;
  modelName: string;
  prompt: string;
  settings: Record<string, string | number | boolean>;
  url: string;
  kind: "image" | "video";
  usd: number | null;
  at: number;
  favorite?: boolean;
};

export type NewRun = Omit<Run, "id" | "at" | "favorite">;

export type RunStore = {
  list(): Promise<Run[]>;
  record(run: NewRun): Promise<Run>;
  setFavorite(id: string, favorite: boolean): Promise<void>;
  remove(id: string): Promise<void>;
  clear(): Promise<void>;
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

    record(run) {
      const saved: Run = { ...run, id: crypto.randomUUID(), at: Date.now() };
      return serialize(async () => {
        await write([saved, ...(await read())]);
        return saved;
      });
    },

    setFavorite(id, favorite) {
      return serialize(async () => {
        const runs = await read();
        await write(runs.map((run) => (run.id === id ? { ...run, favorite } : run)));
      });
    },

    remove(id) {
      return serialize(async () => {
        const runs = await read();
        await write(runs.filter((run) => run.id !== id));
      });
    },

    clear() {
      return serialize(() => kv.remove(KEY));
    },
  };
}
