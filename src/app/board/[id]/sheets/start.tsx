"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { FORMATS, formatById, layoutFormat, type Format } from "../../../../sheets/formats";
import { SCRIPT_ACCEPT } from "../../../../sheets/import";
import type { Sheets } from "../../../../sheets/sheets";
import { applyDraft } from "../../../../writer/draft";
import { writeDraft } from "../../../actions";
import { ManualDraft } from "./manual-draft";

import {defaultKv} from "../../../../story/kv";
import {readPick} from "../../../../story/handoff";
import {loadBank} from "../../../bank-picker";
import {ProjectAssets} from "../../../project-assets";
import type {BankItem} from "../../../../story/bank";
import {useSheetAssets} from "../../../../sheets/assets";

/**
 * How a board starts, in two choices: the kind of show, then the way in. Write it with Claude from an idea, upload a
 * script (PDF, Final Draft, Fountain, text) and let Claude break it down, or lay the format's beats out yourself. All
 * three end on the same sheets; starting from pictures on the board stays one link away.
 */

const GROUPS = ["Half-hour", "Hour", "Vertical", "Short"] as const;
const clock = (s: number) => (s < 120 ? `${s}s` : `${Math.round(s / 60)} min`);
/** Each format's cover picture. */
export const showCover = (id: string) => `/shows/${id}.webp`;

type Path = "write" | "upload" | "beats";
const PATHS: { id: Path; title: string; says: string; picture: string }[] = [
  { id: "write", title: "Write it with Claude", says: "From your idea to a full script and every sheet filled.", picture: "/start/write.webp" },
  { id: "upload", title: "I have a script", says: "PDF, Final Draft or Fountain. Claude breaks it down for you.", picture: "/start/upload.webp" },
  { id: "beats", title: "Lay out the beats", says: "The format's beats on the sheets, for you to write.", picture: "/start/beats.webp" },
];

export type UploadOptions = { format: Format; breakdown: boolean; assets: BankItem[] };

function Timeline({ format }: { format: Format }) {
  return (
    <div className="st-timeline" aria-label={`${format.label} beats`}>
      {format.beats.map((b) => (
        <span key={b.title} style={{ flexGrow: b.until - b.at }} title={`${b.title}: ${b.job}`}>
          <b>{b.title}</b>
          <i>{clock(b.at)}</i>
        </span>
      ))}
    </div>
  );
}

/** A box to drop script files on, or click to choose them. */
function DropScripts({ onFiles }: { onFiles: (files: File[]) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <div
      className={`st-drop${over ? " over" : ""}`}
      role="button"
      tabIndex={0}
      onClick={() => input.current?.click()}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.current?.click(); } }}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); const files = [...e.dataTransfer.files]; if (files.length) onFiles(files); }}
    >
      <b>Drop your script here, or click to choose it</b>
      <span>PDF · Final Draft (.fdx) · Fountain · plain text · Markdown. Several files become episodes. It is read in this browser.</span>
      <input ref={input} type="file" multiple accept={SCRIPT_ACCEPT} hidden onChange={(e) => { const files = [...(e.target.files ?? [])]; e.target.value = ""; if (files.length) onFiles(files); }} />
    </div>
  );
}

