"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { cameraMove, cameraMoves, MOVE_GROUPS } from "../../../../sheets/camera";
import { parseScreenplay, type Screenplay } from "../../../../sheets/screenplay";
import {
  SHEETS, addBeat, addRow, addShot, alterRows, buildSheets, exportSheets, fixCell, importSheets,
  moveRow, normalizeSheets, promptRows, putSheetsView, qaSheet, removeRow, runtime, sheetsView, syncBoard, type SheetId, type Sheets, type ShotRow,
} from "../../../../sheets/sheets";
import { defaultKv } from "../../../../story/kv";
import { boardOf, commit, view } from "../../../../story/boards";
import type { Project } from "../../../../story/model";
import type { Fill } from "../../../../writer/fill";
import { createProjectStore } from "../../../../story/store";
import { fillLooks, keepPicture, run } from "../../../actions";
import { applyFill, fillRequest } from "../../../../writer/fill";
import { applyDraft, validateDraft } from "../../../../writer/draft";
import { applyBoardProposal, validateBoardProposal } from "../../../../story/proposed-board";
import { applyTakes, validateTakes } from "../../../../story/proposed-takes";
import { formatById } from "../../../../sheets/formats";
import { StartScreen } from "./start";
import { Nav, openKeys } from "../../../nav";
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
/** Pictures of people and places come from FLUX 3 on Comfy unless the sheet says otherwise. */
const REF_MODEL = "bfl/flux-3-image";
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

/** Shrinks an uploaded picture so a sheet full of references stays small enough to keep. */
async function shrinkFile(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1024 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.86);
}

/**
 * A row of reference pictures for a character or a place: pick from the
 * project's media, upload one, or generate one from what the sheet says.
 * The first picture is the one sent with every shot.
 */
