"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { cameraMove, cameraMoves, MOVE_GROUPS } from "../../../../sheets/camera";
import { CropPreview, Drawing, MovePreview, PickerShell, StillPreview, Wedge, type PickerTab } from "../../../look-picker";
import { parseScreenplay, type Screenplay } from "../../../../sheets/screenplay";
import {
  SHEETS, addBeat, addShot, alterRows, buildSheets, exportSheets, fixCell, importSheets,
  moveRow, normalizeSheets, promptRows, putSheetsView, qaSheet, removeRow, runtime, sheetsView, syncBoard, type SheetId, type Sheets, type ShotRow,
} from "../../../../sheets/sheets";
import { defaultKv } from "../../../../story/kv";
import { boardOf, commit, view } from "../../../../story/boards";
import type { Project } from "../../../../story/model";
import type { Fill } from "../../../../writer/fill";
import { createProjectStore } from "../../../../story/store";
import { breakDown, fillLooks } from "../../../actions";
import { applyFill, fillRequest } from "../../../../writer/fill";
import { applyDraft, validateDraft } from "../../../../writer/draft";
import { applyBoardProposal, validateBoardProposal } from "../../../../story/proposed-board";
import { applyTakes, applyVoices, validateTakes, validateVoices } from "../../../../story/proposed-takes";
import { formatById, type Format } from "../../../../sheets/formats";
import { readScriptFile, SCRIPT_ACCEPT } from "../../../../sheets/import";
import { fixAll, fixesFor } from "../../../../sheets/fixes";
import { applyBreakdown, breakdownRequest, byHandPrompt, readReply, validateBreakdown } from "../../../../writer/breakdown";
import { StartScreen, type UploadOptions } from "./start";
import { Nav, openKeys } from "../../../nav";
import { PROJECT_SAVED } from "../../../agent";
import { ProjectTabs } from "../../../project-tabs";
import { BankPicker, loadBank } from "../../../bank-picker";
import { ProjectAssets } from "../../../project-assets";
import { useSheetAsset, useSheetAssets } from "../../../../sheets/assets";
import { readPick } from "../../../../story/handoff";
import type { BankItem } from "../../../../story/bank";

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

/** The sheets as five steps, the order a production office works in. Cast and places share a step, as do shots and their prompts. */
const STEPS: { label: string; tabs: SheetId[] }[] = [
  { label: "Script", tabs: ["script"] },
  { label: "Story beats", tabs: ["story"] },
  { label: "Cast & places", tabs: ["characters", "locations"] },
  { label: "Shots", tabs: ["shots", "prompts"] },
  { label: "Check", tabs: ["qa"] },
];
type Progress = { sheets: Sheets; unlocked: number; errors: number };
/** What the foot of each sheet says before pointing at the next one. */
const NEXT: Record<Exclude<SheetId, "qa">, (p: Progress) => string> = {
  script: ({ sheets }) => (sheets.story.length ? `${sheets.script.length} scenes, ${sheets.story.length} beats taken from them.` : `${sheets.script.length} scenes read. Break it down with Claude above, or tick scenes and make beats from them yourself.`),
  story: ({ sheets }) => `${sheets.story.length} beats, ${sheets.shots.length} shots. Next, lock how the people and places look so every shot matches.`,
  characters: ({ sheets }) => { const n = sheets.characters.filter((c) => c.lines && !c.lock).length; return n ? `${n} speaking character${n === 1 ? " has" : "s have"} no identity lock yet. Fill looks with AI, or write one.` : "Every speaking character is locked."; },
  locations: ({ sheets }) => { const n = sheets.locations.filter((l) => l.scenes.length && !l.lock).length; return n ? `${n} place${n === 1 ? " has" : "s have"} no look lock yet.` : "Every place is locked."; },
  shots: ({ sheets }) => `${sheets.shots.length} shots, ${runtime(sheets)}s of ${sheets.seconds}s. The prompts are built from these.`,
  prompts: ({ errors }) => (errors ? `Check has ${errors} problem${errors === 1 ? "" : "s"} to look at before anything is spent.` : "Check reads every shot for problems before anything is spent."),
};
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

