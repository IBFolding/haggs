"use client";

import { useEffect, useRef } from "react";

import type { Project } from "./model";
import type { ProjectStore } from "./store";

/**
 * Editing shouldn't need a save button, and it shouldn't write on every
 * keystroke either. Edits collect per project and land once the typing stops.
 *
 * All the behaviour lives in `createSaveQueue` so it can be tested without a
 * DOM; the hook is the thin React binding over it.
 */

export type SaveQueue = {
  queue(project: Project): void;
  /** Cancel a pending save — what delete calls, so a write in flight
   *  cannot put a deleted project back in the index. */
  drop(id: string): void;
  flush(): Promise<void>;
};

const DEFAULT_DELAY_MS = 600;

export function createSaveQueue(
  store: ProjectStore,
  delayMs = DEFAULT_DELAY_MS,
  onError?: (error: unknown) => void,
): SaveQueue {
  const pending = new Map<string, Project>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let running: Promise<void> = Promise.resolve();

  /**
   * Saves run one after another, never in parallel: `store.save` reads the
   * index, edits it and writes it back, so two overlapping saves would each
   * read the same index and the second would drop the first's entry.
   */
  function writePending(): Promise<void> {
    const batch = [...pending.values()];
    pending.clear();
    return batch.reduce(
      (chain, project) => chain.then(() => store.save(project)),
      Promise.resolve(),
    );
  }

  /**
   * Chaining with `.then` alone meant one rejected save — a quota error, an
   * aborted transaction — turned `running` into a rejected promise, and every
   * later `.then(writePending)` was skipped. Autosave then stopped for the rest
   * of the session without saying so. Catching keeps the chain alive, and the
   * failure is reported rather than swallowed.
   */
  function advance(): void {
    running = running.then(writePending).catch((error: unknown) => {
      onError?.(error);
    });
  }

  function schedule(): void {
    if (timer) return;
    timer = setTimeout(() => {
      timer = undefined;
      advance();
    }, delayMs);
  }

  return {
    queue(project) {
      pending.set(project.id, project);
      schedule();
    },

    drop(id) {
      pending.delete(id);
    },

    async flush() {
      if (timer) {
        clearTimeout(timer);
        timer = undefined;
      }
      advance();
      await running;
    },
  };
}

export function useAutosave(store: ProjectStore, project: Project | undefined): void {
  const queueRef = useRef<SaveQueue | null>(null);
  queueRef.current ??= createSaveQueue(store);

  useEffect(() => {
    if (project) queueRef.current?.queue(project);
  }, [project]);

  // Leaving the page shouldn't drop the last few seconds of edits.
  useEffect(() => {
    const queue = queueRef.current;
    return () => {
      void queue?.flush();
    };
  }, []);
}