function RefStrip({ refs, pool, describe, onChange }: { refs: string[]; pool: string[]; describe: string; onChange: (refs: string[]) => void }) {
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const upload = useRef<HTMLInputElement>(null);
  const add = (url: string) => onChange([...refs.filter((r) => r !== url), url].slice(0, 8));

  async function generate() {
    if (!describe.trim()) {
      setProblem("Write a look or an identity lock first; the picture is made from it.");
      return;
    }
    setBusy(true);
    setProblem(null);
    const result = await run(REF_MODEL, `Character and location reference sheet, neutral light, clear face and full costume, no text. ${describe}`, {});
    if (!result.ok) {
      setBusy(false);
      if (result.needsKey) openKeys();
      setProblem(result.reason);
      return;
    }
    const kept = await keepPicture(result.shots[0]!.url);
    setBusy(false);
    if (!kept.ok) {
      setProblem(kept.reason);
      return;
    }
    add(kept.dataUri);
  }

  return (
    <div className="refs">
      <span className="refs-label">References — the first one goes with every shot</span>
      <div className="refs-row">
        {refs.map((url, i) => (
          <figure key={url.slice(-40) + i} className={`ref${i === 0 ? " lead" : ""}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" />
            <span>
              {i > 0 && <button aria-label="Make this the main reference" onClick={() => onChange([url, ...refs.filter((r) => r !== url)])}>★</button>}
              <button aria-label="Remove reference" onClick={() => onChange(refs.filter((r) => r !== url))}>×</button>
            </span>
          </figure>
        ))}
        <div className="refs-add">
          <button className="pill" disabled={!pool.length} onClick={() => setPicking((p) => !p)}>Pick from media</button>
          <button className="pill" onClick={() => upload.current?.click()}>Upload</button>
          <button className="pill" disabled={busy} onClick={() => void generate()}>{busy ? "Making…" : "Generate"}</button>
        </div>
        <input ref={upload} type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) add(await shrinkFile(f)); }} />
      </div>
      {problem && <p className="library-error" role="alert">{problem}</p>}
      {picking && (
        <div className="refs-pool">
          {pool.map((url) => (
            <button key={url.slice(-60)} onClick={() => { add(url); setPicking(false); }} aria-label="Use this picture">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Asks the writer to draft looks and locks for the cast and places; only empty fields are filled. */
function FillButton({ sheets, onFilled, onProblem }: { sheets: Sheets; onFilled: (fill: Fill, message: string) => void; onProblem: (reason: string) => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="pill on"
      disabled={busy}
      title="Claude reads how each person and place is introduced and drafts looks and identity locks. Only empty fields are filled."
      onClick={async () => {
        setBusy(true);
        const result = await fillLooks(fillRequest(sheets));
        setBusy(false);
        if (!result.ok) {
          if ("needsKey" in result && result.needsKey) openKeys();
          onProblem(result.reason);
          return;
        }
        const { changed } = applyFill(sheets, result.draft);
        onFilled(result.draft, `Filled ${changed} empty field${changed === 1 ? "" : "s"} from the script. Claude used ${result.usage.input.toLocaleString()} + ${result.usage.output.toLocaleString()} tokens on your account. Everything you had written was left alone.`);
      }}
    >
      {busy ? "Reading the script…" : "Fill looks with AI"}
    </button>
  );
}

type Proposal = { id: string; kind: "draft" | "fill" | "edits" | "board" | "takes"; summary: string; payload: unknown; boardId?: string; formatId?: string; at: number };

/** Polls the local bridge for what Claude has sent this project over MCP. Development only. */
function useInbox(projectId: string) {
  const [items, setItems] = useState<Proposal[]>([]);
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    let live = true;
    const check = async () => {
      try {
        const res = await fetch(`/api/bridge/inbox?project=${encodeURIComponent(projectId)}`);
        const body = (await res.json()) as { items?: Proposal[] };
        if (live) setItems(body.items ?? []);
      } catch {
        // No bridge, no inbox; the page works the same.
      }
    };
    void check();
    const timer = setInterval(check, 4000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [projectId]);
  const drop = async (id: string) => {
    setItems((list) => list.filter((i) => i.id !== id));
    await fetch(`/api/bridge/inbox?project=${encodeURIComponent(projectId)}&id=${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => undefined);
  };
  return { items, drop };
}

const KIND: Record<Proposal["kind"], string> = { draft: "A draft", fill: "Looks and locks", edits: "Sheet edits", board: "A new board", takes: "New takes" };

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

/** Carries every board's beats and shots, and the locks already written, onto freshly uploaded sheets. */
function keepWork(next: Sheets, before: Sheets): Sheets {
  const kept = <T extends { id: string }>(rows: T[], old: T[], fields: (keyof T)[]) =>
    rows.map((row) => {
      const was = old.find((o) => o.id === row.id);
      return was ? { ...row, ...Object.fromEntries(fields.map((f) => [f, was[f]])) } : row;
    });
  return {
    ...next,
    style: before.style,
    rules: before.rules,
    ...(before.reels ? { reels: before.reels } : {}),
    story: before.story,
    shots: before.shots,
    characters: kept(next.characters, before.characters, ["look", "wardrobe", "voice", "lock", "never"]),
    locations: kept(next.locations, before.locations, ["look", "light", "lock"]),
  };
}

export function SheetsStudio({ id, boardId }: { id: string; boardId?: string | undefined }) {
  const kv = useMemo(() => defaultKv(), []);
  const store = useMemo(() => createProjectStore(kv), [kv]);
  const [project, setProject] = useState<Project | null>(null);
  const [missing, setMissing] = useState(false);
  /** The project's sheets, every board; `sheets` below is this board's view of them. */
  const [all, setAll] = useState<Sheets | null>(null);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<SheetId>("script");
  const [picked, setPicked] = useState<string[]>([]);
  const [filter, setFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [setup, setSetup] = useState({ title: "", seconds: 60, format: "16:9" });
  const scripts = useRef<HTMLInputElement>(null);
  const saved = useRef<HTMLInputElement>(null);
  const claude = useInbox(id);

  useEffect(() => {
    void store.load(id).then((found) => (found ? setProject(found) : setMissing(true)));
    void kv.get<string>(keyFor(id)).then((raw) => {
      if (raw) {
        try {
          setAll(importSheets(raw));
        } catch {
          // A record this version cannot read is left alone, not overwritten.
        }
      }
      setReady(true);
    });
  }, [kv, store, id]);

  useEffect(() => {
    if (ready && all) void kv.set(keyFor(id), exportSheets(all));
  }, [kv, ready, all, id]);

  const board = project ? boardOf(project, boardId) : null;
  const bid = board?.id ?? "main";
  const sheets = useMemo(
    () => (all ? sheetsView(normalizeSheets(all, project?.boards?.[0]?.id ?? "main"), bid, { title: board?.name ?? all.title }) : null),
    [all, bid, board?.name, project?.boards],
  );

  /** Every edit goes through here, so a refused edit says why and changes nothing. */
  const act = useCallback((change: (current: Sheets) => Sheets) => {
    setAll((current) => {
      if (!current) return current;
      try {
        const base = normalizeSheets(current, project?.boards?.[0]?.id ?? "main");
        const next = putSheetsView(base, bid, change(sheetsView(base, bid, { title: board?.name ?? base.title })));
        setError(null);
        return next;
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "That change couldn't be made.");
        return current;
      }
    });
  }, [bid, board?.name, project?.boards]);

  /** Applies what Claude sent, to the board it was meant for, then clears it from the inbox. */
  function applyProposal(item: Proposal) {
    if (item.kind === "takes") {
      void (async () => {
        try {
          const current = (await store.load(id)) ?? project;
          if (!current) throw new Error("This project isn't on this device any more.");
          const sent = validateTakes(item.payload);
          const { project: saved, added } = applyTakes(current, sent);
          await store.save(saved);
          setProject(saved);
          void claude.drop(item.id);
          setError(null);
          const where = saved.boards?.find((b) => b.id === sent.board)?.name ?? "the board";
          setNotice(added ? `Put ${added} new take${added === 1 ? "" : "s"} on ${where}. Earlier takes are still there to flip back to.` : `Those takes were already on ${where}.`);
        } catch (caught) {
          setError(caught instanceof Error ? caught.message : "Those takes couldn't be added.");
        }
      })();
      return;
    }
    if (item.kind === "board") {
      void (async () => {
        try {
          // Load fresh, so a board added from Claude never overwrites work saved since this page opened.
          const current = (await store.load(id)) ?? project;
          if (!current) throw new Error("This project isn't on this device any more.");
          const { project: saved, board: added } = applyBoardProposal(current, validateBoardProposal(item.payload));
          await store.save(saved);
          setProject(saved);
          void claude.drop(item.id);
          setError(null);
          setNotice(`Added the board “${added.name}” with ${added.shots.length} shots. Pick it from the boards above.`);
        } catch (caught) {
          setError(caught instanceof Error ? caught.message : "That board couldn't be added.");
        }
      })();
      return;
    }
    const target = item.boardId ?? bid;
    const first = project?.boards?.[0]?.id ?? "main";
    const name = project?.boards?.find((b) => b.id === target)?.name;
    try {
      if (item.kind === "draft") {
        const format = formatById(item.formatId ?? "");
        if (!format) throw new Error("That draft names a format this version doesn't have.");
        const { sheets: made, problems } = applyDraft(validateDraft(item.payload), format);
        if (all && !window.confirm("Use Claude's draft? It replaces the project's script and this board's beats and shots. Other boards keep theirs, but their scenes may no longer match.")) return;
        setAll((current) => {
          const base = current ? normalizeSheets({ ...made, reels: current.reels ?? {}, style: current.style, rules: current.rules }, first) : { ...made, story: [], shots: [], reels: {} };
          return putSheetsView(base, target, made);
        });
        setNotice(`Applied Claude's draft: ${made.script.length} scenes, ${made.story.length} beats, ${made.shots.length} shots.${problems.length ? ` Fixed on the way in: ${problems.join(" ")}` : ""}`);
      } else if (item.kind === "fill") {
        if (!all) throw new Error("There are no sheets to fill yet.");
        setAll((current) => {
          if (!current) return current;
          const base = normalizeSheets(current, first);
          return putSheetsView(base, bid, applyFill(sheetsView(base, bid), item.payload as Fill).sheets);
        });
        setNotice("Applied Claude's looks and locks to empty fields. Anything you had written was left alone.");
      } else {
        if (!all) throw new Error("There are no sheets to edit yet.");
        const edits = item.payload as { sheet: string; id: string; key: string; value: unknown }[];
        const refused: string[] = [];
        setAll((current) => {
          if (!current) return current;
          const base = normalizeSheets(current, first);
          let view = sheetsView(base, target, { title: name ?? base.title });
          for (const e of edits) {
            try {
              view = fixCell(view, e.sheet, e.id, e.key, e.value);
            } catch (caught) {
              refused.push(caught instanceof Error ? caught.message : String(caught));
            }
          }
          return putSheetsView(base, target, view);
        });
        setNotice(`Applied ${edits.length} edit${edits.length === 1 ? "" : "s"} from Claude${name ? ` to ${name}` : ""}.`);
      }
      void claude.drop(item.id);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That couldn't be applied.");
    }
  }

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
      // A new upload replaces the scripts but keeps every board's beats and shots, and any locks already written.
      setAll((current) => (current ? keepWork(next, current) : next));
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
      const result = syncBoard(view(current, bid), sheets);
      const saved = commit(current, bid, result.project);
      await store.save(saved);
      setProject(saved);
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
    const url = URL.createObjectURL(new Blob([exportSheets(all ?? sheets)], { type: "application/json" }));
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
            setAll(importSheets(await file.text()));
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
  const tabs = <ProjectTabs project={project} boardId={boardId} current="sheets" />;

  if (!sheets) {
    return (
      <div className="app">
        <Nav current="Projects" />
        {tabs}
        <div className="canvas">
          <div className="sh-start">{claude.items.length > 0 && (
            <div className="inbox" role="region" aria-label="From Claude">
              {claude.items.map((item) => (
                <div key={item.id} className="inbox-item">
                  <span className="inbox-from">From Claude</span>
                  <p><b>{KIND[item.kind]}</b> — {item.summary}{item.boardId && project.boards?.find((b) => b.id === item.boardId) ? ` · for ${project.boards.find((b) => b.id === item.boardId)!.name}` : ""}</p>
                  <button className="pill on" onClick={() => applyProposal(item)}>Apply</button>
                  <button className="plain" onClick={() => void claude.drop(item.id)}>Dismiss</button>
                </div>
              ))}
            </div>
          )}</div>
          <StartScreen
            projectName={project.name}
            boardHref={`/board/${id}?b=${encodeURIComponent(bid)}`}
            onUpload={() => scripts.current?.click()}
            onOpenSaved={() => saved.current?.click()}
            onSheets={(made, message) => {
              // A start belongs to the board it was made on, not always the first one.
              setAll(putSheetsView({ ...made, story: [], shots: [], reels: {} }, bid, made));
              setTab(made.story.length ? "story" : "script");
              setNotice(message);
              setError(null);
            }}
          />
          <div className="sh-start">
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
  // Every still the project has — imported media and image takes on any board — to pick references from.
  const pool = [
    ...new Set([
      ...(project.media ?? []).filter((m) => m.kind === "image" && m.status !== "rejected").map((m) => m.url),
      ...(project.boards ?? []).flatMap((b) => b.shots.flatMap((s) => (s.takes ?? []).filter((t) => t.kind === "image").map((t) => t.url))),
    ]),
  ];
  const needle = filter.toLowerCase();
  const scenes = sheets.script.filter((s) => !needle || `${s.heading} ${s.action} ${s.characters.join(" ")}`.toLowerCase().includes(needle));

  return (
    <div className="app">
      <Nav current="Projects" />
      {tabs}
      {fileInputs}
      <div className="sh-work">
        <nav className="sh-rail" aria-label="Sheets">
          <input className="sh-reel" aria-label="Reel title" value={sheets.title} maxLength={100} onChange={(e) => act((x) => ({ ...x, title: e.target.value }))} />
          <div className="sh-send">
            <span className={`sh-runtime${total === sheets.seconds ? " ok" : ""}`}>
              {total}s <i>of {sheets.seconds}s</i>
            </span>
            <button className="fire" disabled={!sheets.shots.length} onClick={() => void sendToBoard()}>
              Send to board
            </button>
          </div>
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
          {claude.items.length > 0 && (
            <div className="inbox" role="region" aria-label="From Claude">
              {claude.items.map((item) => (
                <div key={item.id} className="inbox-item">
                  <span className="inbox-from">From Claude</span>
                  <p><b>{KIND[item.kind]}</b> — {item.summary}{item.boardId && project.boards?.find((b) => b.id === item.boardId) ? ` · for ${project.boards.find((b) => b.id === item.boardId)!.name}` : ""}</p>
                  <button className="pill on" onClick={() => applyProposal(item)}>Apply</button>
                  <button className="plain" onClick={() => void claude.drop(item.id)}>Dismiss</button>
                </div>
              ))}
            </div>
          )}
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
              <div className="sh-tools">
                <AddByName label="Add a character" onAdd={(name) => act((x) => addRow(x, "characters", { name }))} />
                <FillButton sheets={sheets} onFilled={(fill, msg) => { act((x) => applyFill(x, fill).sheets); setNotice(msg); }} onProblem={setError} />
              </div>
              {/* Leads first: the people with the most lines are the ones every shot depends on. */}
              {[...sheets.characters].sort((a, b) => b.lines - a.lines).map((c) => (
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
                  <RefStrip refs={c.refs ?? []} pool={pool} describe={[c.lock, c.look, c.wardrobe].filter(Boolean).join(". ")} onChange={(refs) => act((x) => fixCell(x, "characters", c.id, "refs", refs))} />
                </article>
              ))}
            </>
          )}

          {tab === "locations" && (
            <>
              <div className="sh-tools">
                <AddByName label="Add a place" onAdd={(name) => act((x) => addRow(x, "locations", { name }))} />
                <FillButton sheets={sheets} onFilled={(fill, msg) => { act((x) => applyFill(x, fill).sheets); setNotice(msg); }} onProblem={setError} />
              </div>
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
                  <RefStrip refs={l.refs ?? []} pool={pool} describe={[l.lock, l.look, l.light].filter(Boolean).join(". ")} onChange={(refs) => act((x) => fixCell(x, "locations", l.id, "refs", refs))} />
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
