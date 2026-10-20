"use client";

import Link from "next/link";
import { useState } from "react";

import { FORMATS, formatById, layoutFormat, type Format } from "../../../../sheets/formats";
import type { Sheets } from "../../../../sheets/sheets";
import { applyDraft } from "../../../../writer/draft";
import { writeDraft } from "../../../actions";
import { openKeys } from "../../../nav";

/**
 * How a board starts. Four ways in, all ending on the same sheets:
 * write it from an idea with the AI, lay the format's beats out yourself,
 * upload a script, or start from pictures on the board.
 */

const GROUPS = ["Half-hour", "Hour", "Vertical", "Short"] as const;
const clock = (s: number) => (s < 120 ? `${s}s` : `${Math.round(s / 60)} min`);

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

export function StartScreen({
  projectName,
  boardHref,
  onSheets,
  onUpload,
  onOpenSaved,
}: {
  projectName: string;
  boardHref: string;
  onSheets: (sheets: Sheets, notice: string) => void;
  onUpload: () => void;
  onOpenSaved: () => void;
}) {
  const [formatId, setFormatId] = useState("comedy-30");
  const [idea, setIdea] = useState("");
  const [notes, setNotes] = useState("");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const format = formatById(formatId)!;

  async function write() {
    setBusy(true);
    setProblem(null);
    const result = await writeDraft(formatId, idea, [title && `Title: ${title}`, notes].filter(Boolean).join("\n"));
    setBusy(false);
    if (!result.ok) {
      if ("needsKey" in result && result.needsKey) openKeys();
      setProblem(result.reason);
      return;
    }
    try {
      const { sheets, problems } = applyDraft(result.draft, format);
      onSheets(
        sheets,
        [
          `Written: ${sheets.script.length} scenes, ${sheets.characters.length} characters, ${sheets.story.length} beats, ${sheets.shots.length} shots. Claude used ${result.usage.input.toLocaleString()} + ${result.usage.output.toLocaleString()} tokens on your account.`,
          problems.length ? `Fixed on the way in: ${problems.join(" ")}` : "",
        ].filter(Boolean).join(" "),
      );
    } catch (caught) {
      setProblem(caught instanceof Error ? caught.message : "The draft couldn't be laid out.");
    }
  }

  return (
    <div className="sh-start st">
      <h1>How do you want to start <b>{projectName}</b>?</h1>
      <p>Pick the kind of show first. Its beats are already where a hit in that format puts them; you fill them in, or let the writer draft it all and then change anything.</p>

      <section className="st-formats" aria-label="Format">
        {GROUPS.map((group) => (
          <div key={group} className="st-group">
            <span className="st-group-name">{group}</span>
            <div>
              {FORMATS.filter((f) => f.group === group).map((f) => (
                <button key={f.id} aria-pressed={f.id === formatId} onClick={() => setFormatId(f.id)}>
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

      <div className="st-idea">
        <label className="sh-field">
          <span>Your idea</span>
          <textarea rows={4} maxLength={8000} value={idea} onChange={(e) => setIdea(e.target.value)} placeholder="Who is it about, what do they want, what's in the way — a sentence or a page." />
        </label>
        <div className="sh-2">
          <label className="sh-field">
            <span>Working title</span>
            <input maxLength={100} value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label className="sh-field">
            <span>Anything that must be true</span>
            <input maxLength={4000} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Tone, cast, setting, a scene you already see" />
          </label>
        </div>
      </div>

      <div className="st-ways">
        <article>
          <h2>Write it with AI</h2>
          <p>Claude writes the script to these beats, then fills every sheet: cast with identity locks, places with looks, beats, and a first shot list with camera moves. Runs on your Claude key.</p>
          <button className="fire" disabled={busy || idea.trim().length < 12} onClick={() => void write()}>
            {busy ? "Writing… this can take a minute" : `Write the ${format.label.toLowerCase()}`}
          </button>
        </article>
        <article>
          <h2>Lay out the beats myself</h2>
          <p>Every beat of the format on the sheets, each saying what it's for, with shots timed to length. Fill them in, move them, add your own.</p>
          <button
            className="plain"
            onClick={() => onSheets(layoutFormat(format, idea, title || projectName), `Laid out ${format.beats.length} beats for a ${format.label.toLowerCase()}. Write each one, or add your own anywhere.`)}
          >
            Lay out the beats
          </button>
        </article>
        <article>
          <h2>I have a script</h2>
          <p>Plain text, Markdown or Fountain; several files become episodes. haggs reads the scenes, speakers and places.</p>
          <div className="st-row">
            <button className="plain" onClick={onUpload}>Upload scripts</button>
            <button className="plain" onClick={onOpenSaved}>Open saved sheets</button>
          </div>
        </article>
        <article>
          <h2>Start from pictures</h2>
          <p>Drop stills or references on the board, one picture a scene, and drag them into the order and subplots you want.</p>
          <Link className="plain" href={boardHref}>Go to the board</Link>
        </article>
      </div>
      {problem && <p className="library-error" role="alert">{problem}</p>}
    </div>
  );
}