/** Shot sizes as crops of the sample portrait, or a drawing where a crop cannot show it. */
const SIZE_LOOK: Record<string, ReactNode> = {
  "Extreme wide": <StillPreview src="/looks/framing-extreme-wide.webp" />,
  Wide: <CropPreview at="50% 50%" zoom={1} />,
  Full: <CropPreview at="66% 58%" zoom={1.35} />,
  "Medium wide": <CropPreview at="65% 50%" zoom={1.7} />,
  Medium: <CropPreview at="64% 42%" zoom={2.1} />,
  "Medium close-up": <CropPreview at="62% 32%" zoom={2.8} />,
  "Close-up": <CropPreview at="61% 25%" zoom={3.6} />,
  "Extreme close-up": <CropPreview at="59% 23%" zoom={8} />,
  Insert: <CropPreview at="58% 74%" zoom={4.5} />,
  "Two-shot": <StillPreview src="/looks/size-two-shot.webp" />,
  "Over-the-shoulder": <StillPreview src="/looks/framing-over-shoulder.webp" />,
};
/** Camera angles as the same woman in the same square, shot from each angle (made with ChatGPT). */
const ANGLE_LOOK: Record<string, ReactNode> = Object.fromEntries(
  ["Eye level", "Low", "High", "Overhead", "Ground level", "Dutch", "POV"].map((a) => [a, <StillPreview key={a} src={`/looks/angle-${a.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.webp`} />]),
);
const LENS_LOOK = (lens: string): ReactNode => {
  if (lens === "Anamorphic") return <Drawing><ellipse cx="32" cy="32" rx="24" ry="13" /><ellipse cx="32" cy="32" rx="11" ry="6" /><path d="M2 32 H62" className="vk-flare" /></Drawing>;
  const mm = parseInt(lens, 10);
  return <span className="vk-draw wide"><Wedge focal={mm || 50} /></span>;
};

/** The shot's camera as four cards (move, size, angle, lens), each opening a picker of visual samples. */
function ShotLook({ shot, set }: { shot: ShotRow; set: (key: keyof ShotRow, value: unknown) => void }) {
  const [open, setOpen] = useState<string | null>(null);
  const move = cameraMove(shot.move);
  const options = (list: readonly string[], value: string) => (value && !list.includes(value) ? [value, ...list] : list);
  const tabs: PickerTab[] = [
    { id: "move", label: "Move", says: "What the camera does during the shot", value: shot.move, onPick: (v) => set("move", v),
      groups: MOVE_GROUPS.map((g) => ({ name: g, options: cameraMoves.filter((m) => m.group === g).map((m) => ({ id: m.id, label: m.label, visual: <MovePreview id={m.id} /> })) })) },
    { id: "size", label: "Size", says: "How much of the person the frame holds", value: shot.size, onPick: (v) => set("size", v),
      groups: [{ options: options(SIZES, shot.size).map((o) => ({ id: o, label: o, visual: SIZE_LOOK[o] ?? <CropPreview at="50% 50%" zoom={1} /> })) }] },
    { id: "angle", label: "Angle", says: "Where the camera looks from", value: shot.angle, onPick: (v) => set("angle", v),
      groups: [{ options: options(ANGLES, shot.angle).map((o) => ({ id: o, label: o, visual: ANGLE_LOOK[o] ?? <CropPreview at="50% 50%" zoom={1} /> })) }] },
    { id: "lens", label: "Lens", says: "How wide the lens sees, on a full-frame camera", value: shot.lens, onPick: (v) => set("lens", v),
      groups: [{ options: options(LENSES, shot.lens).map((o) => ({ id: o, label: o, visual: LENS_LOOK(o) })) }] },
  ];
  const shown: Record<string, string> = { move: move?.label ?? "", size: shot.size, angle: shot.angle, lens: shot.lens };
  const thumb: Record<string, ReactNode> = { move: shot.move ? <MovePreview id={shot.move} /> : <MovePreview id="static" />, size: SIZE_LOOK[shot.size] ?? <CropPreview at="50% 50%" zoom={1} />, angle: ANGLE_LOOK[shot.angle] ?? ANGLE_LOOK["Eye level"], lens: LENS_LOOK(shot.lens || "35mm") };
  return (
    <div className="sh-look">
      <div className="vk-bar">
        {tabs.map((t) => (
          <button key={t.id} type="button" className={`vk-card${shown[t.id] ? " set" : ""}`} onClick={() => setOpen(t.id)}>
            <span className="vk-thumb">{thumb[t.id]}</span>
            <span><small>{t.label}</small><b>{shown[t.id] || "Any"}</b></span>
          </button>
        ))}
      </div>
      {move && <p className="sh-camera-desc">{move.prompt}</p>}
      {open && <PickerShell title="Camera" tabs={tabs} start={open} onClose={() => setOpen(null)} note="Moves, sizes, angles and lenses are written into the prompt as direction; the model decides the motion. The samples show the idea on a still." />}
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
/** A sheet row and your bank, both ways: use one of yours here, or keep this one for everywhere else. */
function BankLink({ kind, onUse, beforeBuild }: { kind: "character" | "place"; onUse: (item: BankItem) => void; beforeBuild:()=>Promise<void> }) {
  const [open, setOpen] = useState(false);
  return <div className="sh-bank"><button className="plain" onClick={() => setOpen(true)}>Use one from your bank</button>
    {open && <BankPicker kinds={[kind]} label="the sheets" beforeBuild={beforeBuild} allowPhotoBuild={false} onClose={() => setOpen(false)} onPick={onUse} />}</div>;
}

function RefStrip({ refs, pool, describe, onChange }: { refs: string[]; pool: string[]; describe: string; onChange: (refs: string[]) => void }) {
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const upload = useRef<HTMLInputElement>(null);
  const add = (url: string) => onChange([...refs.filter((r) => r !== url), url].slice(0, 8));


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

        </div>
        <input ref={upload} type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) { try { add(await shrinkFile(f)); setProblem(null); } catch { setProblem("That image could not be opened. Try another image."); } } }} />
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

