"use client";

import { FAL_ENABLED } from "../catalog/models";
import { useEffect, useState } from "react";

import { useSession } from "./session";
import { clearClaudeKey, clearComfyKey, clearKey, clearLocalComfy, localComfy, saveClaudeKey, saveComfyKey, saveKey, saveLocalComfy } from "./actions";

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
  const [drafts, setDrafts] = useState({ comfy: "", fal: "", claude: "" });
  const [busy, setBusy] = useState<string | null>(null);
  const [gpu, setGpu] = useState<{ base: string; note: string } | null>(null);
  const [address, setAddress] = useState("127.0.0.1:8188");
  const [gpuError, setGpuError] = useState<string | null>(null);
  const [view, setView] = useState<"choose" | "keys">(held.comfy ? "keys" : "choose");
  const { session } = useSession();
  const hosted = Boolean(process.env.NEXT_PUBLIC_HOSTED);
  useEffect(() => {
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

  if (view === "choose") {
    const credits = session ? "/account#credits" : "/signin?next=/account%23credits";
    return (
      <div className="veil" onClick={onClose}>
        <div className="sheet wide" onClick={(event) => event.stopPropagation()}>
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
      <div className="sheet wide" onClick={(event) => event.stopPropagation()}>
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
                onChange={(event) => setDrafts((d) => ({ ...d, [row.id]: event.target.value }))}
                placeholder={row.held ? "Replace the key" : row.place}
                autoComplete="off"
              />
              <button
                className="fire"
                disabled={!drafts[row.id].trim() || busy === row.id}
                onClick={async () => {
                  setBusy(row.id);
                  await row.save(drafts[row.id]);
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
