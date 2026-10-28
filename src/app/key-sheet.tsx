"use client";

import { FAL_ENABLED } from "../catalog/models";
import { useEffect, useRef, useState } from "react";

import { useSession } from "./session";
import { findClaudeWorkspaces, claudeWorkspace, saveClaudeWorkspace, clearClaudeKey, clearComfyKey, clearKey, clearLocalComfy, localComfy, saveClaudeKey, saveComfyKey, saveKey, saveLocalComfy } from "./actions";

/**
 * Every key in one place. Comfy (Cloud, or Router where enabled) is the platform this app is
 * built on, so it comes first; fal stays as a second route for the models it
 * hosts directly.
 *
 * Keys are posted once and kept in an httpOnly cookie. They never reach client
 * JavaScript, and this component only ever learns whether one is held.
 */

type Row = {
  id: "comfy" | "fal" | "claude";
  name: string;
  blurb: string;
  href: string;
  place: string;
  held: boolean;
  save: (key: string) => Promise<void>;
  clear: () => Promise<void>;
};

export function KeySheet({
  held,
  onChange,
  onClose,
}: {
  held: { comfy: boolean; fal: boolean; claude: boolean };
  onChange: (next: { comfy: boolean; fal: boolean; claude: boolean }) => void;
  onClose: () => void;
}) {
  const dialog=useRef<HTMLDivElement>(null);
  const close=useRef(onClose);close.current=onClose;
  useEffect(()=>{
    const previous=document.activeElement instanceof HTMLElement?document.activeElement:null;
    const controls=()=>Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')??[]).filter(e=>e.getClientRects().length>0);
    controls()[0]?.focus();
    const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();close.current();}else if(e.key==='Tab'){const list=controls(),first=list[0],last=list.at(-1);if(e.shiftKey&&(document.activeElement===first||!dialog.current?.contains(document.activeElement))){e.preventDefault();last?.focus();}else if(!e.shiftKey&&(document.activeElement===last||!dialog.current?.contains(document.activeElement))){e.preventDefault();first?.focus();}}};
    document.addEventListener('keydown',key);return()=>{document.removeEventListener('keydown',key);previous?.focus();};
  },[]);
  const lookupEpoch=useRef(0);
  const [workspace, setWorkspace] = useState("");
  const [workspaceStatus, setWorkspaceStatus] = useState("");
  const [workspaceBusy, setWorkspaceBusy] = useState(false);
  const [workspaceChoices, setWorkspaceChoices] = useState<{id:string;name:string}[]>([]);
  const [drafts, setDrafts] = useState({ comfy: "", fal: "", claude: "" });
  const [busy, setBusy] = useState<string | null>(null);
  const [gpu, setGpu] = useState<{ base: string; note: string } | null>(null);
  const [address, setAddress] = useState("127.0.0.1:8188");
  const [gpuError, setGpuError] = useState<string | null>(null);
  const [view, setView] = useState<"choose" | "keys" | "mcp">(held.comfy || held.claude || held.fal ? "keys" : "choose");
  const { session } = useSession();
  const hosted = Boolean(process.env.NEXT_PUBLIC_HOSTED);
  useEffect(() => {
    void claudeWorkspace().then(setWorkspace).catch(() => setWorkspaceStatus("Workspace setting could not be loaded."));
    void localComfy().then((base) => { if (base) { setGpu({ base, note: "" }); setView("keys"); } });
  }, []);

  const rows: Row[] = ([
    {
      id: "comfy",
      name: "Comfy",
      blurb: "Runs MiniMax H3, FLUX 3, Kling, Genjutsu, ElevenLabs and the edit tools on Comfy Cloud. Pay per use from your own Comfy credits.",
      href: "https://platform.comfy.org",
      place: "comfyui-…",
      held: held.comfy,
      save: saveComfyKey,
      clear: clearComfyKey,
    },
    {
      id: "fal",
      name: "fal",
      blurb: "Runs Nano Banana, FLUX 2, Kling, Veo and Seedance directly on your fal account.",
      href: "https://fal.ai/dashboard/keys",
      place: "fal key",
      held: held.fal,
      save: saveKey,
      clear: clearKey,
    },
    {
      id: "claude",
      name: "Claude",
      blurb: "The writer: drafts scripts from your idea and fills the sheets, on your own Anthropic account.",
      href: "https://console.anthropic.com/settings/keys",
      place: "sk-ant-…",
      held: held.claude,
      save: saveClaudeKey,
      clear: clearClaudeKey,
    },
  ] as Row[]).filter((r) => FAL_ENABLED || r.id !== "fal");

  if (view === "mcp") {
    return (
      <div className="veil" onClick={onClose}>
        <div ref={dialog} className="sheet wide provider-sheet" role="dialog" aria-modal="true" aria-label="MCP setup" onClick={(event) => event.stopPropagation()}>
          <h3>Connect Claude or Codex</h3>
          <p>
            haggs ships an MCP server. Claude or Codex can read your projects and send boards, takes, voice lines and apps to Activity. Nothing
            changes until you press Apply, and nothing is spent until you press a button that shows its price. The server runs next to haggs on
            your computer, so run haggs there first.
          </p>
          <ol className="mcp-steps">
            <li>
              <b>Run haggs on your computer</b>
              <CopyLine text="git clone https://github.com/IBFolding/haggs && cd haggs && npm install && npm run dev" />
            </li>
            <li>
              <b>Connect it, from the haggs folder</b>
              <CopyLine label="Claude Code" text="claude mcp add haggs -- npx tsx scripts/mcp.ts" />
              <CopyLine label="Codex" text="codex mcp add haggs -- npx tsx scripts/mcp.ts" />
              <small>Claude Code also picks it up on its own from the repo&rsquo;s <code>.mcp.json</code>. Any other MCP client can run <code>npx tsx scripts/mcp.ts</code>.</small>
            </li>
            <li>
              <b>Open your project in haggs, then ask</b>
              <small>Open the project once so haggs shares it, then ask Claude for a board, a series or an app. It lands in Activity, ready to apply.</small>
            </li>
          </ol>
          <div className="sheet-row">
            <button className="plain" onClick={() => setView(held.comfy || held.claude || held.fal || gpu ? "keys" : "choose")}>Back</button>
            <a className="plain" href="/docs">Read the guide</a>
            <button className="plain" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    );
  }

  if (view === "choose") {
    const credits = session ? "/account#credits" : "/signin?next=/account%23credits";
    return (
      <div className="veil" onClick={onClose}>
        <div ref={dialog} className="sheet wide provider-sheet" role="dialog" aria-modal="true" aria-label="Provider setup" onClick={(event) => event.stopPropagation()}>
          <h3>How do you want to make things?</h3>
          <p>Browsing is free. To make something, choose where the work runs. You can change this any time.</p>
          <div className="path-grid">
            <a className="path-card main" href={credits}>
              <b>I just want to make things</b>
              <span>No key, no setup. Buy credits and use the whole studio through haggs. You pay only for what you run, and the price shows on every button.</span>
              <i>Buy credits</i>
            </a>
            <button className="path-card" onClick={() => setView("keys")}>
              <b>I have a Comfy key</b>
              <span>Add your key and run on your own Comfy account at Comfy&rsquo;s prices.{hosted ? " The studio is the Platform plan, $15 a month." : ""}</span>
              <i>Add my key</i>
            </button>
            <button className="path-card" onClick={() => setView("keys")}>
              <b>I run Comfy on my own GPU</b>
              <span>Connect your ComfyUI. Your renders stay on your drive and show up here.{hosted ? " The studio is the Platform plan, $15 a month." : ""}</span>
              <i>Connect my GPU</i>
            </button>
            <button className="path-card" onClick={() => setView("mcp")}>
              <b>I use Claude or Codex</b>
              <span>Connect haggs over MCP. Claude or Codex reads your projects and sends work for you to apply. No extra key.</span>
              <i>Set up MCP</i>
            </button>
          </div>
          <div className="sheet-row">
            <button className="plain" onClick={onClose}>Close</button>
            <a className="plain" href="/pricing">See plans</a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="veil" onClick={onClose}>
      <div ref={dialog} className="sheet wide provider-sheet" role="dialog" aria-modal="true" aria-label="Provider setup" onClick={(event) => event.stopPropagation()}>
        <h3>Connect your keys</h3>
        <p>
          You pay the provider directly, at their rate.{hosted ? " The studio itself is the Platform plan, $15 a month." : ""}{" "}
          A key is posted once and kept in an httpOnly cookie.
        </p>

        {rows.map((row) => (
          <section key={row.id} className="key-row">
            <header>
              <b>{row.name}</b>
              <span className={`lamp${row.held ? " live" : ""}`} />
              <span className="key-status">{row.held ? "connected" : "not connected"}</span>
            </header>
            <p className="key-blurb">
              {row.blurb}{" "}
              <a href={row.href} target="_blank" rel="noreferrer">
                Get a key
              </a>
            </p>

            <div className="sheet-row">
              <input
                type="password"
                value={drafts[row.id]}
                onChange={(event) => { setDrafts((d) => ({ ...d, [row.id]: event.target.value })); if(row.id === "claude"){lookupEpoch.current++;setWorkspaceChoices([]);} }}
                placeholder={row.held ? "Replace the key" : row.place}
                autoComplete="off"
              />
              <button
                className="fire"
                disabled={!drafts[row.id].trim() || busy === row.id}
                onClick={async () => {
                  setBusy(row.id);
                  await row.save(drafts[row.id]);
                  if(row.id === "claude"){ lookupEpoch.current++;setWorkspaceChoices([]); setWorkspaceStatus("Key saved. If it requires a workspace, choose Find workspaces below. No generation is used."); }
                  setDrafts((d) => ({ ...d, [row.id]: "" }));
                  onChange({ ...held, [row.id]: true });
                  setBusy(null);
                }}
              >
                Save
              </button>
              {row.held && (
                <button
                  className="plain"
                  onClick={async () => {
                    await row.clear();
                    onChange({ ...held, [row.id]: false });
                  }}
                >
                  Disconnect
                </button>
              )}
            </div>
            {row.id === "claude" && <div className="claude-workspace">
              <h4>Choose your Claude workspace</h4>
              <p className="key-blurb">Most workspace-scoped keys need no extra setup. If Claude asks for a workspace, find it below and select its name. <a href="https://platform.claude.com/settings/workspaces" target="_blank" rel="noreferrer">Find your workspace ID</a>. This is separate from the Haggs canvas.</p>
              <button className="plain" disabled={!held.claude || workspaceBusy || !!drafts.claude.trim()} onClick={async () => {
                const epoch=++lookupEpoch.current;setWorkspaceBusy(true); setWorkspaceStatus(""); setWorkspaceChoices([]);
                try { const r = await findClaudeWorkspaces(); if(epoch!==lookupEpoch.current)return; if (r.ok) { setWorkspaceChoices(r.workspaces); setWorkspaceStatus(r.workspaces.length ? "Choose a workspace below, then save. Listing does not verify inference access or spend credits." : "No workspaces were returned. A scoped key needs no workspace setting; otherwise check Claude Console."); } else setWorkspaceStatus(r.reason); }
                catch { setWorkspaceStatus("Workspace lookup could not finish. Your settings are unchanged."); }
                finally { setWorkspaceBusy(false); }
              }}>Find workspaces · no generation</button>
              {workspaceChoices.length > 0 && <label>Choose an Anthropic workspace<select value={workspaceChoices.some((w) => w.id === workspace) ? workspace : ""} onChange={(e) => { setWorkspace(e.target.value); setWorkspaceStatus("Selection is not saved yet. Save workspace selection to apply it."); }}><option value="" disabled>Choose a workspace</option>{workspaceChoices.map((w) => <option key={w.id} value={w.id}>{w.name} · {w.id}</option>)}</select></label>}
              <details><summary>Advanced: enter a workspace ID</summary><label htmlFor="claude-workspace-id">Anthropic workspace ID</label><input id="claude-workspace-id" value={workspace} onChange={(e) => { setWorkspace(e.target.value); setWorkspaceStatus(""); }} placeholder="wrkspc_…" autoComplete="off" maxLength={135} /></details>
              {workspace && <p>Selected workspace: {workspaceChoices.find(w=>w.id===workspace)?.name ?? workspace}</p>}
              <div className="sheet-row"><button className="plain" disabled={workspaceBusy || !!drafts.claude.trim()} onClick={async () => {
                setWorkspaceBusy(true); setWorkspaceStatus("");
                try { const result = await saveClaudeWorkspace(workspace); setWorkspaceStatus(result.ok ? "Workspace setting saved. Your key is unchanged." : result.reason); } catch { setWorkspaceStatus("Could not save the workspace setting. Try again."); } finally { setWorkspaceBusy(false); }
              }}>{workspaceBusy ? "Saving…" : "Save workspace selection"}</button></div>
              {workspaceStatus && <p role="status">{workspaceStatus}</p>}
            </div>}
          </section>
        ))}

        <section className="key-row">
          <header>
            <b>Your own GPU</b>
            <span className={`lamp${gpu ? " live" : ""}`} />
            <span className="key-status">{gpu ? `connected${gpu.note ? ` · ${gpu.note}` : ""}` : "not connected"}</span>
          </header>
          <p className="key-blurb">
            Point haggs at a ComfyUI running on your computer or network. Open-weights workflows (no partner nodes) then run there, free, instead of on Comfy Cloud. Workflows that use partner models like Kling or ElevenLabs still go to Comfy Cloud.
          </p>
          <div className="sheet-row">
            <input value={address} onChange={(event) => setAddress(event.target.value)} placeholder="127.0.0.1:8188" autoComplete="off" aria-label="ComfyUI address" />
            <button
              className="fire"
              disabled={!address.trim() || busy === "gpu"}
              onClick={async () => {
                setBusy("gpu");
                setGpuError(null);
                const r = await saveLocalComfy(address);
                setBusy(null);
                if (r.ok) setGpu({ base: r.base, note: r.gpu });
                else setGpuError(r.reason);
              }}
            >
              {busy === "gpu" ? "Checking…" : "Connect"}
            </button>
            {gpu && (
              <button className="plain" onClick={async () => { await clearLocalComfy(); setGpu(null); }}>
                Disconnect
              </button>
            )}
          </div>
          {gpuError && <p className="library-error" role="alert">{gpuError}</p>}
        </section>

        <section className="key-row">
          <header>
            <b>Claude or Codex over MCP</b>
          </header>
          <p className="key-blurb">
            Connect haggs to Claude or Codex. They read your projects and send work to Activity for you to apply. No extra key.
          </p>
          <div className="sheet-row">
            <button className="plain" onClick={() => setView("mcp")}>Set up MCP</button>
          </div>
        </section>

        <div className="sheet-row">
          <button className="plain" onClick={onClose}>
            Close
          </button>
          {!held.comfy && !gpu && <button className="plain" onClick={() => setView("choose")}>Back</button>}
        </div>
        <div className="sheet-note">
          Browsing works without a key. Every generation shows its price on the button
          before you press it.
        </div>
      </div>
    </div>
  );
}

function CopyLine({ text, label }: { text: string; label?: string }) {
  const [done, setDone] = useState<"" | "Copied" | "Selected, press ⌘C">("");
  const code = useRef<HTMLElement>(null);
  const show = (note: typeof done) => { setDone(note); setTimeout(() => setDone(""), 2000); };
  const select = () => { const range = document.createRange(); if (!code.current) return; range.selectNodeContents(code.current); const sel = getSelection(); sel?.removeAllRanges(); sel?.addRange(range); show("Selected, press ⌘C"); };
  return (
    <div className="mcp-line">
      {label && <span>{label}</span>}
      <code ref={code}>{text}</code>
      <button className="plain" onClick={() => void navigator.clipboard.writeText(text).then(() => show("Copied"), select)}>{done || "Copy"}</button>
    </div>
  );
}
