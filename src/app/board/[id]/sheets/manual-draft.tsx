"use client";
import { useState } from "react";
import type { Format } from "../../../../sheets/formats";
import type { Sheets } from "../../../../sheets/sheets";
import { manualDraftPrompt, readManualDraft } from "../../../../writer/manual-draft";

export function ManualDraft({ format, idea, notes, onSheets }: { format: Format; idea: string; notes: string; onSheets: (sheets: Sheets, notice: string) => void }) {
  const [reply, setReply] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [review, setReview] = useState<{ sheets: Sheets; problems: string[] } | null>(null);
  const prompt = idea.trim().length >= 12 ? manualDraftPrompt(format, idea, notes) : "Add your idea above to build the writing request.";
  return <section className="sh-byhand" aria-label="Write in Claude or ChatGPT">
    <h3>Write it in Claude or ChatGPT</h3>
    <p>No API key needed. Copy the request into your chat, then paste the JSON reply here. Haggs makes no AI call from this panel.</p>
    <label className="sh-field"><span>Writing request</span><textarea readOnly rows={5} value={prompt} onFocus={(e) => e.currentTarget.select()} /></label>
    <button className="pill" disabled={idea.trim().length < 12} onClick={() => void navigator.clipboard.writeText(prompt).then(() => setCopied(true), () => setProblem("Select the request above and copy it manually."))}>{copied ? "Copied" : "Copy writing request"}</button>
    <p>Paste into <a href="https://claude.ai/new" target="_blank" rel="noreferrer">Claude</a> or <a href="https://chatgpt.com/" target="_blank" rel="noreferrer">ChatGPT</a>.</p>
    <label className="sh-field"><span>JSON reply</span><textarea rows={6} maxLength={1_000_000} value={reply} onChange={(e) => { setReply(e.target.value); setReview(null); setProblem(null); }} /></label>
    <button className="pill" disabled={!reply.trim()} onClick={() => { try { setReview(readManualDraft(reply, format)); setProblem(null); } catch (e) { setReview(null); setProblem(e instanceof Error ? e.message : "That draft couldn't be read."); } }}>Check this draft</button>
    {review && <div role="status"><h4>{review.sheets.title}</h4><p>{review.sheets.logline}</p><p>{review.sheets.script.length} scenes · {review.sheets.characters.length} characters · {review.sheets.story.length} beats · {review.sheets.shots.length} shots</p>
      <details><summary>Read the script before applying</summary>{review.sheets.script.map((scene) => <article key={scene.id}><h4>{scene.heading}</h4><p style={{ whiteSpace: "pre-wrap" }}>{scene.action}</p>{scene.dialogue.map((line, i) => <p key={i}><b>{line.character}</b> {line.words}</p>)}</article>)}</details>
      {review.problems.length > 0 && <p>Adjusted while reading: {review.problems.join(" ")}</p>}
      <button className="fire" onClick={() => onSheets(review.sheets, `Imported your draft: ${review.sheets.script.length} scenes, ${review.sheets.story.length} beats and ${review.sheets.shots.length} shots. Review Check before making anything.`)}>Use this draft</button>
    </div>}
    {problem && <p role="alert" className="library-error">{problem}</p>}
  </section>;
}
