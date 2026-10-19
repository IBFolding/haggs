# Persistence and Project Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give haggs state that outlives a refresh — projects that can be created, listed, renamed, deleted, autosaved, exported and imported.

**Architecture:** A `Kv` seam (get/set by key) with an IndexedDB implementation in the browser and an in-memory one everywhere else, ported from `open-higgsfield`. A `ProjectStore` sits on that seam and keeps a small index separate from the project records, so the library list never loads every project. Everything below the UI is pure and runs in Node, which is what makes it testable without a browser or a DOM harness.

**Tech Stack:** TypeScript, Next.js 16 App Router, React 19, plain CSS. Tests run on `node --import tsx --test` (Node 22's built-in runner) — no new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-18-storyboard-workspace-design.md`

## Global Constraints

- No new runtime dependencies. The repo has `@fal-ai/client`, `next`, `react`, `react-dom` and nothing else; keep it that way.
- Unit tests are named `*.spec.ts`. The existing `src/catalog/pricing.test.ts` is a live-network drift alarm run by `npm run prices`, not a unit test — the runner must not pick it up.
- `shots` array order **is** story order. No `rank` or `index` field on `Shot`, ever.
- The prompt is derived, never stored. `Shot` has no `prompt` field in this step; only `render.promptHash`.
- Nothing in `src/story/` may import from `src/app/` — the store is used by the UI, not the reverse.
- No generation, no cost, no network in this step. Persistence only.
- Export format string is exactly `"haggs.project/1"`.

## Review Focus

Five failure modes the spec implies that happy-path tests miss. Each has a test pinned to the task that owns the code.

1. **Import of JSON that is not a haggs project** (wrong `format`, or arbitrary valid JSON) — must reject with a readable message, never throw a raw parse error at the user. → Task 4.
2. **Import of a project whose id already exists** — must not silently overwrite existing work; the import gets a fresh id. → Task 4.
3. **IndexedDB unavailable** (private browsing, blocked storage, SSR) — must fall back to memory and still render, never throw on first paint. → Task 1.
4. **A corrupt or half-written index** — a bad index record must not make every project unreachable; the store degrades to an empty list rather than throwing. → Task 3.
5. **Autosave racing a rename or delete** — a save landing after a delete must not resurrect the project in the index. → Task 5.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/story/kv.ts` | The `Kv` seam: `memoryKv`, `idbKv`, `defaultKv`. Ported from `open-higgsfield/src/openhiggsfield/idb.ts`. |
| `src/story/model.ts` | `Project`, `Shot`, `Thread`, `Direction` types and `createProject`. Pure. |
| `src/story/store.ts` | `ProjectStore` over a `Kv`: list, load, save, remove. Owns the index. |
| `src/story/transfer.ts` | `exportProject` / `importProject` — JSON with format validation. |
| `src/story/use-autosave.ts` | Debounced save hook for the UI. |
| `src/app/library/page.tsx` | The projects list surface. |
| `src/app/library/library.tsx` | The client component: list, create, rename, delete, export, import. |

Tasks 1–4 are pure logic with automated tests. Task 5 is a React hook tested through its pure core. Task 6 is UI; this repo has no DOM test harness and adding one (jsdom + a testing library) would violate the no-new-dependencies constraint for a single screen, so Task 6 is verified manually with explicit steps. That is a deliberate trade, not an omission.

---

### Task 1: The Kv seam

**Files:**
- Create: `src/story/kv.ts`
- Test: `src/story/kv.spec.ts`
- Modify: `package.json` (add the `test` script)

**Interfaces:**
- Consumes: nothing.
- Produces: `type Kv = { get<T>(key: string): Promise<T | undefined>; set(key: string, value: unknown): Promise<void>; remove(key: string): Promise<void> }`, `memoryKv(): Kv`, `idbKv(): Kv`, `defaultKv(): Kv`.

Note: this adds `remove` to the shape `open-higgsfield` ships, because project deletion needs it.

- [ ] **Step 1: Add the test script to `package.json`**

```json
"test": "node --import tsx --test \"src/**/*.spec.ts\""
```

- [ ] **Step 2: Write the failing tests**

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { defaultKv, memoryKv } from "./kv";

test("memoryKv round-trips a value", async () => {
  const kv = memoryKv();
  await kv.set("a", { n: 1 });
  assert.deepEqual(await kv.get("a"), { n: 1 });
});

test("memoryKv returns undefined for a missing key", async () => {
  assert.equal(await memoryKv().get("nope"), undefined);
});

test("memoryKv remove deletes the key", async () => {
  const kv = memoryKv();
  await kv.set("a", 1);
  await kv.remove("a");
  assert.equal(await kv.get("a"), undefined);
});

// Review Focus 3: no indexedDB in Node, so this must not throw.
test("defaultKv falls back to memory when indexedDB is absent", async () => {
  assert.equal(typeof indexedDB, "undefined");
  const kv = defaultKv();
  await kv.set("a", 1);
  assert.equal(await kv.get("a"), 1);
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npm test`
Expected: FAIL — cannot find module `./kv`.

- [ ] **Step 4: Implement `src/story/kv.ts`**

Port `open-higgsfield/src/openhiggsfield/idb.ts`, changing: `DB_NAME` to `"haggs"`, and add `remove(key)` using `store.delete(key)` in a `readwrite` transaction. Keep the `request()` helper's transaction-completion semantics as written there — resolving on `tx.oncomplete` rather than `req.onsuccess` is what makes a write durable before the promise settles.

- [ ] **Step 5: Run to verify it passes**

Run: `npm test`
Expected: PASS, 4 tests.

- [ ] **Step 6: Commit**

```bash
git add package.json src/story/kv.ts src/story/kv.spec.ts
git commit -m "feat: add Kv storage seam with memory and IndexedDB backings"
```

---

### Task 2: The project model

**Files:**
- Create: `src/story/model.ts`
- Test: `src/story/model.spec.ts`

**Interfaces:**
- Consumes: `AspectRatio` from `src/providers/types.ts`.
- Produces: types `Project`, `Shot`, `Thread`, `Direction`, `Note`, `ProjectSummary`; `createProject(name: string): Project`; `summarize(project: Project): ProjectSummary`.

Types are exactly as specified in the design doc's Data model section. `Direction` is the `direction` shape from `src/workflows/product-photoshoot/modes.ts` (`camera`, `light`, `staging`, `constants`) promoted to a shared exported type — do not redefine it differently.

`ProjectSummary` is `{ id, name, updatedAt, shotCount }` — what the library list needs without loading a whole project.

- [ ] **Step 1: Write the failing tests**

```ts
test("createProject returns an empty, named, timestamped project", () => {
  const p = createProject("Light Again");
  assert.equal(p.name, "Light Again");
  assert.deepEqual(p.shots, []);
  assert.deepEqual(p.threads, []);
  assert.deepEqual(p.notes, []);
  assert.ok(p.id.length > 0);
  assert.equal(p.createdAt, p.updatedAt);
});

test("createProject gives every project a distinct id", () => {
  assert.notEqual(createProject("a").id, createProject("a").id);
});

test("summarize reports the shot count", () => {
  const p = createProject("x");
  assert.equal(summarize(p).shotCount, 0);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test`
Expected: FAIL — cannot find module `./model`.

- [ ] **Step 3: Implement `src/story/model.ts`**

Use `crypto.randomUUID()` for ids — available in Node 22 and in every browser this targets.

- [ ] **Step 4: Run to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/story/model.ts src/story/model.spec.ts
git commit -m "feat: add project, shot and thread model"
```

---

### Task 3: The project store

**Files:**
- Create: `src/story/store.ts`
- Test: `src/story/store.spec.ts`

**Interfaces:**
- Consumes: `Kv` from Task 1; `Project`, `ProjectSummary`, `summarize` from Task 2.
- Produces: `createProjectStore(kv: Kv): ProjectStore` where
  `ProjectStore = { list(): Promise<ProjectSummary[]>; load(id: string): Promise<Project | undefined>; save(project: Project): Promise<void>; remove(id: string): Promise<void> }`.

Keys: the index is `"projects/index"` (a `ProjectSummary[]`); each project is `"projects/<id>"`. `save` writes the record, then updates the index, and sets `updatedAt` to now. `list` returns newest-updated first.

- [ ] **Step 1: Write the failing tests**

```ts
test("save then load round-trips a project", async () => {
  const store = createProjectStore(memoryKv());
  const p = createProject("A");
  await store.save(p);
  assert.equal((await store.load(p.id))?.name, "A");
});

test("list returns summaries newest-updated first", async () => {
  const store = createProjectStore(memoryKv());
  const a = createProject("A");
  const b = createProject("B");
  await store.save(a);
  await store.save(b);
  assert.deepEqual((await store.list()).map((s) => s.name), ["B", "A"]);
});

test("save stamps updatedAt", async () => {
  const store = createProjectStore(memoryKv());
  const p = { ...createProject("A"), updatedAt: 0 };
  await store.save(p);
  assert.ok((await store.load(p.id))!.updatedAt > 0);
});

test("remove drops the record and the index entry", async () => {
  const store = createProjectStore(memoryKv());
  const p = createProject("A");
  await store.save(p);
  await store.remove(p.id);
  assert.equal(await store.load(p.id), undefined);
  assert.deepEqual(await store.list(), []);
});

test("load of an unknown id returns undefined", async () => {
  assert.equal(await createProjectStore(memoryKv()).load("nope"), undefined);
});

// Review Focus 4: a corrupt index must not make the library unusable.
test("list returns empty when the index is corrupt", async () => {
  const kv = memoryKv();
  await kv.set("projects/index", "not an array");
  assert.deepEqual(await createProjectStore(kv).list(), []);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test`
Expected: FAIL — cannot find module `./store`.

- [ ] **Step 3: Implement `src/story/store.ts`**

`list` must treat a non-array index as empty rather than throwing.

- [ ] **Step 4: Run to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/story/store.ts src/story/store.spec.ts
git commit -m "feat: add project store over the Kv seam"
```

---

### Task 4: Export and import

**Files:**
- Create: `src/story/transfer.ts`
- Test: `src/story/transfer.spec.ts`

**Interfaces:**
- Consumes: `Project` from Task 2.
- Produces: `exportProject(project: Project): string`; `importProject(json: string): Project` (throws `TransferError` on bad input); `class TransferError extends Error`.

The exported envelope is `{ format: "haggs.project/1", exportedAt: number, project: Project }`, serialized with `JSON.stringify(value, null, 2)` — readable and diffable is a stated requirement of the spec, so the indentation is part of the contract.

`importProject` assigns a **fresh id** and resets `createdAt`/`updatedAt` to now, so importing never overwrites an existing project.

- [ ] **Step 1: Write the failing tests**

```ts
test("export then import round-trips the content", () => {
  const p = createProject("A");
  const back = importProject(exportProject(p));
  assert.equal(back.name, "A");
  assert.deepEqual(back.shots, []);
});

test("export is indented for readability", () => {
  assert.ok(exportProject(createProject("A")).includes("\n  "));
});

// Review Focus 2: importing must never clobber an existing project.
test("import assigns a fresh id", () => {
  const p = createProject("A");
  assert.notEqual(importProject(exportProject(p)).id, p.id);
});

// Review Focus 1: hostile and merely wrong input both get a readable error.
test("import rejects a wrong format marker", () => {
  const json = JSON.stringify({ format: "comfy/1", project: {} });
  assert.throws(() => importProject(json), TransferError);
});

test("import rejects arbitrary valid JSON", () => {
  assert.throws(() => importProject('{"hello":"world"}'), TransferError);
});

test("import rejects malformed JSON with a readable error", () => {
  assert.throws(() => importProject("{{{"), TransferError);
});

test("import rejects an envelope whose project is not shaped like one", () => {
  const json = JSON.stringify({ format: "haggs.project/1", project: { name: 7 } });
  assert.throws(() => importProject(json), TransferError);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test`
Expected: FAIL — cannot find module `./transfer`.

- [ ] **Step 3: Implement `src/story/transfer.ts`**

Validate in this order: JSON parses, envelope is an object, `format` matches exactly, `project` is an object with a string `name` and array `shots`/`threads`/`notes`. Every failure path throws `TransferError` with a message a person can act on — it is shown in the UI verbatim.

- [ ] **Step 4: Run to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/story/transfer.ts src/story/transfer.spec.ts
git commit -m "feat: add project export and import with format validation"
```

---

### Task 5: Autosave

**Files:**
- Create: `src/story/use-autosave.ts`
- Test: `src/story/use-autosave.spec.ts`

**Interfaces:**
- Consumes: `ProjectStore` from Task 3; `Project` from Task 2.
- Produces: `createSaveQueue(store: ProjectStore, delayMs?: number): SaveQueue` where
  `SaveQueue = { queue(project: Project): void; drop(id: string): void; flush(): Promise<void> }`;
  and the React hook `useAutosave(store: ProjectStore, project: Project | undefined): void`.

The hook is a thin wrapper; `createSaveQueue` holds all the behavior so it can be tested without React. Default delay 600ms.

`drop(id)` is what delete calls: it cancels any pending save for that id. Without it, an autosave in flight when the user deletes resurrects the project.

- [ ] **Step 1: Write the failing tests**

```ts
test("queue coalesces rapid edits into one save", async () => {
  const store = createProjectStore(memoryKv());
  const q = createSaveQueue(store, 5);
  const p = createProject("A");
  q.queue({ ...p, name: "B" });
  q.queue({ ...p, name: "C" });
  await q.flush();
  assert.equal((await store.load(p.id))?.name, "C");
  assert.equal((await store.list()).length, 1);
});

// Review Focus 5: a save landing after a delete must not resurrect it.
test("drop cancels a pending save", async () => {
  const store = createProjectStore(memoryKv());
  const q = createSaveQueue(store, 5);
  const p = createProject("A");
  q.queue(p);
  q.drop(p.id);
  await q.flush();
  assert.deepEqual(await store.list(), []);
});

test("flush with nothing queued resolves", async () => {
  await createSaveQueue(createProjectStore(memoryKv()), 5).flush();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test`
Expected: FAIL — cannot find module `./use-autosave`.

- [ ] **Step 3: Implement `src/story/use-autosave.ts`**

Hold one pending project per id in a `Map`. `flush` waits for the debounce to elapse and all in-flight writes to settle. The hook calls `queue` in a `useEffect` on `project`, and `flush` on unmount.

- [ ] **Step 4: Run to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/story/use-autosave.ts src/story/use-autosave.spec.ts
git commit -m "feat: add debounced autosave queue"
```

---

### Task 6: The library surface

**Files:**
- Create: `src/app/library/page.tsx`, `src/app/library/library.tsx`
- Modify: `src/app/studio.tsx` (the `NAV` array and its click handling)
- Modify: `src/app/globals.css` (library styles)

**Interfaces:**
- Consumes: everything above. The client component builds its store with `createProjectStore(defaultKv())`.
- Produces: the `/library` route.

No automated tests — see the File Structure note. Verified manually.

- [ ] **Step 1: Build the library client component**

`src/app/library/library.tsx` is a client component listing projects newest-first, each row showing name, shot count and relative updated time, with: **New project**, inline **rename**, **delete** (confirm first — deletion is not undoable in this step), **Export** (download a `.json` via a Blob URL named after the project), and **Import** (a file input; on `TransferError`, show `error.message` verbatim).

Match the existing visual language in `globals.css` — the `pill`, `opt` and `sheet` classes already carry it. Do not introduce a second look.

- [ ] **Step 2: Add the route**

`src/app/library/page.tsx` renders `<Library />`.

- [ ] **Step 3: Make the nav item real**

In `studio.tsx`, the `NAV` array is currently five inert strings. Turn each into `{ label, href }` and render the items as links; `Library` points at `/library`, `Create` at `/`. Leave `Explore`, `Video` and `Edit` inert for now — they are wired in later steps of the spec and a dead link is worse than a dead button.

- [ ] **Step 4: Verify manually**

Run: `npm run dev`, open `http://localhost:3111/library`.

Check, in order:
1. Create a project — it appears in the list.
2. Reload the page — it is still there. *(This is the whole point of the step.)*
3. Rename it — the new name survives a reload.
4. Export it — the file downloads and is readable, indented JSON.
5. Import that same file — a second project appears; the original is untouched.
6. Import a file that is not a project (any other `.json`) — a readable error appears and nothing is created.
7. Delete a project — it goes, and stays gone after a reload.
8. Open the page in a private window — the list renders empty rather than erroring.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/app/library src/app/studio.tsx src/app/globals.css
git commit -m "feat: add the project library surface"
```

---

## Done when

`npm test` passes, `npm run typecheck` exits 0, and a project created in the browser survives a refresh, a rename, an export, a re-import and a delete.
