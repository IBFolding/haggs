"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { cameraMove, cameraMoves, MOVE_GROUPS } from "../../../../sheets/camera";
import { parseScreenplay, type Screenplay } from "../../../../sheets/screenplay";
import {
  SHEETS, addBeat, addRow, addShot, alterRows, buildSheets, exportSheets, fixCell, importSheets,
  moveRow, promptRows, qaSheet, removeRow, runtime, syncBoard, type SheetId, type Sheets, type ShotRow,
} from "../../../../sheets/sheets";
import { defaultKv } from "../../../../story/kv";
import type { Project } from "../../../../story/model";
import { createProjectStore } from "../../../../story/store";
import { Nav } from "../../../nav";
import { ProjectTabs } from "../../../project-tabs";

/**
 * Script sheets: the front of the pipeline.
 *
 * Upload a script (or a season of them) and walk it through seven sheets, in
 * order, the way a production office would: pick the beats, lock the faces
 * and the places, plan every shot, read the prompts, clear QA. Then open the
 * result as a board, where generation, staleness and the cut already live.
 * Nothing on this page spends money or sends the script anywhere.
 */

const keyFor = (id: string) => `sheets/${id}`;
const SIZES = ["Extreme wide", "Wide", "Full", "Medium wide", "Medium", "Medium close-up", "Close-up", "Extreme close-up", "Insert", "Two-shot", "Over-the-shoulder"];
const ANGLES = ["Eye level", "Low", "High", "Overhead", "Ground level", "Dutch", "POV"];
const LENSES = ["14mm", "24mm", "35mm", "50mm", "85mm", "135mm", "100mm macro", "Anamorphic"];
const LENGTHS = [2, 3, 4, 5, 6, 8, 10, 12, 15];

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="sh-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function Text({ label, value, onChange, rows = 2, hint }: { label: string; value: string; onChange: (v: string) => void; rows?: number; hint?: string }) {
  return (
    <Field label={label}>
      <textarea rows={rows} maxLength={4000} value={value} placeholder={hint} onChange={(e) => onChange(e.target.value)} />
    </Field>
  );
}

