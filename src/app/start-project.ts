"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo } from "react";

import { defaultKv } from "../story/kv";
import type { PictureRun as Run } from "../story/runs";
import { projectFrom } from "../story/save-run";
import { createProjectStore } from "../story/store";

/** Start a project from any picture or clip, and open its board. */
export function useStartProject() {
  const router = useRouter();
  const store = useMemo(() => createProjectStore(defaultKv()), []);
  return useCallback(
    async (run: Run) => {
      const project = projectFrom(run);
      await store.save(project);
      router.push(`/board/${project.id}?b=${encodeURIComponent(project.boards![0]!.id)}`);
    },
    [store, router],
  );
}
