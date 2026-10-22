"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { createAppStore, readAppFile } from "../../../story/apps";
import { defaultKv } from "../../../story/kv";

import { Nav } from "../../nav";
import { WorkflowApp } from "./workflow-app";

/** Open a workflow you already have — saved from ComfyUI, in the editor's format or the API format — as an app. */
export function ImportWorkflow() {
  const [file, setFile] = useState<{ name: string; text: string } | null>(null);
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const take = async (f: File | undefined) => {
    if (!f) return;
    const text = await f.text();
    // An app file someone shared joins your apps; a workflow file opens as one.
    if (text.includes('"haggs.app/1"')) {
      try {
        const saved = await createAppStore(defaultKv()).save(readAppFile(text));
        router.push(`/workflows/mine?id=${saved.id}`);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "That app file couldn't be opened.");
      }
      return;
    }
    setFile({ name: f.name.replace(/\.json$/i, ""), text });
  };
  if (file) return <WorkflowApp name={file.name} file={file.text} />;
  return (
    <div className="app">
      <Nav current="Workflows" />
      <div className="canvas">
        <div className="wf">
          <header className="wf-head"><div><h1>Open a workflow or an app</h1><p>Drop a workflow you saved from ComfyUI. haggs turns it into a form: your files where its Load nodes are, its prompts as text boxes, its key settings as choices. It runs on Comfy Cloud with your key.</p></div></header>
          <button
            className={`wf-import${over ? " over" : ""}`}
            onClick={() => input.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setOver(true); }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => { e.preventDefault(); setOver(false); void take(e.dataTransfer.files[0]); }}
          >
            <b>Drop a workflow or an app file here</b>
            <span>or choose one. Workflows saved from ComfyUI (either format) and haggs app files someone shared with you both work.</span>
          </button>
          {error && <p className="library-error" role="alert">{error}</p>}
          <input ref={input} type="file" accept=".json,application/json" hidden onChange={(e) => void take(e.target.files?.[0])} />
        </div>
      </div>
    </div>
  );
}