function Pick({ label, value, options, onChange }: { label: string; value: string; options: readonly string[]; onChange: (v: string) => void }) {
  // A value from an import (65mm, "Medium two-shot") stays selectable instead of reading as blank.
  const list = value && !options.includes(value) ? [value, ...options] : options;
  return (
    <Field label={label}>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">—</option>
        {list.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </Field>
  );
}

/** The move picker: every named move, grouped, one click to put it in the shot. */
function CameraPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const current = cameraMove(value);
  return (
    <div className="sh-camera">
      <button type="button" className="sh-camera-btn" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span>Camera move</span>
        <b>{current?.label ?? "Choose a move"}</b>
      </button>
      {current && <p className="sh-camera-desc">{current.prompt}</p>}
      {open && (
        <div className="sh-camera-pop" role="dialog" aria-label="Camera moves">
          {MOVE_GROUPS.map((group) => (
            <section key={group}>
              <h4>{group}</h4>
              <div>
                {cameraMoves
                  .filter((m) => m.group === group)
                  .map((m) => (
                    <button
                      type="button"
                      key={m.id}
                      title={m.prompt}
                      aria-pressed={m.id === value}
                      onClick={() => {
                        onChange(m.id);
                        setOpen(false);
                      }}
                    >
                      {m.label}
                    </button>
                  ))}
              </div>
            </section>
          ))}
          <p className="sh-note">Moves are written into the prompt as direction. The model decides the motion.</p>
          {value && (
            <button type="button" className="plain" onClick={() => { onChange(""); setOpen(false); }}>
              Clear move
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function AddByName({ label, onAdd }: { label: string; onAdd: (name: string) => void }) {
  const [name, setName] = useState("");
  return (
    <form
      className="sh-tools"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        onAdd(name);
        setName("");
      }}
    >
      <input className="sh-search" aria-label={label} placeholder={label} value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
      <button className="pill" disabled={!name.trim()}>Add</button>
    </form>
  );
}

export function SheetsStudio({ id }: { id: string }) {
  const kv = useMemo(() => defaultKv(), []);
  const store = useMemo(() => createProjectStore(kv), [kv]);
  const [project, setProject] = useState<Project | null>(null);
  const [missing, setMissing] = useState(false);
  const [sheets, setSheets] = useState<Sheets | null>(null);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<SheetId>("script");
  const [picked, setPicked] = useState<string[]>([]);
  const [filter, setFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [setup, setSetup] = useState({ title: "", seconds: 60, format: "16:9" });
  const scripts = useRef<HTMLInputElement>(null);
  const saved = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void store.load(id).then((found) => (found ? setProject(found) : setMissing(true)));
    void kv.get<string>(keyFor(id)).then((raw) => {
      if (raw) {
        try {
          setSheets(importSheets(raw));
        } catch {
          // A record this version cannot read is left alone, not overwritten.
        }
      }
      setReady(true);
    });
  }, [kv, store, id]);

  useEffect(() => {
    if (ready && sheets) void kv.set(keyFor(id), exportSheets(sheets));
  }, [kv, ready, sheets, id]);

  /** Every edit goes through here, so a refused edit says why and changes nothing. */
  const act = useCallback((change: (current: Sheets) => Sheets) => {
    setSheets((current) => {
      if (!current) return current;
      try {
        const next = change(current);
        setError(null);
        return next;
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "That change couldn't be made.");
        return current;
      }
    });
  }, []);

  const qa = useMemo(() => (sheets ? qaSheet(sheets) : []), [sheets]);
  const prompts = useMemo(() => (sheets ? promptRows(sheets) : []), [sheets]);

  async function upload(files: File[]) {
    if (!files.length) return;
    try {
      if (files.some((f) => f.size > 3_000_000)) throw new Error("Keep each script under 3 MB.");
      const parsed: Screenplay[] = [];
      for (const file of files) parsed.push(parseScreenplay(await file.text()));
      const first = parsed[0]!;
      const next = buildSheets(parsed, {
        title: setup.title || project?.name || first.series || first.title || "Untitled reel",
        seconds: Number(setup.seconds),
        format: setup.format,
      });
      setSheets(next);
      setTab("script");
      setPicked([]);
      setError(null);
      setNotice(
        `Read ${parsed.length} script${parsed.length > 1 ? "s" : ""}: ${next.script.length} scenes, ${next.characters.length} speaking characters, ${next.locations.length} places. Nothing left this browser.`,
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That script couldn't be read.");
    }
  }

  async function sendToBoard() {
    if (!sheets) return;
    try {
      // Load fresh: the board may have rendered or reordered shots since this page opened.
      const current = (await store.load(id)) ?? project;
      if (!current) throw new Error("This project isn't on this device any more.");
      const result = syncBoard(current, sheets);
      await store.save(result.project);
      setProject(result.project);
      setError(null);
      setNotice(
        [
          `Board updated: ${result.added} added, ${result.updated} updated, ${result.removed} removed.`,
          result.kept ? `${result.kept} shot${result.kept === 1 ? "" : "s"} with footage kept on the board, unlinked.` : "",
        ].filter(Boolean).join(" "),
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The board couldn't be updated.");
    }
  }

  function download() {
    if (!sheets) return;
    const url = URL.createObjectURL(new Blob([exportSheets(sheets)], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${sheets.title.replace(/[^\w.-]+/g, "-") || "sheets"}.sheets.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  const togglePick = (id: string, on: boolean) => setPicked((p) => (on ? [...p, id] : p.filter((x) => x !== id)));

  const fileInputs = (
    <>
      <input ref={scripts} type="file" multiple accept=".md,.txt,.fountain,text/plain,text/markdown" hidden onChange={(e) => { const files = [...(e.target.files ?? [])]; e.target.value = ""; void upload(files); }} />
      <input
        ref={saved}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          try {
            setSheets(importSheets(await file.text()));
            setNotice("Sheets opened.");
          } catch (caught) {
            setError(caught instanceof Error ? caught.message : "That file couldn't be read.");
          }
        }}
      />
    </>
  );

  if (missing) {
    return (
      <div className="app">
        <Nav current="Projects" />
        <div className="canvas"><div className="library"><div className="library-blank"><p>That project isn&rsquo;t here.</p></div></div></div>
      </div>
    );
  }
  if (!ready || !project) return <div className="app"><Nav current="Projects" /></div>;
  const tabs = <ProjectTabs id={id} name={project.name} current="sheets" />;

  if (!sheets) {
    return (
      <div className="app">
        <Nav current="Projects" />
        {tabs}
        <div className="canvas">
          <div className="sh-start">
            <h1>Start <b>{project.name}</b> from the script.</h1>
            <p>
              Upload one script or a whole season. haggs reads the scenes, the speaking characters and the places, then walks you
              through seven sheets: beats, identity locks, looks, shots, prompts and QA. Fix, alter or add on any of them. Nothing
              is generated or paid for here; that happens on the board, shot by shot, at the price shown.
            </p>
            <div className="sh-setup">
              <Field label="Working title">
                <input maxLength={100} value={setup.title} placeholder="Taken from the script if blank" onChange={(e) => setSetup((s) => ({ ...s, title: e.target.value }))} />
              </Field>
              <Field label="Reel length (s)">
                <input type="number" min={5} max={600} value={setup.seconds} onChange={(e) => setSetup((s) => ({ ...s, seconds: Number(e.target.value) }))} />
              </Field>
              <Field label="Format">
                <select value={setup.format} onChange={(e) => setSetup((s) => ({ ...s, format: e.target.value }))}>
                  {["16:9", "9:16", "1:1"].map((f) => (
                    <option key={f}>{f}</option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="sh-start-actions">
              <button className="fire" onClick={() => scripts.current?.click()}>Upload scripts</button>
              <button className="plain" onClick={() => saved.current?.click()}>Open saved sheets</button>
              <Link className="plain" href={`/board/${id}`}>Skip — start on the board</Link>
            </div>
            <p className="sh-note">Plain text, Markdown or Fountain. Scenes start with INT. or EXT. Several files become episodes, ordered by the episode number on each title page.</p>
            {error && <p className="library-error" role="alert">{error}</p>}
            {fileInputs}
          </div>
        </div>
      </div>
    );
  }

  const total = runtime(sheets);
  const errors = qa.filter((q) => q.level === "error").length;
  const count: Record<SheetId, number> = {
    script: sheets.script.length, story: sheets.story.length, characters: sheets.characters.length,
    locations: sheets.locations.length, shots: sheets.shots.length, prompts: prompts.length, qa: qa.length,
  };
  const meta = SHEETS.find((s) => s.id === tab)!;
  const needle = filter.toLowerCase();
  const scenes = sheets.script.filter((s) => !needle || `${s.heading} ${s.action} ${s.characters.join(" ")}`.toLowerCase().includes(needle));

  return (
    <div className="app">
      <Nav current="Projects">
        <span className={`sh-runtime${total === sheets.seconds ? " ok" : ""}`}>
          {total}s <i>of {sheets.seconds}s</i>
        </span>
        <button className="fire" disabled={!sheets.shots.length} onClick={() => void sendToBoard()}>
          Send to board
        </button>
      </Nav>
      {tabs}
      {fileInputs}
      <div className="sh-work">
        <nav className="sh-rail" aria-label="Sheets">
          <input className="sh-reel" aria-label="Reel title" value={sheets.title} maxLength={100} onChange={(e) => act((x) => ({ ...x, title: e.target.value }))} />
          {SHEETS.map((s, i) => (
            <button key={s.id} aria-current={tab === s.id ? "page" : undefined} onClick={() => { setTab(s.id); setPicked([]); }}>
              <span className="sh-step">{i + 1}</span>
              <span>
                <b>{s.label}</b>
                <small className={s.id === "qa" && errors ? "bad" : undefined}>
                  {s.id === "qa" ? (errors ? `${errors} to fix` : qa.length ? `${qa.length} to review` : "All clear") : `${count[s.id]}`}
                </small>
              </span>
            </button>
          ))}
          <div className="sh-rail-foot">
            <button className="plain" onClick={download}>Export sheets</button>
            <button className="plain" onClick={() => scripts.current?.click()}>Upload again</button>
          </div>
        </nav>

        <section className="sh-sheet">
          <header className="sh-head">
            <h1>{meta.label}</h1>
            <p>{meta.hint}</p>
          </header>
          {error && <p className="library-error" role="alert">{error}</p>}
          {notice && <p className="sh-notice" role="status">{notice}</p>}

          {tab === "script" && (
            <>
              <div className="sh-tools">
                <input className="sh-search" placeholder="Find a scene, a name or a line" value={filter} onChange={(e) => setFilter(e.target.value)} />
                <button
                  className="pill on"
                  disabled={!picked.length}
                  onClick={() => {
                    act((x) => addBeat(x, { sceneIds: x.script.filter((s) => picked.includes(s.id)).map((s) => s.id) }));
                    setPicked([]);
                    setNotice("Beat added to Story beats.");
                  }}
                >
                  Make one beat from {picked.length || "selected"} scene{picked.length === 1 ? "" : "s"}
                </button>
              </div>
              {sheets.sources.map((src) => (
                <div key={src.episode}>
                  <h3 className="sh-ep">Episode {src.episode}{src.title && ` · ${src.title}`}</h3>
                  {scenes
                    .filter((s) => s.episode === src.episode)
                    .map((s) => (
                      <article key={s.id} className={`sh-row${picked.includes(s.id) ? " picked" : ""}`}>
                        <input type="checkbox" aria-label={`Select ${s.heading}`} checked={picked.includes(s.id)} onChange={(e) => togglePick(s.id, e.target.checked)} />
                        <div>
                          <p className="sh-heading">{s.flash && <em>flash </em>}{s.heading}</p>
                          <p className="sh-meta">{[s.act, `lines ${s.from}–${s.to}`, s.characters.join(", ")].filter(Boolean).join("  ·  ")}</p>
                          <p className="sh-action">{s.action.slice(0, 280)}{s.action.length > 280 && "…"}</p>
                        </div>
                        <button className="pill" onClick={() => { act((x) => addBeat(x, { sceneIds: [s.id] })); setNotice(`Beat added: ${s.heading}`); }}>
                          Add as beat
                        </button>
                      </article>
                    ))}
                </div>
              ))}
            </>
          )}

          {tab === "story" &&
            (sheets.story.length ? (
              sheets.story.map((b, i) => (
                <article key={b.id} className="sh-card">
                  <div className="sh-card-top">
                    <span className="sh-step">{i + 1}</span>
                    <input className="sh-title" aria-label={`Beat ${i + 1} title`} value={b.title} maxLength={100} onChange={(e) => act((x) => fixCell(x, "story", b.id, "title", e.target.value))} />
                    <button className="sh-icon" disabled={!i} aria-label="Move beat earlier" onClick={() => act((x) => moveRow(x, "story", b.id, i - 1))}>↑</button>
                    <button className="sh-icon" disabled={i === sheets.story.length - 1} aria-label="Move beat later" onClick={() => act((x) => moveRow(x, "story", b.id, i + 1))}>↓</button>
                  </div>
                  <p className="sh-meta">{b.source} · {sheets.shots.filter((s) => s.beatId === b.id).length} shots</p>
                  <div className="sh-2">
                    <Text label="What the audience should feel" value={b.feeling} onChange={(v) => act((x) => fixCell(x, "story", b.id, "feeling", v))} />
                    <Text label="Withhold — QA flags any shot that shows this" value={b.withhold} hint="e.g. her face" onChange={(v) => act((x) => fixCell(x, "story", b.id, "withhold", v))} />
                  </div>
                  <div className="sh-row-actions">
                    <button className="pill on" onClick={() => { act((x) => addShot(x, b.id)); setNotice("Shot added to the shot list."); }}>Add a shot</button>
                    <button className="plain danger" onClick={() => act((x) => removeRow(x, "story", b.id))}>Remove beat and its shots</button>
                  </div>
                </article>
              ))
            ) : (
              <p className="sh-empty">No beats yet. On the Script sheet, pick the scenes your reel is built from.</p>
            ))}

          {tab === "characters" && (
            <>
              <AddByName label="Add a character" onAdd={(name) => act((x) => addRow(x, "characters", { name }))} />
              {sheets.characters.map((c) => (
                <article key={c.id} className="sh-card">
                  <div className="sh-card-top">
                    <b className="sh-title">{c.name}</b>
                    <span className="sh-meta">{c.lines} lines · {c.scenes.length} scenes{c.age ? ` · first seen at ${c.age}` : ""}</span>
                    <button className="sh-icon" aria-label={`Remove ${c.name}`} onClick={() => act((x) => removeRow(x, "characters", c.id))}>×</button>
                  </div>
                  <div className="sh-3">
                    <Text label="Face and build" value={c.look} onChange={(v) => act((x) => fixCell(x, "characters", c.id, "look", v))} />
                    <Text label="Wardrobe" value={c.wardrobe} onChange={(v) => act((x) => fixCell(x, "characters", c.id, "wardrobe", v))} />
                    <Text label="Voice" value={c.voice} onChange={(v) => act((x) => fixCell(x, "characters", c.id, "voice", v))} />
                  </div>
                  <Text label="Identity lock — written into every shot they are in" rows={3} value={c.lock} hint="age, face, hair, skin, build, wardrobe" onChange={(v) => act((x) => fixCell(x, "characters", c.id, "lock", v))} />
                  <Text label="Never show" value={c.never} onChange={(v) => act((x) => fixCell(x, "characters", c.id, "never", v))} />
                </article>
              ))}
            </>
          )}

          {tab === "locations" && (
            <>
              <AddByName label="Add a place" onAdd={(name) => act((x) => addRow(x, "locations", { name }))} />
              {sheets.locations.map((l) => (
                <article key={l.id} className="sh-card">
                  <div className="sh-card-top">
                    <b className="sh-title">{l.setting && `${l.setting}. `}{l.name}</b>
                    <span className="sh-meta">{l.scenes.length} scenes{l.areas.length ? ` · ${l.areas.slice(0, 4).join(", ")}` : ""}</span>
                    <button className="sh-icon" aria-label={`Remove ${l.name}`} onClick={() => act((x) => removeRow(x, "locations", l.id))}>×</button>
                  </div>
                  <div className="sh-2">
                    <Text label="Look" value={l.look} onChange={(v) => act((x) => fixCell(x, "locations", l.id, "look", v))} />
                    <Text label="Light" value={l.light} onChange={(v) => act((x) => fixCell(x, "locations", l.id, "light", v))} />
                  </div>
                  <Text label="Look lock — written into every shot here" rows={3} value={l.lock} onChange={(v) => act((x) => fixCell(x, "locations", l.id, "lock", v))} />
                </article>
              ))}
            </>
          )}

          {tab === "shots" &&
            (sheets.shots.length ? (
              <>
                <div className="sh-tools sh-alter">
                  <span>{picked.length ? `${picked.length} selected — change them together` : "Select shots to change them together"}</span>
                  <select aria-label="Camera move for selected shots" disabled={!picked.length} value="" onChange={(e) => act((x) => alterRows(x, "shots", picked, { move: e.target.value }))}>
                    <option value="">Camera move…</option>
                    {MOVE_GROUPS.map((g) => (
                      <optgroup key={g} label={g}>
                        {cameraMoves.filter((m) => m.group === g).map((m) => (
                          <option key={m.id} value={m.id}>{m.label}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  <select aria-label="Size for selected shots" disabled={!picked.length} value="" onChange={(e) => act((x) => alterRows(x, "shots", picked, { size: e.target.value }))}>
                    <option value="">Size…</option>
                    {SIZES.map((o) => <option key={o}>{o}</option>)}
                  </select>
                  <select aria-label="Length for selected shots" disabled={!picked.length} value="" onChange={(e) => act((x) => alterRows(x, "shots", picked, { seconds: Number(e.target.value) }))}>
                    <option value="">Length…</option>
                    {LENGTHS.map((o) => <option key={o} value={o}>{o}s</option>)}
                  </select>
                </div>
                {sheets.shots.map((s, i) => (
                  <ShotCard
                    key={s.id}
                    sheets={sheets}
                    shot={s}
                    index={i}
                    picked={picked.includes(s.id)}
                    onPick={(on) => togglePick(s.id, on)}
                    set={(key, value) => act((x) => fixCell(x, "shots", s.id, key, value))}
                    remove={() => act((x) => removeRow(x, "shots", s.id))}
                  />
                ))}
              </>
            ) : (
              <p className="sh-empty">No shots yet. On Story beats, add a shot to each beat.</p>
            ))}

          {tab === "prompts" &&
            (prompts.length ? (
              prompts.map((p) => (
                <article key={p.id} className="sh-card">
                  <div className="sh-card-top">
                    <span className="sh-step">{p.number}</span>
                    <b className="sh-title">{p.beat}</b>
                    <span className="sh-meta">{p.text.length} / 4000</span>
                    <button className="pill" onClick={() => void navigator.clipboard?.writeText(p.text).then(() => setNotice(`Prompt ${p.number} copied.`), () => setError("Copy was blocked by the browser."))}>
                      Copy
                    </button>
                  </div>
                  <pre className="sh-prompt">{p.text}</pre>
                </article>
              ))
            ) : (
              <p className="sh-empty">Prompts appear as soon as there are shots. On the board each shot also picks up continuity from the one before it.</p>
            ))}

          {tab === "qa" && (
            <>
              {qa.length ? (
                <ul className="sh-qa">
                  {qa.map((q, i) => (
                    <li key={i} className={q.level}>
                      <span>{q.level === "error" ? "Fix" : "Review"}</span>
                      <p>{q.message}</p>
                      <button className="pill" onClick={() => setTab(q.sheet)}>{SHEETS.find((s) => s.id === q.sheet)!.label}</button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="sh-empty">All clear. Send it to the board to see prices and generate.</p>
              )}
              <article className="sh-card">
                <div className="sh-3">
                  <Field label="Target seconds">
                    <input type="number" min={5} max={600} value={sheets.seconds} onChange={(e) => act((x) => ({ ...x, seconds: Number(e.target.value) }))} />
                  </Field>
                  <Field label="Format">
                    <select value={sheets.format} onChange={(e) => act((x) => ({ ...x, format: e.target.value }))}>
                      {["16:9", "9:16", "1:1"].map((f) => <option key={f}>{f}</option>)}
                    </select>
                  </Field>
                </div>
                <Text label="Style for every shot" value={sheets.style} hint="e.g. 35mm anamorphic, cool blue night, soft film grain" onChange={(v) => act((x) => ({ ...x, style: v }))} />
                <Text label="Withheld across the whole reel — one per line" rows={3} value={sheets.rules.join("\n")} hint="Spoilers and anything the reel must never show" onChange={(v) => act((x) => ({ ...x, rules: v.split("\n").slice(0, 40) }))} />
              </article>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function ShotCard({ sheets, shot, index, picked, onPick, set, remove }: {
  sheets: Sheets;
  shot: ShotRow;
  index: number;
  picked: boolean;
  onPick: (on: boolean) => void;
  set: (key: keyof ShotRow, value: unknown) => void;
  remove: () => void;
}) {
  const beat = sheets.story.find((b) => b.id === shot.beatId);
  const scene = sheets.script.find((s) => s.id === shot.sceneId);
  const cast = sheets.characters.filter((c) => shot.characters.includes(c.id) || scene?.characters.includes(c.id));
  return (
    <article className={`sh-card${picked ? " picked" : ""}`}>
      <div className="sh-card-top">
        <input type="checkbox" aria-label={`Select shot ${index + 1}`} checked={picked} onChange={(e) => onPick(e.target.checked)} />
        <span className="sh-step">{index + 1}</span>
        <b className="sh-title">{beat?.title}</b>
        <label className="sh-secs">
          <span>Seconds</span>
          <input type="number" min={0.5} max={15} step={0.5} value={shot.seconds} onChange={(e) => set("seconds", Number(e.target.value))} />
        </label>
        <button className="sh-icon" aria-label={`Remove shot ${index + 1}`} onClick={remove}>×</button>
      </div>
      <p className="sh-meta">{scene?.heading} · {beat?.source}</p>
      <div className="sh-shot">
        <div>
          <CameraPicker value={shot.move} onChange={(v) => set("move", v)} />
          <div className="sh-3">
            <Pick label="Size" value={shot.size} options={SIZES} onChange={(v) => set("size", v)} />
            <Pick label="Angle" value={shot.angle} options={ANGLES} onChange={(v) => set("angle", v)} />
            <Pick label="Lens" value={shot.lens} options={LENSES} onChange={(v) => set("lens", v)} />
          </div>
          <Text label="Blocking" value={shot.blocking} hint="Who is where, who moves" onChange={(v) => set("blocking", v)} />
          <Text label="Notes — not sent to the model" value={shot.note} onChange={(v) => set("note", v)} />
        </div>
        <div>
          <Text label="Action — what we see" rows={4} value={shot.action} onChange={(v) => set("action", v)} />
          <div className="sh-2">
            <Text label="Dialogue" value={shot.dialogue} onChange={(v) => set("dialogue", v)} />
            <Text label="Sound" value={shot.sound} onChange={(v) => set("sound", v)} />
          </div>
          <div className="sh-chips" role="group" aria-label="Cast in this shot">
            {cast.map((c) => (
              <button
                key={c.id}
                type="button"
                aria-pressed={shot.characters.includes(c.id)}
                title={c.lock ? c.lock : "No identity lock yet"}
                onClick={() => set("characters", shot.characters.includes(c.id) ? shot.characters.filter((x) => x !== c.id) : [...shot.characters, c.id])}
              >
                {c.name}
                {!c.lock && <i> · no lock</i>}
              </button>
            ))}
          </div>
          <Pick label="Place" value={shot.location} options={sheets.locations.map((l) => l.id)} onChange={(v) => set("location", v)} />
        </div>
      </div>
    </article>
  );
}
