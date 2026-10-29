"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { exportSheets, importSheets, type Sheets } from "../sheets/sheets";
import { normalize } from "../story/boards";
import { defaultKv } from "../story/kv";
import type { Project, ProjectSummary } from "../story/model";
import type { PictureRun as Run } from "../story/runs";
import { saveRun, type SaveTarget } from "../story/save-run";
import { createProjectStore } from "../story/store";
import { saveToBank, suggestName } from "../story/bank-save";
import { KIND_NAME, type BankItem } from "../story/bank";
import { pickUrl, safeReturn, type PickKind } from "../story/handoff";

/**
 * Save to project: put something made in Create or Video to work — on a
 * shot, as a new shot, as how a character or a place looks, or kept in
 * Media. It remembers the last project, since most saves go to the same one.
 */

type Use = SaveTarget["as"];
const USES: { id: Use; label: string; hint: string }[] = [
  { id: "take", label: "A take on a shot", hint: "It goes on the shot. Earlier takes stay to flip back to." },
  { id: "new-shot", label: "A new shot", hint: "Starts a shot at the end of the board from it." },
  { id: "character", label: "How a character looks", hint: "Sent with every shot they're in, to keep them the same person." },
  { id: "place", label: "How a place looks", hint: "Sent with every shot set there." },
  { id: "media", label: "Just keep it", hint: "Kept in the project's Media to use later." },
];
const LAST = "haggs.save-to.project";

const remembered = () => {
  try {
    return localStorage.getItem(LAST) ?? "";
  } catch {
    return "";
  }
};