/**
 * The breakdown without a key: the same request haggs would send, copied for the person to paste into Claude or
 * ChatGPT, and the JSON reply pasted back. With the haggs MCP connected, Claude Code can send it straight to the inbox.
 */
function ByHand({ prompt, onCopied, onReply }: { prompt: string; onCopied: () => void; onReply: (raw: string) => boolean }) {
  const [reply, setReply] = useState("");
  return (
    <div className="sh-byhand">
      <ol>
        <li>
          <b>Copy the request.</b> It holds the instructions and every scene.
          <button className="pill on" onClick={() => void navigator.clipboard?.writeText(prompt).then(onCopied, () => undefined)}>Copy the request</button>
        </li>
        <li>
          <b>Paste it into</b> <a href="https://claude.ai/new" target="_blank" rel="noreferrer">Claude</a> or <a href="https://chatgpt.com/" target="_blank" rel="noreferrer">ChatGPT</a>. It answers with JSON.
        </li>
        <li>
          <b>Paste the reply here.</b>
          <textarea rows={4} value={reply} placeholder='{"logline": "…", "characters": […], …}' onChange={(e) => setReply(e.target.value)} />
          <button className="fire" disabled={reply.trim().length < 20} onClick={() => { if (onReply(reply)) setReply(""); }}>Use this breakdown</button>
        </li>
      </ol>
      {process.env.NODE_ENV !== "production" && (
        <p className="sh-meta">Using Claude Code or Claude Desktop with the haggs MCP? Ask it to “break down this board’s script with haggs_propose_breakdown”. It arrives here, From Claude, for you to Apply.</p>
      )}
    </div>
  );
}

type Proposal = { id: string; kind: "draft" | "breakdown" | "fill" | "edits" | "board" | "takes" | "voices"; summary: string; payload: unknown; boardId?: string; formatId?: string; at: number };

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

