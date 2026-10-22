"use client";

import { useRef, useState } from "react";

import { Nav } from "../../nav";
import { WorkflowApp } from "./workflow-app";

/** Open a workflow you already have — saved from ComfyUI, in the editor's format or the API format — as an app. */
export function ImportWorkflow() {
  const [file, setFile] = useState<{ name: string; text: string } | null>(null);
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const take = async (f: File | undefined) => f && setFile({ name: f.name.replace(/\.json$/i, ""), text: await f.text() });
  if (file) return <WorkflowApp name={file.name} file={file.text} />;
  return (
    <div className="app">
      <Nav current="Workflows" />
      <div className="canvas">
        <div className="wf">
          <header className="wf-head"><div><h1>Open your own workflow</h1><p>Drop a workflow you saved from ComfyUI. haggs turns it into a form: your files where its Load nodes are, its prompts as text boxes, its key settings as choices. It runs on Comfy Cloud with your key.</p></div></header>
          <button
            className={`wf-import${over ? " over" : ""}`}
            onClick={() => input.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setOver(true); }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => { e.preventDefault(); setOver(false); void take(e.dataTransfer.files[0]); }}
          >
            <b>Drop a workflow .json here</b>
            <span>or choose one. Workflows saved from the editor and API-format files both work.</span>
          </button>
          <input ref={input} type="file" accept=".json,application/json" hidden onChange={(e) => void take(e.target.files?.[0])} />
        </div>
      </div>
    </div>
  );
}
