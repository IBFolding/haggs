"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { getModelCard, MODELS } from "../../catalog/models";
import { coerceSettings } from "../../catalog/settings";
import { hashPrompt, promptFor, staleShots } from "../../story/assemble";
import { defaultKv } from "../../story/kv";
import { moveShot, newShot, type Project, type Shot } from "../../story/model";
import { commit, view } from "../../story/boards";
import { createProjectStore } from "../../story/store";
import { createSaveQueue } from "../../story/use-autosave";
import { rates, run, type Rate } from "../actions";
import { addSubplot, placeShot } from "../../story/flow";
import { Nav, openKeys } from "../nav";
import { FlowCanvas } from "./flow-canvas";
import { shoot } from "../shoot";
import { addTake } from "../../story/takes";
import { PROJECT_SAVED } from "../agent";
import { ProjectTabs } from "../project-tabs";
import { animatePlan, picturePlan, readyToAnimate } from "../../story/animate-all";
import { makeStill } from "../series-actions";
import { AnimateAll } from "./animate-all";

export function Board({ id, boardId }: { id: string; boardId?: string | undefined }) {
  /** The whole project; the state below is one board's view of it. */
  const full = useRef<Project | null>(null);
  const store = useMemo(() => createProjectStore(defaultKv()), []);
  const saves = useMemo(() => createSaveQueue(store), [store]);

  const [project, setProject] = useState<Project | null>(null);
  const [missing, setMissing] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [running, setRunning] = useState<string[]>([]);
  const [rateMap, setRateMap] = useState<Record<string, Rate>>({});
  const [error, setError] = useState<string | null>(null);
  const dragging = useRef<number | null>(null);
  const [animating, setAnimating] = useState(false);
  const [picturing, setPicturing] = useState(false);

  // The producer changed this project from the chat: load it again, so this page's next save keeps the change.
  useEffect(() => {
    const reload = (e: Event) => {
      if ((e as CustomEvent<{ id: string }>).detail?.id !== id) return;
      void store.load(id).then((found) => {
        if (!found) return;
        full.current = found;
        setProject(view(found, boardId));
      });
    };
    window.addEventListener(PROJECT_SAVED, reload);
    return () => window.removeEventListener(PROJECT_SAVED, reload);
  }, [store, id, boardId]);

  useEffect(() => {
    void store.load(id).then((found) => {
      if (found) {
        full.current = found;
        setProject(view(found, boardId));
      } else setMissing(true);
    });
    void rates().then((list) => setRateMap(Object.fromEntries(list.map((r) => [r.id, r]))));
  }, [store, id, boardId]);

  /** Every edit goes through here, so nothing changes without being saved. */
  const edit = useCallback(
    (change: (current: Project) => Project) => {
      setProject((current) => {
        if (!current) return current;
        const next = change(current);
        saves.queue((full.current = commit(full.current ?? next, boardId, next)));
        return next;
      });
    },
    [saves],
  );

  const stale = useMemo(() => (project ? staleShots(project) : []), [project]);
  const index = project?.shots.findIndex((shot) => shot.id === selected) ?? -1;
  const shot = index >= 0 ? project!.shots[index] : undefined;
  const prompt = project && index >= 0 ? promptFor(project, index) : "";

  const costOf = useCallback(
    (target: Shot) => {
      const rate = rateMap[target.model.id];
      return rate?.usd ?? null;
    },
    [rateMap],
  );

  const staleCost = useMemo(() => {
    if (!project) return 0;
    return project.shots
      .filter((s) => stale.includes(s.id))
      .reduce((sum, s) => sum + (costOf(s) ?? 0), 0);
  }, [project, stale, costOf]);

  const generate = useCallback(
    async (target: Shot) => {
      if (!project) return;
      const at = project.shots.findIndex((s) => s.id === target.id);
      setError(null);
      setRunning((prior) => [...prior, target.id]);
      const result = await shoot(project, at);
      setRunning((prior) => prior.filter((runId) => runId !== target.id));

      if (!result.ok) {
        if (result.needsKey) openKeys();
        setError(result.reason);
        return;
      }
      // A new take is added, never written over the last one.
      edit((current) => ({
        ...current,
        shots: current.shots.map((s) => (s.id === target.id ? addTake(s, result.render, result.origin) : s)),
      }));
    },
    [project, edit],
  );

  const plan = useMemo(() => (project ? animatePlan(project) : { shots: [], total: 0 }), [project]);
  const picPlan = useMemo(() => (project ? picturePlan(project) : { shots: [], total: 0 }), [project]);

  /** Makes the picture for one empty shot from its description, in the board's frame shape, and keeps it as the shot's first take. */
  const pictureOne = useCallback(
    async (shotId: string): Promise<string | null> => {
      const latest = full.current ? view(full.current, boardId) : project;
      const target = latest?.shots.find((s) => s.id === shotId);
      if (!latest || !target) return "That shot is not on the board any more.";
      setRunning((prior) => [...prior, shotId]);
      const made = await makeStill(target.beat, latest.aspect ?? "16:9", target.refs ?? []);
      setRunning((prior) => prior.filter((runId) => runId !== shotId));
      if (!made.ok) {
        if (made.needsKey) openKeys();
        return made.reason;
      }
      edit((current) => ({
        ...current,
        shots: current.shots.map((s) => (s.id === shotId ? addTake(s, { url: made.url, kind: "image", usd: 0.0686, promptHash: hashPrompt(promptFor(current, current.shots.findIndex((x) => x.id === shotId))), at: Date.now() }, "FLUX 3 still") : s)),
      }));
      return null;
    },
    [project, boardId, edit],
  );

  /** Animates one still: the shot moves to MiniMax H3 and its clip lands as a new take. */
  const animateOne = useCallback(
    async (shotId: string): Promise<string | null> => {
      // The latest saved board, so takes that landed earlier in the run are kept.
      const latest = full.current ? view(full.current, boardId) : project;
      if (!latest) return "The board isn't loaded.";
      const at = latest.shots.findIndex((s) => s.id === shotId);
      if (at < 0) return "That shot is not on the board any more.";
      const prepared = { ...latest, shots: latest.shots.map((s, i) => (i === at ? readyToAnimate(s) : s)) };
      setRunning((prior) => [...prior, shotId]);
      const result = await shoot(prepared, at);
      setRunning((prior) => prior.filter((runId) => runId !== shotId));
      if (!result.ok) {
        if (result.needsKey) openKeys();
        return result.reason;
      }
      edit((current) => ({
        ...current,
        shots: current.shots.map((s) => (s.id === shotId ? addTake(readyToAnimate(s), result.render, result.origin) : s)),
      }));
      return null;
    },
    [project, boardId, edit],
  );

  const drop = useCallback(
    (to: number) => {
      const from = dragging.current;
      dragging.current = null;
      if (from === null || from === to) return;
      edit((current) => ({ ...current, shots: moveShot(current.shots, from, to) }));
    },
    [edit],
  );

  if (missing) {
    return (
      <div className="app">
        <Nav current="Projects" />
        <div className="canvas">
          <div className="library">
            <div className="library-blank">
              <p>That project isn&rsquo;t here.</p>
              <p className="library-blank-sub">
                It may have been deleted, or made in another browser — projects are
                kept on the machine that made them.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!project) return <div className="app"><Nav current="Projects" /></div>;

  return (
    <div className="app">
      <Nav current="Projects" />
      <ProjectTabs project={full.current ?? project} boardId={boardId} current="board" />

      <div className="board">
        <header className="board-head">
          <input
            className="board-name"
            value={project.name}
            onChange={(event) => edit((current) => ({ ...current, name: event.target.value }))}
            aria-label="Project name"
          />
          <span className="board-count">
            {project.shots.length} shot{project.shots.length === 1 ? "" : "s"}
          </span>
          {stale.length > 0 && (
            <span className="board-stale">
              Moving a shot changed what {stale.length === 1 ? "one shot continues" : `${stale.length} shots continue`} from.
              Re-running them costs ${staleCost.toFixed(3)}.
            </span>
          )}
        </header>

        {error && <p className="library-error" role="alert">{error}</p>}

        <div className="board-tools">
          <button
            className="pill on"
            onClick={() =>
              edit((current) => {
                const made = newShot();
                setSelected(made.id);
                return { ...current, shots: [...current.shots, made] };
              })
            }
          >
            + Add shot
          </button>
          <button
            className="pill"
            onClick={() => {
              const name = window.prompt("Name the subplot — e.g. “B plot: the ferry”");
              if (name?.trim()) edit((current) => addSubplot(current, name));
            }}
          >
            + Subplot
          </button>
          {picPlan.shots.length > 0 && (
            <button className="pill on" onClick={() => setPicturing(true)} title="Make a picture for every shot that has a description and nothing to show yet">
              Make pictures · {picPlan.shots.length}
            </button>
          )}
          {plan.shots.length > 0 && (
            <button className="pill" onClick={() => setAnimating(true)} title="Turn the board's stills into video in one go">
              Animate stills · {plan.shots.length}
            </button>
          )}
        </div>
        {animating && <AnimateAll plan={plan} onRun={animateOne} onClose={() => setAnimating(false)} />}
        {picturing && (
          <AnimateAll
            plan={picPlan}
            onRun={pictureOne}
            onClose={() => setPicturing(false)}
            words={{ title: "Make pictures", intro: "Each shot with a description and nothing to show gets a FLUX 3 picture made from it, in this board's frame shape. They land as the shot's first take; swap or re-roll any of them after.", verb: "Make", done: "made. Each is the shot's first take.", doing: "Making", note: "About 7¢ a picture at 1K, billed to your Comfy credits. An estimate, not an invoice.", meta: (s) => `$${s.usd.toFixed(3)}` }}
          />
        )}

        <FlowCanvas
          project={project}
          selected={selected}
          stale={stale}
          running={running}
          onSelect={setSelected}
          onPlace={(shotId, col, lane) => edit((current) => placeShot(current, shotId, col, lane))}
          onPictures={(pictures, col, lane) =>
            edit((current) => {
              // Each picture starts a shot with the picture as its frame; generating later can build from it.
              const made: Shot[] = pictures.map((picture) => ({
                ...newShot(),
                heading: "",
                beat: "",
                threadIds: lane ? [lane] : [],
                render: { url: picture.url, kind: "image" as const, usd: null, promptHash: "", at: Date.now() },
              }));
              const shots = [...current.shots];
              shots.splice(Math.min(col, shots.length), 0, ...made);
              if (made[0]) setSelected(made[0].id);
              const next = { ...current, shots };
              // Hash each against the prompt it now has, so a picture does not arrive already out of date.
              return {
                ...next,
                shots: shots.map((s, i) => (made.some((m) => m.id === s.id) && s.render ? { ...s, render: { ...s.render, promptHash: hashPrompt(promptFor(next, i)) } } : s)),
              };
            })
          }
        />
      </div>

      {shot && (
        <div className="dock">
          <div className="composer">
            <div className="composer-top">
              <div className="inspect">
                <input
                  className="inspect-head"
                  value={shot.heading}
                  placeholder="INT. ALLEY — NIGHT"
                  onChange={(event) =>
                    edit((current) => ({
                      ...current,
                      shots: current.shots.map((s) =>
                        s.id === shot.id ? { ...s, heading: event.target.value } : s,
                      ),
                    }))
                  }
                />
                <textarea
                  className="say"
                  value={shot.beat}
                  placeholder="What happens in this shot — one action"
                  onChange={(event) =>
                    edit((current) => ({
                      ...current,
                      shots: current.shots.map((s) =>
                        s.id === shot.id ? { ...s, beat: event.target.value } : s,
                      ),
                    }))
                  }
                />
                <details className="inspect-prompt">
                  <summary>
                    The prompt this shot will run
                    {index > 0 ? ", continuing from the shot before it" : ", opening the sequence"}
                  </summary>
                  <pre>{prompt || "Add a beat and the prompt appears here."}</pre>
                </details>
              </div>
            </div>

            <div className="composer-bottom">
              <select
                className="pill on"
                value={shot.model.id}
                onChange={(event) =>
                  edit((current) => ({
                    ...current,
                    shots: current.shots.map((s) =>
                      s.id === shot.id
                        ? { ...s, model: { id: event.target.value, settings: {} } }
                        : s,
                    ),
                  }))
                }
              >
                {MODELS.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name}
                  </option>
                ))}
              </select>

              <button
                className={`pill${shot.locked ? " on" : ""}`}
                onClick={() =>
                  edit((current) => ({
                    ...current,
                    shots: current.shots.map((s) =>
                      s.id === shot.id ? { ...s, locked: !s.locked } : s,
                    ),
                  }))
                }
                title="A locked shot is left alone when a reorder changes the board"
              >
                {shot.locked ? "Locked" : "Lock"}
              </button>

              <button
                className="plain danger"
                onClick={() => {
                  setSelected(null);
                  edit((current) => ({
                    ...current,
                    shots: current.shots.filter((s) => s.id !== shot.id),
                  }));
                }}
              >
                Delete shot
              </button>

              <button
                className="fire"
                disabled={running.includes(shot.id) || !shot.beat.trim()}
                onClick={() => void generate(shot)}
              >
                {running.includes(shot.id) ? "Generating…" : shot.render ? "Run again" : "Generate"}
                <span className="cost">
                  {costOf(shot) === null ? "···" : `$${costOf(shot)!.toFixed(3)}`}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
