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

export function createProjectStore(kv: Kv): ProjectStore {
  /**
   * A half-written or hand-edited index must not make every project
   * unreachable, so anything that is not an array reads as an empty library
   * rather than throwing on first paint.
   */
  async function readIndex(): Promise<ProjectSummary[]> {
    const stored = await kv.get<unknown>(INDEX_KEY);
    return Array.isArray(stored) ? (stored as ProjectSummary[]) : [];
  }

  return {
    list() {
      return readIndex();
    },

    load(id) {
      return kv.get<Project>(recordKey(id));
    },

    async save(project) {
      const saved: Project = { ...project, updatedAt: Date.now() };
      await kv.set(recordKey(saved.id), saved);

      // The index is held newest-first rather than sorted on read: two saves
      // inside one millisecond carry the same timestamp, and ordering the
      // library by a value that ties is how a list starts shuffling itself.
      const index = await readIndex();
      const others = index.filter((entry) => entry.id !== saved.id);
      await kv.set(INDEX_KEY, [summarize(saved), ...others]);
    },

    async remove(id) {
      await kv.remove(recordKey(id));
      const index = await readIndex();
      await kv.set(
        INDEX_KEY,
        index.filter((entry) => entry.id !== id),
      );
    },
  };
}