export function StartScreen({
  projectName,
  boardHref,
  onSheets,
  onFiles,
  onOpenSaved,
}: {
  projectName: string;
  boardHref: string;
  onSheets: (sheets: Sheets, notice: string) => void;
  onFiles: (files: File[], options: UploadOptions) => void;
  onOpenSaved: () => void;
}) {
  const [formatId, setFormatId] = useState("comedy-30");
  const [path, setPath] = useState<Path>("write");
  const [idea, setIdea] = useState("");
  const [notes, setNotes] = useState("");
  const [title, setTitle] = useState("");
  const [breakdown, setBreakdown] = useState(true);
  const [busy, setBusy] = useState(false);
  const [manual, setManual] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [assets,setAssets]=useState<BankItem[]>([]);
  const [ready,setReady]=useState(false);
  const writes=useRef(Promise.resolve());
  const draftKey=`project-start:${boardHref}`;
  type Saved={formatId:string;idea:string;notes:string;title:string;assets:BankItem[];path?:Path;breakdown?:boolean};
  useEffect(()=>{void defaultKv().get<Saved>(draftKey).then(async(d)=>{
    if(d){setFormatId(formatById(d.formatId)?d.formatId:"comedy-30");setIdea(d.idea);setNotes(d.notes);setTitle(d.title);setAssets(d.assets??[]);if(d.path&&PATHS.some(p=>p.id===d.path))setPath(d.path);if(typeof d.breakdown==="boolean")setBreakdown(d.breakdown);}
    const pick=readPick(window.location.search);
    if(pick&&(pick.kind==='character'||pick.kind==='place')) {
      const item=(await loadBank()).find(i=>i.kind===pick.kind&&i.id===pick.id);
      if(item?.image)setAssets(cur=>cur.some(i=>i.id===item.id&&i.kind===item.kind)?cur:[...cur,item]);
      else setProblem("The returned asset is unfinished or missing. Your project draft is still here.");
      const u=new URL(window.location.href);u.searchParams.delete('pick');window.history.replaceState(null,'',u.pathname+u.search);
    }
    setReady(true);
  }).catch(()=>{setProblem("The draft could not be restored. Keep this page open.");setReady(true);});},[draftKey]);
  const draft:Saved={formatId,idea,notes,title,assets,path,breakdown};
  useEffect(()=>{if(!ready)return;writes.current=writes.current.catch(()=>undefined).then(()=>defaultKv().set(draftKey,{formatId,idea,notes,title,assets,path,breakdown}));void writes.current.catch(()=>setProblem("Your draft could not be saved. Retry before leaving."));},[ready,draftKey,formatId,idea,notes,title,assets,path,breakdown]);
  async function beforeBuild(){try{await writes.current;await defaultKv().set(draftKey,draft);}catch{setProblem("Could not save your project draft. Stay here and retry before leaving.");throw new Error('Save failed');}}
  const format = formatById(formatId)!;

  async function write() {
    setBusy(true);
    setProblem(null);
    const result = await writeDraft(formatId, idea, [title && `Title: ${title}`, notes].filter(Boolean).join("\n"));
    setBusy(false);
    if (!result.ok) {
      if ("needsKey" in result && result.needsKey) setManual(true);
      setProblem(result.reason);
      return;
    }
    try {
      const { sheets, problems } = applyDraft(result.draft, format);
      onSheets(
        useSheetAssets(sheets,assets),
        [
          `Written: ${sheets.script.length} scenes, ${sheets.characters.length} characters, ${sheets.story.length} beats, ${sheets.shots.length} shots. Claude used ${result.usage.input.toLocaleString()} + ${result.usage.output.toLocaleString()} tokens on your account.`,
          problems.length ? `Fixed on the way in: ${problems.join(" ")}` : "",
        ].filter(Boolean).join(" "),
      );
    } catch (caught) {
      setProblem(caught instanceof Error ? caught.message : "The draft couldn't be laid out.");
    }
  }

  const titleField = (
    <label className="sh-field">
      <span>Working title</span>
      <input maxLength={100} value={title} onChange={(e) => setTitle(e.target.value)} />
    </label>
  );

  return (
    <div className="sh-start st"><fieldset className="cm-authoring" disabled={!ready || busy}>
      <h1>How do you want to start <b>{projectName}</b>?</h1>
      <p>Two choices: the kind of show, then how you want in. Every way ends on the same sheets, and you can change anything after.</p>

      <h2 className="st-h"><span>1</span> What kind of show</h2>
      <section className="st-shows" aria-label="Format">
        {GROUPS.map((group) => (
          <div key={group} className="st-group">
            <span className="st-group-name">{group}</span>
            <div>
              {FORMATS.filter((f) => f.group === group).map((f) => (
                <button key={f.id} aria-pressed={f.id === formatId} onClick={() => setFormatId(f.id)}>
                  <img src={showCover(f.id)} alt="" loading="lazy" />
                  <b>{f.label}</b>
                  <i>{clock(f.seconds)} · {f.aspect}</i>
                </button>
              ))}
            </div>
          </div>
        ))}
      </section>
      <p className="st-form">{format.form}</p>
      <Timeline format={format} />

      <h2 className="st-h"><span>2</span> How do you want in</h2>
      <div className="st-paths" role="group" aria-label="How to start">
        {PATHS.map((p) => (
          <button key={p.id} aria-pressed={p.id === path} onClick={() => setPath(p.id)}>
            <img src={p.picture} alt="" />
            <span><b>{p.title}</b><i>{p.says}</i></span>
          </button>
        ))}
      </div>

      <div className="st-panel">
        {path === "write" && (
          <>
            <label className="sh-field">
              <span>Your idea</span>
              <textarea rows={4} maxLength={8000} value={idea} onChange={(e) => setIdea(e.target.value)} placeholder="Who is it about, what do they want, what's in the way — a sentence or a page." />
            </label>
            <div className="sh-2">
              {titleField}
              <label className="sh-field">
                <span>Anything that must be true</span>
                <input maxLength={4000} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Tone, cast, setting, a scene you already see" />
              </label>
            </div>
            <p className="st-says">Claude writes the script to the {format.label.toLowerCase()} beats, then fills every sheet: cast with identity locks, places with looks, beats, and a first shot list with camera moves. Runs on your Claude key.</p>
            <button className="fire" disabled={busy || idea.trim().length < 12} onClick={() => void write()}>
              {busy ? "Writing… this can take a minute" : idea.trim().length < 12 ? "Say a little about the idea first" : `Write the ${format.label.toLowerCase()}`}
            </button>
            <button className="pill" aria-expanded={manual} onClick={() => setManual((value) => !value)}>No key? Write in Claude or ChatGPT</button>
            {manual && <ManualDraft key={formatId} format={format} idea={idea} notes={[title && `Title: ${title}`, notes].filter(Boolean).join("\n")} onSheets={(sheets, notice) => onSheets(useSheetAssets(sheets, assets), notice)} />}
          </>
        )}
        {path === "upload" && (
          <>
            <DropScripts onFiles={(files) => onFiles(files, { format, breakdown, assets })} />
            <label className="st-check">
              <input type="checkbox" checked={breakdown} onChange={(e) => setBreakdown(e.target.checked)} />
              <span><b>Break it down for me</b> Once it&rsquo;s read, Claude maps the scenes onto the {format.label.toLowerCase()} beats and fills the cast, places and a first shot list. Your script isn&rsquo;t changed. Runs on your Claude key; untick to do it yourself.</span>
            </label>
            <button className="plain st-link" onClick={onOpenSaved}>Open sheets you exported before</button>
          </>
        )}
        {path === "beats" && (
          <>
            <div className="sh-2">
              {titleField}
              <label className="sh-field">
                <span>Your idea, if you have one</span>
                <input maxLength={8000} value={idea} onChange={(e) => setIdea(e.target.value)} placeholder="Written into each beat as a reminder" />
              </label>
            </div>
            <p className="st-says">Every beat of the format on the sheets, each saying what it&rsquo;s for, with shots timed to length. Fill them in, move them, add your own. No AI, nothing spent.</p>
            <button
              className="fire"
              onClick={() => onSheets(useSheetAssets(layoutFormat(format, idea, title || projectName),assets), `Laid out ${format.beats.length} beats for a ${format.label.toLowerCase()}. Write each one, or add your own anywhere.`)}
            >
              Lay out the {format.beats.length} beats
            </button>
          </>
        )}
      </div>

      <section className="st-assets" aria-label="Project characters and locations"><h2>Characters and locations you already have</h2>
      <p>Pick people and places from your library and they are on the sheets from the start, faces and looks included.</p>
      <ProjectAssets beforeBuild={beforeBuild} onPick={item=>setAssets(cur=>cur.some(i=>i.id===item.id&&i.kind===item.kind)?cur:[...cur,item])}/>
      <div className="lab-chips">{assets.map(a=><button key={`${a.kind}:${a.id}`} onClick={()=>setAssets(cur=>cur.filter(i=>i!==a))} title="Remove from this project only">{a.name} ×</button>)}</div></section>

      <Link className="st-pictures" href={boardHref}>
        <img src="/start/pictures.webp" alt="" />
        <span><b>Or start from pictures</b><i>Drop stills or references on the board, one picture a scene, and drag them into order.</i></span>
      </Link>
      </fieldset>
      {problem && <p className="library-error" role="alert">{problem}</p>}
    </div>
  );
}
