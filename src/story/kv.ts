/**
 * A key/value seam, so everything above it runs in Node as well as the browser.
 * The store, the transfer format and the autosave queue are all pure logic over
 * this interface, which is what lets them be tested without a DOM.
 *
 * Ported from open-higgsfield's idb.ts, plus `remove` — deleting a project needs
 * it, and that app never deletes.
 */

export type Kv = {
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown): Promise<void>;
  remove(key: string): Promise<void>;
};

const DB_NAME = "haggs";
const STORE = "kv";
const VERSION = 1;

export function memoryKv(): Kv {
  const map = new Map<string, unknown>();
  return {
    async get<T>(key: string) {
      return map.get(key) as T | undefined;
    },
    async set(key, value) {
      map.set(key, value);
    },
    async remove(key) {
      map.delete(key);
    },
  };
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Resolves on the transaction completing rather than on the request succeeding.
 * A request can succeed inside a transaction that then aborts, so settling on
 * `tx.oncomplete` is what makes a resolved write actually durable.
 */
function request<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const req = run(tx.objectStore(STORE));
        tx.oncomplete = () => resolve(req.result);
        tx.onabort = () => reject(tx.error ?? req.error);
        tx.onerror = () => reject(tx.error ?? req.error);
      }),
  );
}

export function idbKv(): Kv {
  return {
    get<T>(key: string) {
      return request("readonly", (store) => store.get(key)) as Promise<T | undefined>;
    },
    async set(key, value) {
      await request("readwrite", (store) => store.put(value, key));
    },
    async remove(key) {
      await request("readwrite", (store) => store.delete(key));
    },
  };
}

let browser: Kv | undefined;

/**
 * Memory when there is no IndexedDB — server rendering, but also a private
 * window or blocked site data, where the studio must still paint rather than
 * throw on first load.
 */
export function defaultKv(): Kv {
  if (typeof indexedDB === "undefined") return memoryKv();
  browser ??= idbKv();
  return browser;
}
