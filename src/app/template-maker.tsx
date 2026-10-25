"use client";

import { useState } from "react";

import { createTemplateStore, type CustomFormat } from "../series/custom";
import { defaultKv } from "../story/kv";

/** Make a series template of your own: a name, how each video is built, and an idea to start from. */
export function TemplateMaker({ onSaved, onClose, start }: { onSaved: (t: CustomFormat) => void; onClose: () => void; start?: CustomFormat }) {
  const [label, setLabel] = useState(start?.label ?? "");
  const [how, setHow] = useState(start?.how ?? "");
  const [topic, setTopic] = useState(start?.topic ?? "");
  const [count, setCount] = useState(start?.count ?? 3);
  const [problem, setProblem] = useState<string | null>(null);

  async function save() {
    setProblem(null);
    try {
      onSaved(await createTemplateStore(defaultKv()).save({ ...(start ? { id: start.id } : {}), label, how, topic, count }));
    } catch (e) {
      setProblem(e instanceof Error ? e.message : "It couldn't be saved.");
    }
  }

  return (
    <div className="sm-back" role="dialog" aria-modal="true" aria-label="Make your own series template" onClick={onClose}>
      <div className="sm" onClick={(e) => e.stopPropagation()}>
        <h2>{start ? "Edit your template" : "Make your own template"}</h2>
        <p className="gs-soft">A template is a shape you can use again: “Top ten”, “My favorite cars”, “Day in the life”. Describe it once, then use it for any idea.</p>
        <label className="wf-field"><span>Name</span><input value={label} maxLength={40} onChange={(e) => setLabel(e.target.value)} placeholder="My favorite cars" autoFocus /></label>
        <label className="wf-field"><span>How is each video built?</span><textarea rows={4} maxLength={600} value={how} onChange={(e) => setHow(e.target.value)} placeholder="Each video counts down my ten favorite cars, one shot per car, best last. The first shot says the number, and the car's name is on screen." /></label>
        <label className="wf-field"><span>An idea to start from (optional)</span><input value={topic} maxLength={300} onChange={(e) => setTopic(e.target.value)} placeholder="Ten cars I would drive forever" /></label>
        <label className="wf-field wf-field-inline"><span>How many videos by default</span><input type="number" min={1} max={8} value={count} onChange={(e) => setCount(Math.min(8, Math.max(1, Number(e.target.value) || 1)))} /></label>
        {problem && <p className="library-error" role="alert">{problem}</p>}
        <div className="gs-row sm-foot">
          <button className="fire" disabled={!label.trim() || how.trim().length < 12} onClick={() => void save()}>{start ? "Save changes" : "Save the template"}</button>
          <button className="plain" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
