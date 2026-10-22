"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { addBoard, boardOf, normalize, removeBoard } from "../story/boards";
import { defaultKv } from "../story/kv";
import type { Project } from "../story/model";
import { createProjectStore } from "../story/store";

/**
 * The bar under the header on every project page: which project, which
 * board, and the four places that board's work moves through — plan it on
 * Sheets, shoot it on the Board, assemble it in the Cut, keep what it is made
 * of in Media. Switching board keeps you on the same tab.
 */

const TABS = [
  { id: "sheets", label: "Sheets", path: "/sheets" },
  { id: "board", label: "Board", path: "" },
  { id: "cut", label: "Cut", path: "/cut" },
  { id: "media", label: "Media", path: "/media" },
] as const;

export type ProjectTab = (typeof TABS)[number]["id"];

export const LAST_BOARD = "haggs.last-board";
const NEW = "__new__";
const DELETE = "__delete__";

/** How many things Claude has sent this project and the person hasn't applied or dismissed. Development only. */
function useWaiting(projectId: string): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    let live = true;
    const check = () =>
      fetch(`/api/bridge/inbox?project=${encodeURIComponent(projectId)}`)
        .then((r) => r.json() as Promise<{ items?: unknown[] }>)
        .then((b) => live && setCount(b.items?.length ?? 0))
        .catch(() => undefined);
    void check();
    const timer = setInterval(check, 5000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [projectId]);
  return count;
}

export function ProjectTabs({ project, boardId, current }: { project: Project; boardId?: string | undefined; current: ProjectTab }) {
  const router = useRouter();
  const waiting = useWaiting(project.id);
  // Remembered so Editor in the header can take you straight back to this board's cut.
  useEffect(() => {
    try {
      localStorage.setItem(LAST_BOARD, JSON.stringify({ project: project.id, board: boardOf(project, boardId).id }));
    } catch {
      // A convenience only.
    }
  }, [project, boardId]);
  const store = useMemo(() => createProjectStore(defaultKv()), []);
  const boards = normalize(project).boards!;
  const board = boardOf(project, boardId);
  const path = TABS.find((t) => t.id === current)!.path;
  const href = (tabPath: string, b = board.id) => `/board/${project.id}${tabPath}?b=${encodeURIComponent(b)}`;

  async function choose(value: string) {
    if (value === DELETE) {
      const latest = (await store.load(project.id)) ?? project;
      const doomed = boardOf(latest, board.id);
      if (!window.confirm(`Delete the board “${doomed.name}” and its ${doomed.shots.length} shot${doomed.shots.length === 1 ? "" : "s"}? The picture and video files aren't deleted, but the board can't be brought back.`)) return;
      try {
        const kept = removeBoard(latest, doomed.id);
        await store.save(kept);
        router.push(href(path, kept.boards![0]!.id));
      } catch (caught) {
        window.alert(caught instanceof Error ? caught.message : "That board couldn't be deleted.");
      }
      return;
    }
    if (value !== NEW) {
      router.push(href(path, value));
      return;
    }
    const name = window.prompt("Name the new board — an episode, a cut, a version:");
    if (!name?.trim()) return;
    // Load fresh so a board made here never overwrites work saved by the page underneath.
    const latest = (await store.load(project.id)) ?? project;
    const made = addBoard(latest, name, "board");
    await store.save(made.project);
    router.push(href("/sheets", made.board.id));
  }

  return (
    <div className="ptabs">
      <Link className="ptabs-back" href="/library">Projects</Link>
      <span className="ptabs-sep">/</span>
      <span className="ptabs-name">{project.name}</span>
      <span className="ptabs-sep">/</span>
      <select className="ptabs-board" aria-label="Board" value={board.id} onChange={(e) => void choose(e.target.value)}>
        {boards.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name} · {b.shots.length} shot{b.shots.length === 1 ? "" : "s"}
          </option>
        ))}
        <option value={NEW}>+ New board…</option>
        {boards.length > 1 && <option value={DELETE}>Delete this board…</option>}
      </select>
      {waiting > 0 && current !== "sheets" && (
        <Link className="ptabs-claude" href={href("/sheets")}>
          From Claude · {waiting} to review
        </Link>
      )}
      <nav className="ptabs-list" aria-label="Project">
        {TABS.map((tab, i) => (
          <Link key={tab.id} href={href(tab.path)} aria-current={tab.id === current ? "page" : undefined}>
            <i>{i + 1}</i>
            {tab.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
