"use client";

import { useMemo, useState } from "react";

import { compile, nextSteps, STEPS, type Recipe, type Step } from "../../comfy/recipe";
import { VOICES } from "../../providers/cloud-edits";
import { Nav } from "../nav";
import { WorkflowApp } from "./[name]/workflow-app";

/**
 * Build your own workflow: a chain of steps, each taking what the step
 * before it made. Try it as an app, run it, keep the result as its cover,
 * save it, share it.
 */

const info = (k: Step["kind"]) => STEPS.find((s) => s.kind === k)!;

export function BuildWorkflow({ start }: { start?: Recipe }) {
  const [recipe, setRecipe] = useState<Recipe>(start ?? { name: "My app", steps: [{ kind: "picture-in" }] });
  const [trying, setTrying] = useState(false);
  const [adding, setAdding] = useState(false);

  const compiled = useMemo(() => {
    try {
      return { json: JSON.stringify(compile(recipe)), error: null };
    } catch (caught) {
      return { json: null, error: caught instanceof Error ? caught.message : "That chain can't run." };
    }
  }, [recipe]);

  const setStep = (i: number, patch: Partial<Step>) => setRecipe((r) => ({ ...r, steps: r.steps.map((s, k) => (k === i ? { ...s, ...patch } : s)) }));
  const remove = (i: number) => setRecipe((r) => ({ ...r, steps: r.steps.filter((_, k) => k !== i) }));
  const move = (i: number, by: -1 | 1) =>
    setRecipe((r) => {
      const steps = [...r.steps];
      const [s] = steps.splice(i, 1);
      steps.splice(i + by, 0, s!);
      return { ...r, steps };
    });

  if (trying && compiled.json) return <WorkflowApp name={recipe.name} file={compiled.json} recipe={recipe} onBack={() => setTrying(false)} />;

  return (
    <div className="app">
      <Nav current="Workflows" />
      <div className="canvas">
        <div className="wf">
          <header className="wf-head">
            <div>
              <h1>Build your own workflow</h1>
              <p>Chain the steps you want. Each one takes the picture or video the step before it made. When it&rsquo;s right, try it as an app, run it, and save it with its result as the cover.</p>
            </div>
          </header>

          <label className="wf-field build-name">
            <span>App name</span>
            <input value={recipe.name} maxLength={80} onChange={(e) => setRecipe((r) => ({ ...r, name: e.target.value }))} />
          </label>

          <ol className="build-chain">
            {recipe.steps.map((step, i) => {
              const s = info(step.kind);
              return (
                <li key={i} className="build-step">
                  <header>
                    <span className="build-n">{i + 1}</span>
                    <b>{s.label}</b>
                    {s.model && <small>{s.model}</small>}
                  </header>
                  <p className="build-blurb">{s.blurb}</p>
                  {s.asks.includes("prompt") && (
                    <textarea rows={3} value={step.prompt ?? ""} placeholder={step.kind === "speak" ? "What they say" : "Describe it — whoever runs the app can change this"} onChange={(e) => setStep(i, { prompt: e.target.value })} aria-label={`Words for step ${i + 1}`} />
                  )}
                  <div className="build-opts">
                    {s.asks.includes("seconds") && (
                      <label>Seconds <input type="number" min={4} max={15} value={step.seconds ?? 5} onChange={(e) => setStep(i, { seconds: Number(e.target.value) })} /></label>
                    )}
                    {s.asks.includes("resolution") && (
                      <label>Quality
                        <select value={step.resolution ?? (step.kind === "animate" ? "768P" : "480p")} onChange={(e) => setStep(i, { resolution: e.target.value })}>
                          {(step.kind === "animate" ? ["768P", "2K"] : ["480p", "720p", "1080p"]).map((r) => <option key={r}>{r}</option>)}
                        </select>
                      </label>
                    )}
                    {s.asks.includes("voice") && (
                      <label>Voice
                        <select value={step.voice ?? "Sarah (female, american)"} onChange={(e) => setStep(i, { voice: e.target.value })}>
                          {VOICES.map((v) => <option key={v}>{v}</option>)}
                        </select>
                      </label>
                    )}
                  </div>
                  <footer>
                    <button className="plain" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move step ${i + 1} earlier`}>←</button>
                    <button className="plain" disabled={i === recipe.steps.length - 1} onClick={() => move(i, 1)} aria-label={`Move step ${i + 1} later`}>→</button>
                    <button className="plain danger" onClick={() => remove(i)}>Remove</button>
                  </footer>
                </li>
              );
            })}
            <li className="build-add">
              {adding ? (
                <div className="build-menu" role="menu">
                  {nextSteps(recipe.steps).map((s) => (
                    <button key={s.kind} role="menuitem" onClick={() => { setRecipe((r) => ({ ...r, steps: [...r.steps, { kind: s.kind }] })); setAdding(false); }}>
                      <b>{s.label}</b>
                      <span>{s.blurb}</span>
                    </button>
                  ))}
                  <button className="plain" onClick={() => setAdding(false)}>Cancel</button>
                </div>
              ) : (
                <button className="build-plus" onClick={() => setAdding(true)}>+ Add a step</button>
              )}
            </li>
          </ol>

          {compiled.error && <p className="library-error" role="alert">{compiled.error}</p>}
          <div className="sheet-row">
            <button className="fire" disabled={!compiled.json} onClick={() => setTrying(true)}>Try it as an app</button>
          </div>
        </div>
      </div>
    </div>
  );
}
