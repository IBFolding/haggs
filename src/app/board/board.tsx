"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { getModelCard, MODELS } from "../../catalog/models";
import { coerceSettings } from "../../catalog/settings";
import { hashPrompt, promptFor, staleShots } from "../../story/assemble";
import { defaultKv } from "../../story/kv";
import { moveShot, newShot, type Project, type Shot } from "../../story/model";
import { createProjectStore } from "../../story/store";
import { createSaveQueue } from "../../story/use-autosave";
import { rates, run, type Rate } from "../actions";
import { Nav } from "../nav";
import { ProjectTabs } from "../project-tabs";

export function Board({ id }: { id: string }) {
  const store = useMemo(() => createProjectStore(defaultKv()), []);
  const saves = useMemo(() => createSaveQueue(store), [store]);

  const [project, setProject] = useState<Project | null>(null);
  const [missing, setMissing] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [running, setRunning] = useState<string[]>([]);
  const [rateMap, setRateMap] = useState<Record<string, Rate>>({});
  const [error, setError] = useState<string | null>(null);
  const dragging = useRef<number | null>(null);

  useEffect(() => {
    void store.load(id).then((found) => {
      if (found) setProject(found);
      else setMissing(true);
    });
    void rates().then((list) => setRateMap(Object.fromEntries(list.map((r) => [r.id, r]))));
  }, [store, id]);

  /** Every edit goes through here, so nothing changes without being saved. */
  const edit = useCallback(
    (change: (current: Project) => Project) => {
      setProject((current) => {
        if (!current) return current;
        const next = change(current);
        saves.queue(next);
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
      const text = promptFor(project, at);
      if (!text.trim()) {
        setError("Give the shot a beat before generating it.");
        return;
      }

      setError(null);
      setRunning((prior) => [...prior, target.id]);

      const card = getModelCard(target.model.id);
      const settings = coerceSettings(card.settings, target.model.settings);
      const result = await run(target.model.id, text, settings);

      setRunning((prior) => prior.filter((runId) => runId !== target.id));

      if (!result.ok) {
        setError(result.reason);
        return;
      }

      const first = result.shots[0];
      if (!first) return;

      edit((current) => ({
        ...current,
        shots: current.shots.map((s) =>
          s.id === target.id
            ? {
                ...s,
                render: {
                  url: first.url,
                  kind: first.kind,
                  usd: result.usd,
                  // The hash of the prompt it was actually made from. This is
                  // the whole of staleness: move the shot and this stops
                  // matching, and the card says so.
                  promptHash: hashPrompt(text),
                  at: Date.now(),
                },
              }
            : s,
        ),
      }));
    },
    [project, edit],
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
      <Nav current="Projects">
        {stale.length > 0 && (
          <span className="stale-note">
            {stale.length} shot{stale.length === 1 ? "" : "s"} out of date
          </span>
        )}
      </Nav>
      <ProjectTabs id={id} name={project.name} current="board" />

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

        <div className="spine" role="list">
          {project.shots.map((item, at) => {
            const isStale = stale.includes(item.id);
            const busy = running.includes(item.id);
            return (
              <article
                key={item.id}
                role="listitem"
                className={`shot${selected === item.id ? " picked" : ""}${isStale ? " stale" : ""}`}
                draggable
                onDragStart={() => {
                  dragging.current = at;
                }}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => drop(at)}
                onClick={() => setSelected(item.id)}
                tabIndex={0}
              >
                <span className="shot-no">{at + 1}</span>

                <div className="shot-frame">
                  {busy ? (
                    <span className="shot-busy" />
                  ) : item.render ? (
                    item.render.kind === "video" ? (
                      <video src={item.render.url} muted loop playsInline />
                    ) : (
                      <img src={item.render.url} alt="" />
                    )
                  ) : (
                    <span className="shot-empty">not shot</span>
                  )}
                  {isStale && <span className="shot-badge">out of date</span>}
                  {item.locked && <span className="shot-lock">locked</span>}
                </div>

                <p className="shot-heading">{item.heading || "Untitled shot"}</p>
                <p className="shot-beat">{item.beat || "No beat yet"}</p>
              </article>
            );
          })}

          <button
            className="shot add"
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
        </div>
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