const KIND: Record<Proposal["kind"], string> = { draft: "A draft", breakdown: "A breakdown of the script", fill: "Looks and locks", edits: "Sheet edits", board: "A new board", takes: "New takes", voices: "Voice-over lines" };

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
    characters: kept(next.characters, before.characters, ["look", "wardrobe", "voice", "lock", "never", "refs", "bankId"]),
    locations: kept(next.locations, before.locations, ["look", "light", "lock", "refs", "bankId"]),
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
  const [setup] = useState({ title: "", seconds: 60, format: "16:9" });
  const [breaking, setBreaking] = useState(false);
  const [byHand, setByHand] = useState(false);
  const [breakFormat, setBreakFormat] = useState<Format | undefined>(undefined);
  const [reading, setReading] = useState<string[]>([]);
  const [sendAnyway, setSendAnyway] = useState(false);
  const scripts = useRef<HTMLInputElement>(null);
  const saved = useRef<HTMLInputElement>(null);
  const claude = useInbox(id);
  const sheetWrites = useRef(Promise.resolve());
  const returned = useRef(false);
  const [uiReady, setUiReady] = useState(false);
  const uiKey = `sheets-ui:${id}:${boardId ?? 'main'}`;
  useEffect(() => { void kv.get<{tab:SheetId;picked:string[];filter:string}>(uiKey).then(v => {
    if(v) { if(SHEETS.some(s=>s.id===v.tab)) setTab(v.tab); setPicked(v.picked ?? []); setFilter(v.filter ?? ''); }
    setUiReady(true);
  }); }, [kv,uiKey]);
  useEffect(() => { if(uiReady) void kv.set(uiKey,{tab,picked,filter}); },[kv,uiKey,uiReady,tab,picked,filter]);
  async function beforeBuild() {
    try { await sheetWrites.current; if(all) await kv.set(keyFor(id),exportSheets(all)); await kv.set(uiKey,{tab,picked,filter}); }
    catch { setError('Your draft could not be saved. Stay here and try again.'); throw new Error('Draft save failed'); }
  }

  // The producer changed this project from the chat: load it again, so this page's next save keeps the change.
  useEffect(() => {
    const reload = (e: Event) => {
      if ((e as CustomEvent<{ id: string }>).detail?.id === id) void store.load(id).then((found) => found && setProject(found));
    };
    window.addEventListener(PROJECT_SAVED, reload);
    return () => window.removeEventListener(PROJECT_SAVED, reload);
  }, [store, id]);

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
    if (ready && all) sheetWrites.current = sheetWrites.current.catch(()=>{}).then(()=>kv.set(keyFor(id), exportSheets(all))).catch(()=>{setError("Your latest changes could not be saved. Keep this page open and retry.");});
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

  useEffect(() => {
    if(!ready || !all || !project || returned.current) return;
    const pick=readPick(window.location.search);
    if(!pick || pick.kind==='accessory') return;
    returned.current=true;
    void loadBank().then(items=>{
      const item=items.find(i=>i.kind===pick.kind&&i.id===pick.id);
      if(!item?.image) { setError('That asset is missing or unfinished. Your project is unchanged.'); return; }
      act(x=>useSheetAsset(x,item)); setTab(item.kind==='character'?'characters':'locations'); setNotice(`${item.name} added to this project.`);
    }).catch(()=>setError('The saved asset could not be loaded. Your project is unchanged.')).finally(()=>{
      const u=new URL(window.location.href);u.searchParams.delete('pick');window.history.replaceState(null,'',u.pathname+u.search);
    });
  },[ready,all,project,act]);

  /** Applies what Claude sent, to the board it was meant for, then clears it from the inbox. */
  function applyProposal(item: Proposal) {
    if (item.kind === "voices") {
      void (async () => {
        try {
          const current = (await store.load(id)) ?? project;
          if (!current) throw new Error("This project isn't on this device any more.");
          const sent = validateVoices(item.payload);
          const { project: saved, added } = applyVoices(current, sent);
          await store.save(saved);
          setProject(saved);
          void claude.drop(item.id);
          setError(null);
          setNotice(added ? `Put ${added} voice-over line${added === 1 ? "" : "s"} on their shots. Hear them in the Cut.` : "Those lines were already on their shots.");
        } catch (caught) {
          setError(caught instanceof Error ? caught.message : "Those lines couldn't be added.");
        }
      })();
      return;
    }
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
      } else if (item.kind === "breakdown") {
        if (!all) throw new Error("There is no script to break down yet.");
        const sent = validateBreakdown(item.payload);
        if (sheets?.story.length && !window.confirm("Use Claude's breakdown? It replaces this board's beats and shots. Locks and looks you wrote are kept.")) return;
        act((x) => applyBreakdown(x, sent).sheets);
        setTab("story");
        setNotice(`Applied Claude's breakdown: ${sent.beats.length} beats and ${sent.shots.length} shots. Your script wasn't changed.`);
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

  async function upload(files: File[], from?: UploadOptions) {
    if (!files.length) return;
    try {
      setNotice(files.some((f) => /\.pdf$/i.test(f.name)) ? "Reading the PDF…" : null);
      const texts: string[] = [];
      for (const file of files) texts.push(await readScriptFile(file));
      let parsed: Screenplay[] = texts.map((text) => parseScreenplay(text));
      // Several files that don't say which episode they are become episodes in the order they were picked.
      if (new Set(parsed.map((p) => p.episode)).size < parsed.length) parsed = texts.map((text, i) => parseScreenplay(text, { episode: i + 1 }));
      if (!parsed.some((p) => p.scenes.length)) throw new Error("No scenes were found. Each scene should start with a heading like INT. KITCHEN — DAY.");
      const first = parsed[0]!;
      let next = buildSheets(parsed, {
        title: setup.title || project?.name || first.series || first.title || "Untitled reel",
        seconds: from ? from.format.seconds : Number(setup.seconds),
        format: from ? from.format.aspect : setup.format,
      });
      if (from?.assets.length) next = useSheetAssets(next, from.assets);
      // A new upload replaces the scripts but keeps every board's beats and shots, and any locks already written.
      const merged = all ? keepWork(next, all) : next;
      setAll(merged);
      setTab("script");
      setPicked([]);
      setError(null);
      setNotice(
        `Read ${parsed.length} script${parsed.length > 1 ? "s" : ""}: ${next.script.length} scenes, ${next.characters.length} speaking characters, ${next.locations.length} places. Nothing left this browser.`,
      );
      if (from) setBreakFormat(from.format);
      if (from?.breakdown) {
        const base = normalizeSheets(merged, project?.boards?.[0]?.id ?? "main");
        void breakItDown(sheetsView(base, bid, { title: board?.name ?? base.title }), from.format);
      }
    } catch (caught) {
      setNotice(null);
      setError(caught instanceof Error ? caught.message : "That script couldn't be read.");
    }
  }

  /** Claude reads the script and fills beats, shots, cast and places. This board's beats and shots are replaced; locks people wrote are kept. */
  async function breakItDown(current: Sheets, format?: Format) {
    if (current.story.length && !window.confirm("Break the script down again? Claude's beats and shots replace this board's. Locks and looks you wrote are kept.")) return;
    setBreaking(true);
    setError(null);
    setNotice(`Claude is reading ${current.script.length} scenes and breaking them down. This can take a minute or two.`);
    const result = await breakDown(breakdownRequest(current, format));
    setBreaking(false);
    if (!result.ok) {
      if ("needsKey" in result && result.needsKey) setByHand(true);
      setNotice(`The script is on the sheets: ${current.script.length} scenes. Break it down once Claude can be reached, or tick scenes and make beats from them yourself.`);
      setError("needsKey" in result && result.needsKey ? "There's no Claude key here, so haggs can't call Claude for you. Add one in Keys, or do it yourself in Claude or ChatGPT below: copy the request, paste the reply." : result.reason);
      return;
    }
    const { problems } = applyBreakdown(current, result.draft);
    act((x) => applyBreakdown(x, result.draft).sheets);
    setTab("story");
    setNotice(
      [
        `Broken down: ${result.draft.beats.length} beats and ${result.draft.shots.length} shots, with looks and locks for the cast and places. Claude used ${result.usage.input.toLocaleString()} + ${result.usage.output.toLocaleString()} tokens on your account. Your script wasn't changed.`,
        problems.length ? `Fixed on the way in: ${problems.join(" ")}` : "",
      ].filter(Boolean).join(" "),
    );
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
      <input ref={scripts} type="file" multiple accept={SCRIPT_ACCEPT} hidden onChange={(e) => { const files = [...(e.target.files ?? [])]; e.target.value = ""; void upload(files); }} />
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
          {claude.items.length > 0 && <div className="sh-start">{(
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
          )}</div>}
          <StartScreen
            projectName={project.name}
            boardHref={`/board/${id}?b=${encodeURIComponent(bid)}`}
            onFiles={(files, options) => void upload(files, options)}
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
  const go = (t: SheetId) => { setTab(t); setPicked([]); };
  const unlocked = sheets.characters.filter((c) => c.lines && !c.lock).length + sheets.locations.filter((l) => l.scenes.length && !l.lock).length;
  /** Which guided steps are done: read, beaten out, locked, shot, checked. */
  const done = [sheets.script.length > 0, sheets.story.length > 0, sheets.characters.length + sheets.locations.length > 0 && !unlocked, sheets.shots.length > 0, sheets.shots.length > 0 && !errors];
  const stepOf = STEPS.findIndex((s) => s.tabs.includes(tab));
  const order = STEPS.flatMap((s) => s.tabs);
  const after = order[order.indexOf(tab) + 1];
  const fixable = qa.reduce((n, q) => n + (fixesFor(sheets, q).length && q.code !== "dialogue" ? 1 : 0), 0);
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
            {errors && !sendAnyway ? (
              <button className="plain" disabled={!sheets.shots.length} onClick={() => go("qa")} title="Check found problems that would waste a render. Fix them, or send anyway from Check.">
                Check {errors} problem{errors === 1 ? "" : "s"} first
              </button>
            ) : (
              <button className="fire" disabled={!sheets.shots.length} onClick={() => void sendToBoard()}>
                Send to board
              </button>
            )}
          </div>
          {STEPS.map((step, n) => (
            <div key={step.label} className={`sh-stepgroup${step.tabs.includes(tab) ? " on" : ""}`}>
              {step.tabs.map((t, j) => {
                const s = SHEETS.find((x) => x.id === t)!;
                return (
                  <button key={t} className={j ? "sub" : undefined} aria-current={tab === t ? "page" : undefined} onClick={() => go(t)}>
                    {j ? <span className="sh-step sub" aria-hidden /> : <span className={`sh-step${done[n] ? " done" : ""}`}>{done[n] ? "✓" : n + 1}</span>}
                    <span>
                      <b>{j ? s.label : step.label}</b>
                      <small className={t === "qa" && errors ? "bad" : undefined}>
                        {t === "qa" ? (errors ? `${errors} to fix` : qa.length ? `${qa.length} to review` : "All clear") : j || step.tabs.length === 1 ? `${count[t]}` : `${s.label} · ${count[t]}`}
                      </small>
                    </span>
                  </button>
                );
              })}
            </div>
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
                <button className="pill" onClick={() => setReading(reading.length === sheets.script.length ? [] : sheets.script.map((x) => x.id))}>{reading.length === sheets.script.length ? "Fold the scenes" : "Read every scene"}</button>
                <button className="pill on" disabled={breaking} onClick={() => void breakItDown(sheets, breakFormat)} title="Claude maps the scenes onto beats and fills the cast, places and a first shot list. Your script isn't changed.">
                  {breaking ? "Breaking it down…" : sheets.story.length ? "Break it down again" : "Break it down for me"}
                </button>
                <button className="pill" aria-expanded={byHand} onClick={() => setByHand((v) => !v)}>No key? Use Claude or ChatGPT</button>
              </div>
              {byHand && (
                <ByHand
                  prompt={byHandPrompt(breakdownRequest(sheets, breakFormat))}
                  onCopied={() => setNotice("Copied. Paste it into Claude or ChatGPT, then paste the reply back here.")}
                  onReply={(raw) => {
                    try {
                      const reply = validateBreakdown(readReply(raw));
                      if (sheets.story.length && !window.confirm("Use this breakdown? It replaces this board's beats and shots. Locks and looks you wrote are kept.")) return false;
                      const { problems } = applyBreakdown(sheets, reply);
                      act((x) => applyBreakdown(x, reply).sheets);
                      setByHand(false);
                      setTab("story");
                      setError(null);
                      setNotice(`Broken down: ${reply.beats.length} beats and ${reply.shots.length} shots from the reply you pasted. Your script wasn't changed.${problems.length ? ` Fixed on the way in: ${problems.join(" ")}` : ""}`);
                      return true;
                    } catch (caught) {
                      setError(caught instanceof Error ? caught.message : "That reply couldn't be read.");
                      return false;
                    }
                  }}
                />
              )}
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
                          {reading.includes(s.id) ? (
                            <div className="sh-read">
                              {s.action && <p className="sh-action">{s.action}</p>}
                              {s.dialogue.map((l, k) => (
                                <p key={k} className="sh-line"><b>{l.character}{l.extension && ` (${l.extension})`}</b>{l.parenthetical && <i> ({l.parenthetical})</i>} {l.words}</p>
                              ))}
                            </div>
                          ) : (
                            <p className="sh-action">{s.action.slice(0, 280)}{s.action.length > 280 && "…"}{s.dialogue.length ? <i className="sh-lines"> · {s.dialogue.length} line{s.dialogue.length === 1 ? "" : "s"}</i> : null}</p>
                          )}
                        </div>
                        <div className="sh-row-side">
                          <button className="pill" onClick={() => { act((x) => addBeat(x, { sceneIds: [s.id] })); setNotice(`Beat added: ${s.heading}`); }}>
                            Add as beat
                          </button>
                          <button className="pill" onClick={() => setReading((r) => (r.includes(s.id) ? r.filter((x) => x !== s.id) : [...r, s.id]))}>{reading.includes(s.id) ? "Fold" : "Read"}</button>
                        </div>
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
                <ProjectAssets kinds={["character"]} beforeBuild={beforeBuild} onPick={item=>act(x=>useSheetAsset(x,item))} />
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
                  <BankLink kind="character" beforeBuild={beforeBuild} onUse={item=>act(x=>useSheetAsset(x,item,c.id))} />
                </article>
              ))}
            </>
          )}

          {tab === "locations" && (
            <>
              <div className="sh-tools">
                <ProjectAssets kinds={["place"]} beforeBuild={beforeBuild} onPick={item=>act(x=>useSheetAsset(x,item))} />
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
                  <BankLink kind="place" beforeBuild={beforeBuild} onUse={item=>act(x=>useSheetAsset(x,item,l.id))} />
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
              {qa.length > 0 && (
                <div className="sh-tools">
                  <span className="sh-meta">{errors ? `${errors} to fix, ` : ""}{qa.length - errors} to review{fixable ? ` · ${fixable} haggs can fix by itself, with nothing spent` : ""}</span>
                  {fixable > 0 && (
                    <button className="pill on" onClick={() => {
                      const { sheets: fixed, fixed: n } = fixAll(sheets, qa);
                      act(() => fixed);
                      setNotice(`Fixed ${n} thing${n === 1 ? "" : "s"}: lengths, trims and locks written from what was on the sheets. Nothing was spent.`);
                    }}>Fix what you can</button>
                  )}
                </div>
              )}
              {qa.length ? (
                <ul className="sh-qa">
                  {qa.map((q, i) => (
                    <li key={i} className={q.level}>
                      <span>{q.level === "error" ? "Fix" : "Review"}</span>
                      <p>{q.message}</p>
                      <div className="sh-qa-do">
                        {fixesFor(sheets, q).map((f) => (
                          <button key={f.label} className="pill on" onClick={() => { act(f.apply); setNotice(`${f.label}: done.`); }}>{f.label}</button>
                        ))}
                        <button className="pill" onClick={() => go(q.sheet)}>{SHEETS.find((s) => s.id === q.sheet)!.label}</button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="sh-empty">All clear. Send it to the board to see prices and generate.</p>
              )}
              {sheets.shots.length > 0 && (
                <div className="sh-next">
                  {errors ? (
                    <>
                      <p>{errors} problem{errors === 1 ? "" : "s"} left. Each one would waste a render, so they are worth fixing first.</p>
                      <button className="plain" onClick={() => { setSendAnyway(true); void sendToBoard(); }}>Send to board anyway</button>
                    </>
                  ) : (
                    <>
                      <p>Ready. On the board you see the price of every shot before anything is generated.</p>
                      <button className="fire" onClick={() => void sendToBoard()}>Send to board</button>
                    </>
                  )}
                </div>
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
          {tab !== "qa" && after && (
            <div className="sh-next">
              <p>{NEXT[tab]({ sheets, unlocked, errors })}</p>
              <button className={tab === "script" && !sheets.story.length ? "plain" : "fire"} onClick={() => go(after)}>
                Next: {after === STEPS[stepOf + 1]?.tabs[0] ? STEPS[stepOf + 1]!.label : SHEETS.find((x) => x.id === after)!.label} →
              </button>
            </div>
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
          <ShotLook shot={shot} set={set} />
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