/** Keep a picture in your bank as a character, a place or an accessory. Back from somewhere that asked for one, it offers the way back with it chosen. */
function BankSave({ run, kv, onClose, startKind }: { run: Run; kv: ReturnType<typeof defaultKv>; onClose: () => void; startKind: PickKind }) {
  const [kind, setKind] = useState<PickKind>(startKind);
  const [name, setName] = useState(() => suggestName(run.prompt));
  const [made, setMade] = useState<BankItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const from = useMemo(() => {
    const q = new URLSearchParams(window.location.search);
    const back = safeReturn(q.get("return"));
    return back ? { back, label: q.get("label")?.slice(0, 40) || "where you were" } : null;
  }, []);
  async function save() {
    setBusy(true);
    setError(null);
    try {
      setMade(await saveToBank(kv, kind, name, { image: run.url, words: run.prompt }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That couldn't be saved.");
    } finally {
      setBusy(false);
    }
  }
  if (made) {
    return (
      <>
        <p className="save-to-done" role="status">Saved {made.name} to your bank as {KIND_NAME[made.kind].one === "accessory" ? "an" : "a"} {KIND_NAME[made.kind].one}. It's one tap away wherever you choose who is in a shot.</p>
        <div className="sheet-row">
          {from && <a className="fire" href={pickUrl(from.back, made.kind, made.id)}>Use {made.name} in {from.label}</a>}
          <button className={from ? "plain" : "fire"} onClick={onClose}>Keep making</button>
        </div>
      </>
    );
  }
  return (
    <>
      <fieldset className="save-to-uses">
        <legend>Keep it as</legend>
        {(["character", "place", "accessory"] as PickKind[]).map((k) => (
          <label key={k} className={kind === k ? "on" : ""}>
            <input type="radio" name="bankkind" checked={kind === k} onChange={() => setKind(k)} />
            <b>{k === "character" ? "A character" : k === "place" ? "A place" : "An accessory"}</b>
            <small>{k === "character" ? "The picture is how they look; the prompt describes them." : k === "place" ? "The picture is the place; use it in any shot set there." : "A scarf, glasses, a jacket: put it on anyone."}</small>
          </label>
        ))}
      </fieldset>
      <label className="save-to-field"><span>Name</span><input value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="Juno" /></label>
      {error && <p className="library-error" role="alert">{error}</p>}
      <div className="sheet-row">
        <button className="fire" disabled={busy || !name.trim()} onClick={() => void save()}>{busy ? "Saving…" : "Save to my bank"}</button>
        <button className="plain" onClick={onClose}>Cancel</button>
      </div>
    </>
  );
}

export function SaveToProject({ run, onClose }: { run: Run; onClose: () => void }) {
  const kv = useMemo(() => defaultKv(), []);
  // Sent here from a page that wants a character, place or accessory made (?make=place), the bank is the starting point.
  const make = typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("make");
  const startKind: PickKind = make === "place" || make === "accessory" || make === "character" ? make : "character";
  const [dest, setDest] = useState<"project" | "bank">(make ? "bank" : "project");
  const store = useMemo(() => createProjectStore(kv), [kv]);
  const [list, setList] = useState<ProjectSummary[] | null>(null);
  const [projectId, setProjectId] = useState("");
  const [project, setProject] = useState<Project | null>(null);
  const [sheets, setSheets] = useState<Sheets | null>(null);
  const [use, setUse] = useState<Use>("take");
  const [boardId, setBoardId] = useState("");
  const [shotId, setShotId] = useState("");
  const [rowId, setRowId] = useState("");
  const [face, setFace] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void store.list().then((all) => {
      setList(all);
      const last = remembered();
      setProjectId(all.some((p) => p.id === last) ? last : (all[0]?.id ?? ""));
    });
  }, [store]);

  useEffect(() => {
    if (!projectId) return;
    let live = true;
    void Promise.all([store.load(projectId), kv.get<string>(`sheets/${projectId}`)]).then(([found, raw]) => {
      if (!live || !found) return;
      const p = normalize(found);
      setProject(p);
      let read: Sheets | null = null;
      try {
        read = raw ? importSheets(raw) : null;
      } catch {
        read = null;
      }
      setSheets(read);
      const board = p.boards!.at(-1)!;
      setBoardId(board.id);
      setShotId(board.shots.find((s) => !s.render)?.id ?? board.shots[0]?.id ?? "");
    });
    return () => {
      live = false;
    };
  }, [projectId, store, kv]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const board = project?.boards?.find((b) => b.id === boardId);
  const rows = use === "character" ? (sheets?.characters ?? []) : use === "place" ? (sheets?.locations ?? []) : [];
  useEffect(() => setRowId(rows[0]?.id ?? ""), [use, sheets]); // eslint-disable-line react-hooks/exhaustive-deps

  const target: SaveTarget | null =
    use === "take" ? (boardId && shotId ? { as: "take", boardId, shotId } : null)
    : use === "new-shot" ? (boardId ? { as: "new-shot", boardId } : null)
    : use === "media" ? { as: "media" }
    : rowId ? { as: use, id: rowId, face } : null;

  async function save() {
    if (!target || !projectId) return;
    setBusy(true);
    setError(null);
    try {
      // Load fresh, so saving here never overwrites work saved in another tab.
      const latest = await store.load(projectId);
      if (!latest) throw new Error("That project isn't on this device any more.");
      const raw = await kv.get<string>(`sheets/${projectId}`);
      const out = saveRun(latest, raw ? importSheets(raw) : null, run, target);
      await store.save(out.project);
      if (out.sheets && (target.as === "character" || target.as === "place")) await kv.set(`sheets/${projectId}`, exportSheets(out.sheets));
      try {
        localStorage.setItem(LAST, projectId);
      } catch {
        // Remembering the project is a convenience; saving already happened.
      }
      setDone(out.message);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That couldn't be saved.");
    } finally {
      setBusy(false);
    }
  }

  const where = use === "take" || use === "new-shot" ? `/board/${projectId}?b=${encodeURIComponent(boardId)}` : use === "media" ? `/board/${projectId}/media` : `/board/${projectId}/sheets`;

  // On the body, so a page's own stacking (the gallery's canvas) can't draw over the dialog.
  return createPortal(
    <div className="veil" onClick={onClose}>
      <div className="sheet wide save-to" role="dialog" aria-modal="true" aria-labelledby="save-to-title" onClick={(e) => e.stopPropagation()}>
        <div className="save-to-head">
          {run.kind === "video" ? <video src={run.url} muted loop autoPlay playsInline /> : <img src={run.url} alt="" />}
          <div>
            <h3 id="save-to-title">Save to project</h3>
            <p>{run.prompt.slice(0, 120)}</p>
          </div>
        </div>

        {!done && (
          <div className="lab-chips save-to-dest" role="tablist" aria-label="Where to save it">
            <button role="tab" aria-selected={dest === "project"} className={dest === "project" ? "on" : ""} onClick={() => setDest("project")}>Into a project</button>
            <button role="tab" aria-selected={dest === "bank"} className={dest === "bank" ? "on" : ""} onClick={() => setDest("bank")}>Into my bank</button>
          </div>
        )}

        {dest === "bank" && !done ? (
          <BankSave run={run} kv={kv} onClose={onClose} startKind={startKind} />
        ) : done ? (
          <>
            <p className="save-to-done" role="status">{done}</p>
            <div className="sheet-row">
              <a className="fire" href={where}>Open it there</a>
              <button className="plain" onClick={onClose}>Keep making</button>
            </div>
          </>
        ) : list && !list.length ? (
          <>
            <p>There are no projects yet. Start one from Projects, then save to it.</p>
            <div className="sheet-row">
              <a className="fire" href="/library">Go to Projects</a>
              <button className="plain" onClick={onClose}>Close</button>
            </div>
          </>
        ) : (
          <>
            <label className="save-to-field">
              <span>Project</span>
              <select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                {(list ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>

            <fieldset className="save-to-uses">
              <legend>Use it as</legend>
              {USES.map((u) => (
                <label key={u.id} className={use === u.id ? "on" : ""}>
                  <input type="radio" name="use" value={u.id} checked={use === u.id} onChange={() => setUse(u.id)} />
                  <b>{u.label}</b>
                  <small>{u.hint}</small>
                </label>
              ))}
            </fieldset>

            {(use === "take" || use === "new-shot") && project && (
              <label className="save-to-field">
                <span>Board</span>
                <select value={boardId} onChange={(e) => { setBoardId(e.target.value); setShotId(project.boards!.find((b) => b.id === e.target.value)?.shots[0]?.id ?? ""); }}>
                  {project.boards!.map((b) => <option key={b.id} value={b.id}>{b.name} · {b.shots.length} shots</option>)}
                </select>
              </label>
            )}
            {use === "take" && board && (
              board.shots.length ? (
                <label className="save-to-field">
                  <span>Shot</span>
                  <select value={shotId} onChange={(e) => setShotId(e.target.value)}>
                    {board.shots.map((s, i) => <option key={s.id} value={s.id}>{i + 1}. {(s.beat || s.heading || "Untitled").slice(0, 60)}{s.render ? "" : " (empty)"}</option>)}
                  </select>
                </label>
              ) : <p className="save-to-note">This board has no shots yet. Save it as a new shot instead.</p>
            )}
            {(use === "character" || use === "place") && (
              rows.length ? (
                <>
                  <label className="save-to-field">
                    <span>{use === "character" ? "Character" : "Place"}</span>
                    <select value={rowId} onChange={(e) => setRowId(e.target.value)}>
                      {rows.map((r) => <option key={r.id} value={r.id}>{r.name}{r.refs?.length ? ` · ${r.refs.length} picture${r.refs.length === 1 ? "" : "s"}` : ""}</option>)}
                    </select>
                  </label>
                  <label className="save-to-check">
                    <input type="checkbox" checked={face} onChange={(e) => setFace(e.target.checked)} />
                    {use === "character" ? "Make it their face — the picture shown on the board and sent first" : "Make it the main picture of this place"}
                  </label>
                </>
              ) : <p className="save-to-note">This project's sheets have no {use === "character" ? "characters" : "places"} yet. Add a script on the Script tab first, or just keep it in Media.</p>
            )}

            {error && <p className="library-error" role="alert">{error}</p>}
            <div className="sheet-row">
              <button className="fire" disabled={!target || busy} onClick={() => void save()}>{busy ? "Saving…" : `Save to ${project?.name ?? "project"}`}</button>
              <button className="plain" onClick={onClose}>Cancel</button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
