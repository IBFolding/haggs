import type { Kv } from "./kv";
import { summarize, type Project, type ProjectSummary } from "./model";

/**
 * Projects live one record per key, with a separate index, so opening the
 * library reads one small array rather than every project in storage.
 */

const INDEX_KEY = "projects/index";

const recordKey = (id: string) => `projects/${id}`;

export type ProjectStore = {
  list(): Promise<ProjectSummary[]>;
  load(id: string): Promise<Project | undefined>;
  save(project: Project): Promise<void>;
  remove(id: string): Promise<void>;
};

function isSummary(value: unknown): value is ProjectSummary {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as Partial<ProjectSummary>;
  return (
    typeof entry.id === "string" &&
    typeof entry.name === "string" &&
    typeof entry.updatedAt === "number" &&
    typeof entry.shotCount === "number"
  );
}

export function createProjectStore(kv: Kv): ProjectStore {
  /**
   * Ids of projects deleted in this session. A save already in flight when the
   * user hits Delete would otherwise put the project back — and since ids are
   * random per project, a tombstone can never block a legitimate later save.
   */
  const removed = new Set<string>();

  let chain: Promise<unknown> = Promise.resolve();

  /**
   * Every index mutation runs on one chain. Both `save` and `remove` read the
   * index, edit it and write it back with an await in between; overlapping them
   * means both read the same array and the later write drops the earlier one's
   * entry. The index is the only route to a project, so that is not a reordered
   * list — it is a project the user can no longer reach.
   */
  function serialize<T>(work: () => Promise<T>): Promise<T> {
    const result = chain.then(work);
    // The chain carries on after a failure; one rejected write must not stop
    // every later one from running.
    chain = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  /**
   * A half-written or hand-edited index must not make the library unusable, so
   * anything that is not an array reads as empty, and individual records that
   * are not summaries are dropped rather than handed to the UI.
   */
  async function readIndex(): Promise<ProjectSummary[]> {
    const stored = await kv.get<unknown>(INDEX_KEY);
    if (!Array.isArray(stored)) return [];
    return stored.filter(isSummary);
  }

  return {
    list() {
      return readIndex();
    },

    load(id) {
      return kv.get<Project>(recordKey(id));
    },

    save(project) {
      return serialize(async () => {
        if (removed.has(project.id)) return;

        const saved: Project = { ...project, updatedAt: Date.now() };
        await kv.set(recordKey(saved.id), saved);

        // The index is held newest-first rather than sorted on read: two saves
        // inside one millisecond carry the same timestamp, and ordering the
        // library by a value that ties is how a list starts shuffling itself.
        const index = await readIndex();
        await kv.set(INDEX_KEY, [
          summarize(saved),
          ...index.filter((entry) => entry.id !== saved.id),
        ]);
      });
    },

    remove(id) {
      return serialize(async () => {
        removed.add(id);
        await kv.remove(recordKey(id));
        const index = await readIndex();
        await kv.set(
          INDEX_KEY,
          index.filter((entry) => entry.id !== id),
        );
      });
    },
  };
}
